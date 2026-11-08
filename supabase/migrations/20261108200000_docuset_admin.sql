-- Profilo (nome e cognome) chiesto al primo accesso e pannello per chi gestisce DocuSet.

create table if not exists public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: own row" on public.profiles;
create policy "profiles: own row" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Chi vede il pannello. Nessuna policy: dal client la tabella non si legge né si scrive.
create table if not exists public.app_admins (
  email text primary key
);

alter table public.app_admins enable row level security;

insert into public.app_admins (email) values
  ('nicolocaloni@gmail.com'),
  ('smartset.info00@gmail.com')
on conflict do nothing;

-- L'email nel token è quella verificata dal link o dal codice di accesso.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins where email = lower(auth.jwt() ->> 'email'));
$$;

create or replace function public.admin_users()
returns table (
  id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  productions int,
  people int,
  forms_sent int,
  forms_received int
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, p.full_name, u.created_at, u.last_sign_in_at,
      coalesce(jsonb_array_length(s.data -> 'productions'), 0),
      coalesce(jsonb_array_length(s.data -> 'people'), 0),
      (select count(*)::int from public.form_links l where l.owner_id = u.id),
      (select count(*)::int from public.form_submissions f where f.owner_id = u.id)
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.app_state s on s.owner_id = u.id
    order by u.created_at desc;
end $$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.admin_users() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_users() to authenticated;
