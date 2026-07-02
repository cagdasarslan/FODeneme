// Supabase liderlik yapılandırması — sezonluk (gün/hafta/ay/yıl) tablolar için.
//
// KURULUM (5 dk):
// 1) https://supabase.com → ücretsiz proje aç.
// 2) SQL Editor'da şunu çalıştır:
//      create table scores (
//        id bigint generated always as identity primary key,
//        player_id text not null,
//        player_name text not null,
//        score int not null,
//        map_id int,
//        created_at timestamptz default now()
//      );
//      alter table scores enable row level security;
//      create policy "insert_all" on scores for insert with check (true);
//      create policy "read_all"  on scores for select using (true);
// 3) Project Settings → API'den URL ve anon key'i aşağıya yapıştır.
//
// Boş bırakılırsa oyun mevcut LootLocker "TÜMÜ" tablosuyla çalışmaya devam
// eder; sezonluk sekmeler "yakında" mesajı gösterir.
export const SUPA_URL = '';
export const SUPA_KEY = '';
