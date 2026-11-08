-- Modulo DocuSet: ogni persona riceve un link personale e privato
-- (/m/<token>) e compila senza account. Chi compila non legge mai le
-- tabelle: passa solo dalle funzioni get_form / submit_form, che
-- accettano il token. Le risposte le legge solo la produzione che le ha chieste.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.form_links (
  -- 18 byte casuali in base64url: 24 caratteri, non indovinabili.
  token text primary key default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  production_id text not null,
  person_id text not null,
  production_title text not null,
  person_name text not null,
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  submitted_at timestamptz,
  unique (owner_id, production_id, person_id)
);

create table if not exists public.form_submissions (
  token text primary key references public.form_links (token) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  production_id text not null,
  person_id text not null,
  data jsonb not null,
  submitted_at timestamptz not null default now()
);

create index if not exists form_submissions_owner_idx on public.form_submissions (owner_id);

alter table public.form_links enable row level security;
alter table public.form_submissions enable row level security;

drop policy if exists "form_links: owner only" on public.form_links;
create policy "form_links: owner only" on public.form_links
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Nessuna policy di insert/update: le risposte entrano solo da submit_form.
drop policy if exists "form_submissions: owner reads" on public.form_submissions;
create policy "form_submissions: owner reads" on public.form_submissions
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "form_submissions: owner deletes" on public.form_submissions;
create policy "form_submissions: owner deletes" on public.form_submissions
  for delete to authenticated
  using (owner_id = (select auth.uid()));

/* ---------- Funzioni pubbliche usate dalla pagina del modulo ---------- */

create or replace function public.form_token_open(p_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.form_links where token = p_token and expires_at > now());
$$;

create or replace function public.get_form(p_token text)
returns table (production_title text, person_name text, fields jsonb, submitted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.production_title, l.person_name, l.fields, l.submitted_at
  from public.form_links l
  where l.token = p_token and l.expires_at > now();
$$;

create or replace function public.submit_form(p_token text, p_data jsonb)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  link public.form_links;
begin
  select * into link from public.form_links
  where token = p_token and expires_at > now()
  for update;
  if not found then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 100000 then
    raise exception 'invalid_data' using errcode = 'P0001';
  end if;

  -- Una risposta per link: un nuovo invio sostituisce il precedente.
  insert into public.form_submissions (token, owner_id, production_id, person_id, data)
  values (p_token, link.owner_id, link.production_id, link.person_id, p_data)
  on conflict (token) do update set data = excluded.data, submitted_at = now();

  update public.form_links set submitted_at = now() where token = p_token;
  return now();
end $$;

revoke all on function public.form_token_open(text) from public;
revoke all on function public.get_form(text) from public;
revoke all on function public.submit_form(text, jsonb) from public;
grant execute on function public.form_token_open(text) to anon, authenticated;
grant execute on function public.get_form(text) to anon, authenticated;
grant execute on function public.submit_form(text, jsonb) to anon, authenticated;

/* ---------- File caricati (documento, firma) ---------- */

-- Privato: chi compila può solo caricare nella cartella del proprio token;
-- legge e cancella solo la produzione proprietaria del link.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "submissions: upload with open token" on storage.objects;
create policy "submissions: upload with open token" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'submissions' and public.form_token_open((storage.foldername(name))[1]));

drop policy if exists "submissions: owner reads" on storage.objects;
create policy "submissions: owner reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'submissions' and exists (
    select 1 from public.form_links l
    where l.token = (storage.foldername(name))[1] and l.owner_id = (select auth.uid())
  ));

drop policy if exists "submissions: owner deletes" on storage.objects;
create policy "submissions: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'submissions' and exists (
    select 1 from public.form_links l
    where l.token = (storage.foldername(name))[1] and l.owner_id = (select auth.uid())
  ));
