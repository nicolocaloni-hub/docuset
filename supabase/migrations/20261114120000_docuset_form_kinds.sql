-- Quattro moduli per produzione (troupe, attori, regista, comparse).
-- Ogni link ricorda il modulo della persona; i link già inviati restano "troupe".
-- Solo aggiunte: una colonna nuova e get_form estesa (stessa firma, nessun drop).

alter table public.form_links add column if not exists form_kind text not null default 'troupe'
  check (form_kind in ('troupe', 'attori', 'regista', 'comparse'));

create or replace function public.get_form(p_token text)
returns table (production_title text, person_name text, fields jsonb, submitted_at timestamptz, appearance jsonb)
language sql stable security definer set search_path = '' as $$
  select l.production_title, l.person_name, l.fields, l.submitted_at,
    coalesce((
      -- L'aspetto del modulo della persona; se quel modulo non è mai stato modificato, quello della produzione.
      select coalesce(
        case when jsonb_typeof(p -> 'forms' -> l.form_kind -> 'appearance') = 'object' then p -> 'forms' -> l.form_kind -> 'appearance' end,
        case when jsonb_typeof(p -> 'formAppearance') = 'object' then p -> 'formAppearance' end)
      from public.app_state s, jsonb_array_elements(s.data -> 'productions') p
      where s.owner_id = l.owner_id and p ->> 'id' = l.production_id
      limit 1), '{}'::jsonb)
  from public.form_links l
  where l.token = p_token and l.expires_at > now();
$$;

revoke all on function public.get_form(text) from public;
grant execute on function public.get_form(text) to anon, authenticated;
