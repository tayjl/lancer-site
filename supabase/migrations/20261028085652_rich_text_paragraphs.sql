-- Appearance, personality and traits now hold formatted text from the pilot page's editor
-- (TipTap's JSON document format) instead of plain text.
-- Any existing plain text becomes a single paragraph, so nothing is lost.

create function private.text_to_doc(plain text) returns jsonb
language sql immutable set search_path = ''
as $$
  select case
    when plain is null or plain = '' then null
    else jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(jsonb_build_object(
        'type', 'paragraph',
        'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', plain))
      ))
    )
  end;
$$;

alter table public.characters
  alter column appearance type jsonb using private.text_to_doc(appearance),
  alter column personality type jsonb using private.text_to_doc(personality),
  alter column traits type jsonb using private.text_to_doc(traits);

drop function private.text_to_doc(text);
