-- Hardening DocuSet. NON applicata: da rivedere ed eseguire a mano.

-- (a) Un link accetta un solo invio: il secondo tentativo (anche con token
-- rubato) non puo' piu' sovrascrivere la risposta.
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
  if link.submitted_at is not null then
    raise exception 'already_submitted' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 100000 then
    raise exception 'invalid_data' using errcode = 'P0001';
  end if;

  insert into public.form_submissions (token, owner_id, production_id, person_id, data)
  values (p_token, link.owner_id, link.production_id, link.person_id, p_data)
  on conflict (token) do update set data = excluded.data, submitted_at = now();

  update public.form_links set submitted_at = now() where token = p_token;
  return now();
end $$;

revoke all on function public.submit_form(text, jsonb) from public;
grant execute on function public.submit_form(text, jsonb) to anon, authenticated;

-- (b) Revoca di un link: lo fa scadere subito. Solo il proprietario
-- (auth.uid()); non e' esposta ad anon.
create or replace function public.revoke_form_link(p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.form_links set expires_at = now()
  where token = p_token and owner_id = (select auth.uid());
  return found;
end $$;

revoke all on function public.revoke_form_link(text) from public;
revoke all on function public.revoke_form_link(text) from anon;
grant execute on function public.revoke_form_link(text) to authenticated;

-- (c) OPZIONALE, disattivato: retention 30 giorni delle risposte.
-- Richiede l'estensione pg_cron (Database > Extensions). Cancella solo le
-- righe di form_submissions; i file nel bucket 'submissions' vanno rimossi a
-- parte (la Storage API; un delete SQL su storage.objects lascia i blob).
-- Valutare prima: l'app potrebbe non aver ancora importato le risposte.
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'docuset-submissions-retention',
--   '17 3 * * *',
--   $$delete from public.form_submissions where submitted_at < now() - interval '30 days'$$
-- );
