-- =============================================================================
-- Horse Runner — Supabase güvenlik geçişi, AŞAMA 1
-- =============================================================================
-- Ne yapar:
--   1) Liderlik tablolarındaki kurtarma kodlarını (player_id) geri çevrilemez
--      SHA-256 özetine dönüştürür ve bundan sonra gelen ham kodları otomatik
--      özetler (eski 1.0.3 sürümü dahil).
--   2) Profil kaydı için sunucu fonksiyonları ekler (save / restore / delete).
--      Uygulama 1.0.4+ bunları kullanır; yoksa eski yönteme düşer.
--   3) Liderliğe açıkça sahte skor yazılmasını engeller.
--
-- GÜVENLİ Mİ? Evet: mevcut tablo kuralları DEĞİŞMEZ, eski sürüm çalışmaya
-- devam eder. Yalnızca ekleme ve veri dönüştürme yapar.
--
-- NASIL UYGULANIR: Supabase panosu → SQL Editor → bu dosyanın tamamını
-- yapıştır → Run. Bir kez çalıştırmak yeterli; tekrar çalıştırmak da zararsız.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ── 1) Liderlik kimliklerini özetle ─────────────────────────────────────────
-- security definer: eski sürümden gelen anonim yazmalarda da çalışsın
-- (anon rolünün extensions şemasına erişimi olmasa bile)
create or replace function public.hr_hash_id(raw text)
returns text
language sql
immutable
security definer
set search_path = public, extensions
as $$
  select encode(extensions.digest(raw, 'sha256'), 'hex');
$$;

-- Ham kod mu? (eski sürümler 'p_...' ya da 'u_...' yazar; özet 64 hex karakter)
create or replace function public.hr_is_raw_id(v text)
returns boolean
language sql
immutable
as $$
  select v like 'p\_%' or v like 'u\_%';
$$;

-- totals: aynı oyuncunun ham ve özet satırları varsa en yüksek toplamda birleştir
insert into public.totals (player_id, player_name, total, updated_at)
select public.hr_hash_id(player_id), player_name, total, updated_at
from public.totals
where public.hr_is_raw_id(player_id)
on conflict (player_id) do update
  set total       = greatest(public.totals.total, excluded.total),
      player_name = coalesce(excluded.player_name, public.totals.player_name),
      updated_at  = greatest(public.totals.updated_at, excluded.updated_at);
delete from public.totals where public.hr_is_raw_id(player_id);

-- scores: ham kodları özete çevir
update public.scores
set player_id = public.hr_hash_id(player_id)
where public.hr_is_raw_id(player_id);

-- Bundan sonra gelen ham kodları yazılmadan önce özetle + bariz sahte skoru at
create or replace function public.hr_scores_guard()
returns trigger
language plpgsql
as $$
begin
  if public.hr_is_raw_id(new.player_id) then
    new.player_id := public.hr_hash_id(new.player_id);
  end if;
  -- Tek koşuda ulaşılabilecek makul üst sınır; üstü sessizce reddedilir
  if new.score is null or new.score < 0 or new.score > 500000 then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists hr_scores_guard on public.scores;
create trigger hr_scores_guard
  before insert or update on public.scores
  for each row execute function public.hr_scores_guard();

create or replace function public.hr_totals_guard()
returns trigger
language plpgsql
as $$
begin
  if public.hr_is_raw_id(new.player_id) then
    new.player_id := public.hr_hash_id(new.player_id);
  end if;
  if new.total is null or new.total < 0 then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists hr_totals_guard on public.totals;
create trigger hr_totals_guard
  before insert or update on public.totals
  for each row execute function public.hr_totals_guard();

-- ── 2) Profil sunucu fonksiyonları ─────────────────────────────────────────
-- Kodu bilen yalnızca KENDİ kaydını okur/yazar/siler; tablo listelenemez.

create or replace function public.save_profile(code text, p_name text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if code is null or length(code) < 8 or length(code) > 64 then
    raise exception 'invalid code';
  end if;
  if pg_column_size(p_data) > 200000 then
    raise exception 'save too large';
  end if;
  insert into profiles (id, name, data, updated_at)
  values (code, left(p_name, 32), coalesce(p_data, '{}'::jsonb), now())
  on conflict (id) do update
    set name = excluded.name, data = excluded.data, updated_at = now();
end;
$$;

create or replace function public.restore_profile(code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select data from profiles where id = code limit 1;
$$;

-- Hesap/veri silme: profil + o oyuncunun liderlik kayıtları
create or replace function public.delete_profile(code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if code is null or length(code) < 8 then
    raise exception 'invalid code';
  end if;
  delete from profiles where id = code;
  delete from scores   where player_id = public.hr_hash_id(code);
  delete from totals   where player_id = public.hr_hash_id(code);
end;
$$;

revoke all on function public.save_profile(text, text, jsonb) from public;
revoke all on function public.restore_profile(text)           from public;
revoke all on function public.delete_profile(text)            from public;
grant execute on function public.save_profile(text, text, jsonb) to anon, authenticated;
grant execute on function public.restore_profile(text)           to anon, authenticated;
grant execute on function public.delete_profile(text)            to anon, authenticated;

-- Doğrulama (isteğe bağlı): aşağıdaki iki sorgu 0 dönmeli
-- select count(*) from public.scores where public.hr_is_raw_id(player_id);
-- select count(*) from public.totals where public.hr_is_raw_id(player_id);
