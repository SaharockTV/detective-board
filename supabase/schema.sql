-- Доска расследований: выполните целиком в Supabase → SQL Editor → New query → Run

create table if not exists public.boards (
  id text primary key,
  code text unique not null,
  title text not null,
  created_by text,
  created_at timestamptz default now()
);

-- Все объекты доски: карточки, нити, история, чат, участники
create table if not exists public.board_rows (
  id text primary key,
  board_id text not null references public.boards(id) on delete cascade,
  kind text not null,
  data jsonb not null,
  updated_at bigint not null
);
create index if not exists board_rows_board_idx on public.board_rows(board_id);

alter table public.boards enable row level security;
alter table public.board_rows enable row level security;

-- Доступ по коду доски (без регистрации). Код = пропуск.
drop policy if exists "boards_all" on public.boards;
create policy "boards_all" on public.boards for all using (true) with check (true);
drop policy if exists "rows_all" on public.board_rows;
create policy "rows_all" on public.board_rows for all using (true) with check (true);

-- Реальное время
alter table public.board_rows replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.board_rows;
exception when duplicate_object then null; end $$;

-- Хранилище файлов (фото, видео, mp3, 3D)
insert into storage.buckets (id, name, public) values ('files', 'files', true)
on conflict (id) do update set public = true;
drop policy if exists "files_read" on storage.objects;
create policy "files_read" on storage.objects for select using (bucket_id = 'files');
drop policy if exists "files_insert" on storage.objects;
create policy "files_insert" on storage.objects for insert with check (bucket_id = 'files');