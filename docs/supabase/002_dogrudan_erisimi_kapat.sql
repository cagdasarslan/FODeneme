-- =============================================================================
-- Horse Runner — Supabase güvenlik geçişi, AŞAMA 2
-- =============================================================================
-- Ne yapar: profiles tablosuna doğrudan (anon anahtarla) okuma/yazmayı kapatır.
-- Bundan sonra profillere yalnızca 001'deki sunucu fonksiyonlarıyla erişilir;
-- kimse tüm kayıtları listeleyemez ya da başkasının kaydını değiştiremez.
--
-- NE ZAMAN: 001 uygulandıktan ve 1.0.4+ sürümü oyuncuların büyük çoğunluğuna
-- ulaştıktan SONRA (Play Console → İstatistikler → uygulama sürümleri).
-- Daha erken uygulanırsa eski sürümdeki oyuncuların bulut yedeği çalışmaz.
-- =============================================================================

drop policy if exists "anon select" on public.profiles;
drop policy if exists "anon upsert" on public.profiles;
drop policy if exists "anon update" on public.profiles;
-- RLS açık kalır; kural olmadığı için anon doğrudan erişemez,
-- security definer fonksiyonlar ise çalışmaya devam eder.
alter table public.profiles enable row level security;
