-- Aspetto del modulo pubblico: link al documento da leggere, copertina e logo.
-- Le impostazioni stanno nella produzione (app_state.data.productions[].formAppearance):
-- get_form le legge da lì, così valgono anche per i link già inviati.

-- Immagini di copertina e logo: pubbliche in lettura (le vede chi apre il modulo, senza account),
-- scrivibili solo dal proprietario nella sua cartella. Documenti e firme restano nei bucket privati.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "branding: owner folder" on storage.objects;
create policy "branding: owner folder" on storage.objects
  for all to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'branding' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Cambia il tipo restituito: va ricreata.
drop function if exists public.get_form(text);
create function public.get_form(p_token text)
returns table (production_title text, person_name text, fields jsonb, submitted_at timestamptz, appearance jsonb)
language sql stable security definer set search_path = '' as $$
  select l.production_title, l.person_name, l.fields, l.submitted_at,
    coalesce((
      select jsonb_build_object(
        'documentLabel', p -> 'formAppearance' ->> 'documentLabel',
        'documentUrl', p -> 'formAppearance' ->> 'documentUrl',
        'coverUrl', p -> 'formAppearance' ->> 'coverUrl',
        'logoUrl', p -> 'formAppearance' ->> 'logoUrl')
      from public.app_state s, jsonb_array_elements(s.data -> 'productions') p
      where s.owner_id = l.owner_id and p ->> 'id' = l.production_id
      limit 1), '{}'::jsonb)
  from public.form_links l
  where l.token = p_token and l.expires_at > now();
$$;

revoke all on function public.get_form(text) from public;
grant execute on function public.get_form(text) to anon, authenticated;
