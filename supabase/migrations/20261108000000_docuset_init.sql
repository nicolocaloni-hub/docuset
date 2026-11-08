-- DocuSet: stato dell'app per utente + PDF dei template in storage privato.
-- Da eseguire una volta nel progetto Supabase (SQL Editor o `supabase db push`).

-- shortcut: tutto lo stato di un utente sta in un unico documento jsonb.
-- Basta per un ufficio di produzione; quando servirà condividere una
-- produzione fra più account conviene passare a tabelle separate.
create table if not exists public.app_state (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "app_state: owner only" on public.app_state;
create policy "app_state: owner only" on public.app_state
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Ogni salvataggio aggiorna updated_at: il client lo usa per non
-- sovrascrivere modifiche fatte da un altro dispositivo.
create or replace function public.app_state_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists app_state_touch on public.app_state;
create trigger app_state_touch before update on public.app_state
  for each row execute function public.app_state_touch();

-- Bucket privato per i PDF: solo il proprietario legge e scrive, max 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('templates', 'templates', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "templates: owner folder" on storage.objects;
create policy "templates: owner folder" on storage.objects
  for all to authenticated
  using (bucket_id = 'templates' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'templates' and (storage.foldername(name))[1] = (select auth.uid())::text);
