-- Eliminazione di un account e di tutti i suoi dati, chiamata dalla pagina
-- "Gestione account DOCUSET" in Claude tramite il collegamento Supabase.
-- Il database mette in coda la richiesta e chiama la funzione edge
-- account-erasure, che cancella i file con la Storage API e poi l'utente
-- con la Auth API: le righe in public.* se ne vanno a cascata.
-- Nessuna di queste funzioni è raggiungibile dall'app (anon/authenticated).

create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.account_erasures (
  user_id uuid primary key,
  email text not null,
  status text not null default 'queued' check (status in ('queued', 'done', 'error')),
  error text,
  requested_at timestamptz not null default now(),
  done_at timestamptz
);

-- Segreto che autorizza la chiamata alla funzione edge: creato una volta, mai mostrato.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'docuset_erasure_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'docuset_erasure_secret', 'Bearer per la funzione edge account-erasure');
  end if;
end $$;

-- Cosa verrebbe cancellato, per la conferma nella pagina.
create or replace function private.admin_erasure_preview(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'produzioni', coalesce(jsonb_array_length(s.data -> 'productions'), 0),
    'persone', coalesce(jsonb_array_length(s.data -> 'people'), 0),
    'template', coalesce(jsonb_array_length(s.data -> 'templates'), 0),
    'moduli', (select count(*) from public.form_links l where l.owner_id = p_user),
    'risposte', (select count(*) from public.form_submissions f where f.owner_id = p_user),
    'file', (select count(*) from storage.objects o
             where (o.bucket_id = 'templates' and (storage.foldername(o.name))[1] = p_user::text)
                or (o.bucket_id = 'submissions' and (storage.foldername(o.name))[1] in (select token from public.form_links where owner_id = p_user))),
    'stato', (select e.status from private.account_erasures e where e.user_id = p_user)
  )
  from (select p_user as id) u
  left join public.app_state s on s.owner_id = u.id;
$$;

create or replace function private.admin_erase_account(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_secret text;
  v_files jsonb;
begin
  select email into v_email from auth.users where id = p_user;
  if v_email is null then
    if exists (select 1 from private.account_erasures where user_id = p_user and status = 'done') then
      return jsonb_build_object('status', 'gia_eliminato');
    end if;
    raise exception 'Account non trovato.';
  end if;

  select jsonb_build_object(
    'templates', coalesce(jsonb_agg(o.name) filter (where o.bucket_id = 'templates'), '[]'::jsonb),
    'submissions', coalesce(jsonb_agg(o.name) filter (where o.bucket_id = 'submissions'), '[]'::jsonb))
  into v_files
  from storage.objects o
  where (o.bucket_id = 'templates' and (storage.foldername(o.name))[1] = p_user::text)
     or (o.bucket_id = 'submissions' and (storage.foldername(o.name))[1] in (select token from public.form_links where owner_id = p_user));

  insert into private.account_erasures (user_id, email) values (p_user, v_email)
  on conflict (user_id) do update set status = 'queued', error = null, requested_at = now(), done_at = null;

  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'docuset_erasure_secret';
  perform net.http_post(
    url := 'https://fejuenyrxagnwjxzawtn.supabase.co/functions/v1/account-erasure',
    body := jsonb_build_object('user_id', p_user, 'files', v_files),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 20000);
  return jsonb_build_object('status', 'in_coda');
end $$;

-- La funzione edge confronta il Bearer ricevuto col segreto, senza mai leggerlo (solo service_role).
create or replace function public.account_erasure_check(p_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'docuset_erasure_secret' and decrypted_secret = p_token);
$$;

-- La funzione edge segna l'esito qui (solo service_role).
create or replace function public.account_erasure_result(p_user uuid, p_error text)
returns void language sql security definer set search_path = '' as $$
  update private.account_erasures
  set status = case when p_error is null then 'done' else 'error' end,
      error = p_error,
      done_at = case when p_error is null then now() end
  where user_id = p_user;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke execute on function public.account_erasure_result(uuid, text) from public, anon, authenticated;
revoke execute on function public.account_erasure_check(text) from public, anon, authenticated;
grant execute on function public.account_erasure_result(uuid, text) to service_role;
grant execute on function public.account_erasure_check(text) to service_role;
