-- Tema del modulo pubblico (colori e sfondo): get_form restituisce tutto l'aspetto scelto
-- dalla produzione (formAppearance), così le prossime opzioni grafiche non richiedono migrazioni.
-- Stessa firma di prima: nessun drop, il modulo continua a funzionare durante l'aggiornamento.

create or replace function public.get_form(p_token text)
returns table (production_title text, person_name text, fields jsonb, submitted_at timestamptz, appearance jsonb)
language sql stable security definer set search_path = '' as $$
  select l.production_title, l.person_name, l.fields, l.submitted_at,
    coalesce((
      select case when jsonb_typeof(p -> 'formAppearance') = 'object' then p -> 'formAppearance' end
      from public.app_state s, jsonb_array_elements(s.data -> 'productions') p
      where s.owner_id = l.owner_id and p ->> 'id' = l.production_id
      limit 1), '{}'::jsonb)
  from public.form_links l
  where l.token = p_token and l.expires_at > now();
$$;

revoke all on function public.get_form(text) from public;
grant execute on function public.get_form(text) to anon, authenticated;
