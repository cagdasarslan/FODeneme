# Supabase Güvenlik Geçişi

## Sorun

`profiles`, `scores` ve `totals` tablolarının RLS kuralları koşulsuz
(`using (true)` / `with check (true)`). Uygulamadaki herkese açık (anon)
anahtarla:

- `GET /rest/v1/profiles?select=*` tüm oyuncuların kayıtlarını ve **kurtarma
  kodlarını** (satır `id`'si) döker.
- Herhangi bir kayıt değiştirilebilir, liderliğe istenen skor yazılabilir.

## Neden hemen uygulanmadı

Play'deki 1.0.3 sürümü bu tablolara doğrudan anon anahtarla yazıyor. Kurallar
bugün sıkılaştırılırsa mevcut oyuncuların bulut yedeği **anında çalışmaz hale
gelir**. Geçiş iki aşamalı yapılmalı.

## Aşama 1 — Sunucu fonksiyonları (uygulama güncellemesiyle birlikte)

Kayıt okuma/yazma ve geri yükleme, gizli anahtarla çalışan Edge Function'lara
taşınır. İstemci tabloya doğrudan erişmez.

```sql
-- Kurtarma koduyla geri yükleme: kodu bilen yalnızca kendi kaydını alır,
-- listeleme yapılamaz.
create or replace function public.restore_profile(code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select data from profiles where id = code limit 1;
$$;
revoke all on function public.restore_profile(text) from public;
grant execute on function public.restore_profile(text) to anon;

-- Kayıt yazma: yalnızca kendi kimliğine (istemcide saklanan gizli id) yazar
create or replace function public.save_profile(code text, p_name text, p_data jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into profiles (id, name, data, updated_at)
  values (code, p_name, p_data, now())
  on conflict (id) do update
    set name = excluded.name, data = excluded.data, updated_at = now();
$$;
revoke all on function public.save_profile(text, text, jsonb) from public;
grant execute on function public.save_profile(text, text, jsonb) to anon;

-- Skor gönderimi: makul üst sınır (tek koşu)
create or replace function public.submit_score(p_id text, p_name text, p_score int, p_map int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_score < 0 or p_score > 200000 then return; end if;
  insert into scores (player_id, player_name, score, map_id) values (p_id, p_name, p_score, p_map);
end;
$$;
grant execute on function public.submit_score(text, text, int, int) to anon;
```

İstemci tarafında `CloudSave.js` ve `SupaLeaderboard.js` bu fonksiyonları
`/rest/v1/rpc/<ad>` ile çağıracak şekilde güncellenir.

## Aşama 2 — Doğrudan erişimi kapatma (eski sürüm kullanımı azalınca)

Yeni sürüm oyuncuların büyük çoğunluğuna ulaştıktan sonra (Play Console →
İstatistikler → sürüm dağılımı) doğrudan tablo erişimi kapatılır:

```sql
drop policy if exists "anon select" on profiles;
drop policy if exists "anon upsert" on profiles;
drop policy if exists "anon update" on profiles;
-- scores / totals için de aynı şekilde anon insert/update/select kuralları
-- kaldırılır; liderlik okuma için yalnızca ad + skor döndüren bir görünüm
-- (view) veya rpc açılır.
```

## Satın alma doğrulaması (ayrı iş)

Havuç ve "Reklamları Kaldır" şu an istemcide, makbuz doğrulaması olmadan
veriliyor. Uzun vadede `store.validator` bir Edge Function'a bağlanmalı; bu
fonksiyon Google Play Developer API (ve iOS için App Store Server API) ile
makbuzu doğrulayıp hakları sunucuda tutar.
