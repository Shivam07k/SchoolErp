/* ═══════════════════════════════════════════════════════════════════════
   14 — Dashboard / menu / dynamic-page builder: storage functions.

   Only storage lives here. The *execution* of a user-defined report query
   is deliberately not a PL/pgSQL function: it is dynamic SQL assembled in
   server/src/routes/dash.js and bound with parameters through execQ, because
   a query builder has to build its text at request time.

   Every function returns the project's usual ("status", "message") shape so
   the routes can report failures without inspecting row shapes.
   ═══════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────── pages ─────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.sp_dash_page_list()
RETURNS TABLE("Slug" text, "Title" text, "Description" text, "Kind" text,
              "IsHome" boolean, "Layout" jsonb, "Style" jsonb, "SortOrder" integer,
              "Widgets" integer, "UpdatedAt" timestamptz)
LANGUAGE plpgsql AS $fn$
BEGIN
  RETURN QUERY
    SELECT p.slug, p.title, p.description, p.kind, p.is_home, p.layout, p.style,
           p.sort_order,
           (SELECT count(*)::int FROM public.dash_widget w WHERE w.page_id = p.id),
           p.updated_at
      FROM public.dash_page p
     ORDER BY p.sort_order, p.id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_page_save(
  p_slug text, p_title text, p_description text, p_kind text,
  p_is_home boolean, p_layout text, p_style text, p_sort integer, p_user text)
RETURNS TABLE("status" text, "message" text, "Id" bigint)
LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint;
BEGIN
  IF p_slug IS NULL OR btrim(p_slug) !~ '^[A-Za-z0-9_\-]{1,64}$' THEN
    RETURN QUERY SELECT 'error', 'Page id must be letters, digits, - or _ (max 64)', NULL::bigint; RETURN;
  END IF;
  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RETURN QUERY SELECT 'error', 'Page title is required', NULL::bigint; RETURN;
  END IF;

  INSERT INTO public.dash_page (slug, title, description, kind, is_home, layout, style, sort_order, created_by, updated_at)
  VALUES (btrim(p_slug), btrim(p_title), coalesce(p_description,''), coalesce(nullif(p_kind,''),'page'),
          coalesce(p_is_home,false), coalesce(p_layout,'{}')::jsonb, coalesce(p_style,'{}')::jsonb,
          coalesce(p_sort,0), coalesce(nullif(p_user,''),'ADMIN'), now())
  ON CONFLICT ((lower(slug))) DO UPDATE
     SET title = EXCLUDED.title, description = EXCLUDED.description, kind = EXCLUDED.kind,
         is_home = EXCLUDED.is_home, layout = EXCLUDED.layout, style = EXCLUDED.style,
         sort_order = EXCLUDED.sort_order, updated_at = now()
  RETURNING dash_page.id INTO v_id;

  /* Exactly one home page. */
  IF coalesce(p_is_home,false) THEN
    UPDATE public.dash_page SET is_home = false WHERE id <> v_id;
  END IF;

  RETURN QUERY SELECT 'ok', 'Saved', v_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_page_delete(p_slug text)
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint; v_home boolean;
BEGIN
  SELECT id, is_home INTO v_id, v_home FROM public.dash_page WHERE lower(slug) = lower(coalesce(p_slug,'')) LIMIT 1;
  IF v_id IS NULL THEN
    RETURN QUERY SELECT 'error', 'Page not found'; RETURN;
  END IF;
  IF v_home THEN
    RETURN QUERY SELECT 'error', 'This is the home dashboard and cannot be deleted'; RETURN;
  END IF;
  DELETE FROM public.dash_page WHERE id = v_id;
  RETURN QUERY SELECT 'ok', 'Deleted';
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_page_get(p_slug text)
RETURNS TABLE("Id" bigint, "slug" text, "title" text, "description" text, "kind" text,
              "is_home" boolean, "layout" jsonb, "style" jsonb, "sort_order" integer,
              "widgets" jsonb, "updated_at" timestamptz)
LANGUAGE plpgsql AS $fn$
BEGIN
  RETURN QUERY
    SELECT p.id, p.slug, p.title, p.description, p.kind, p.is_home, p.layout, p.style,
           p.sort_order,
           COALESCE((SELECT jsonb_agg(jsonb_build_object(
                      'id', w.id, 'name', w.name, 'chartType', w.chart_type,
                      'layout', w.layout, 'query', w.query, 'style', w.style,
                      'sortOrder', w.sort_order) ORDER BY w.sort_order, w.id)
                     FROM public.dash_widget w WHERE w.page_id = p.id), '[]'::jsonb),
           p.updated_at
      FROM public.dash_page p
     WHERE lower(p.slug) = lower(coalesce(p_slug,''))
     LIMIT 1;
END $fn$;

/* ─────────────────────────── widgets ───────────────────────────────── */

CREATE OR REPLACE FUNCTION public.sp_dash_widget_list(p_page_slug text)
RETURNS TABLE("Id" bigint, "page_slug" text, "name" text, "chart_type" text,
              "layout" jsonb, "query" jsonb, "style" jsonb, "sort_order" integer)
LANGUAGE plpgsql AS $fn$
BEGIN
  RETURN QUERY
    SELECT w.id, p.slug, w.name, w.chart_type, w.layout, w.query, w.style, w.sort_order
      FROM public.dash_widget w
      JOIN public.dash_page p ON p.id = w.page_id
     WHERE coalesce(btrim(p_page_slug), '') = ''
        OR lower(p.slug) = lower(btrim(p_page_slug))
     ORDER BY w.sort_order, w.id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_widget_save(
  p_page_slug text, p_id bigint, p_name text, p_chart_type text,
  p_layout text, p_query text, p_style text, p_sort integer)
RETURNS TABLE("status" text, "message" text, "Id" bigint)
LANGUAGE plpgsql AS $fn$
DECLARE v_page bigint; v_id bigint;
BEGIN
  SELECT id INTO v_page FROM public.dash_page WHERE lower(slug) = lower(coalesce(p_page_slug,'')) LIMIT 1;
  IF v_page IS NULL THEN
    RETURN QUERY SELECT 'error', 'Page not found', NULL::bigint; RETURN;
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN QUERY SELECT 'error', 'Widget needs a name', NULL::bigint; RETURN;
  END IF;

  IF p_id IS NOT NULL AND p_id > 0 THEN
    UPDATE public.dash_widget
       SET name = btrim(p_name), chart_type = coalesce(nullif(p_chart_type,''),'kpi'),
           layout = coalesce(p_layout,'{}')::jsonb, query = coalesce(p_query,'{}')::jsonb,
           style = coalesce(p_style,'{}')::jsonb, sort_order = coalesce(p_sort,0), updated_at = now()
     WHERE id = p_id AND page_id = v_page
    RETURNING dash_widget.id INTO v_id;
    IF v_id IS NULL THEN
      RETURN QUERY SELECT 'error', 'Widget not found on this page', NULL::bigint; RETURN;
    END IF;
  ELSE
    INSERT INTO public.dash_widget (page_id, name, chart_type, layout, query, style, sort_order)
    VALUES (v_page, btrim(p_name), coalesce(nullif(p_chart_type,''),'kpi'),
            coalesce(p_layout,'{}')::jsonb, coalesce(p_query,'{}')::jsonb,
            coalesce(p_style,'{}')::jsonb, coalesce(p_sort,0))
    RETURNING dash_widget.id INTO v_id;
  END IF;

  RETURN QUERY SELECT 'ok', 'Saved', v_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_widget_delete(p_id bigint)
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
BEGIN
  IF p_id IS NULL OR p_id <= 0 THEN
    RETURN QUERY SELECT 'error', 'Invalid widget id'; RETURN;
  END IF;
  DELETE FROM public.dash_widget WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'error', 'Widget not found'; RETURN;
  END IF;
  RETURN QUERY SELECT 'ok', 'Deleted';
END $fn$;

/* ─────────────────────────── menu sets ─────────────────────────────── */

CREATE OR REPLACE FUNCTION public.sp_dash_menu_set_list()
RETURNS TABLE("Id" bigint, "name" text, "description" text, "is_active" boolean,
              "is_available" boolean, "created_by" text, "updated_at" timestamptz,
              "items" integer)
LANGUAGE plpgsql AS $fn$
BEGIN
  RETURN QUERY
    SELECT s.id, s.name, s.description, s.is_active, s.is_available,
           s.created_by, s.updated_at,
           (SELECT count(*)::int FROM public.dash_menu_item i WHERE i.set_id = s.id)
      FROM public.dash_menu_set s
     ORDER BY s.is_active DESC, s.id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_menu_set_save(
  p_id bigint, p_name text, p_description text, p_is_active boolean,
  p_user text, p_is_available boolean DEFAULT true)
RETURNS TABLE("status" text, "message" text, "Id" bigint)
LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint; v_avail boolean := coalesce(p_is_available, true);
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN QUERY SELECT 'error', 'Menu name is required', NULL::bigint; RETURN;
  END IF;

  /* One default menu at a time. The others have to be cleared BEFORE this row is
     marked active: the partial unique index ux_dash_menu_set_active would
     otherwise trip on our own update and abort the whole save. */
  IF coalesce(p_is_active,false) AND v_avail THEN
    IF p_id IS NOT NULL AND p_id > 0 THEN
      UPDATE public.dash_menu_set SET is_active = false
       WHERE id <> p_id AND is_active;
    ELSE
      UPDATE public.dash_menu_set SET is_active = false WHERE is_active;
    END IF;
  END IF;

  IF p_id IS NOT NULL AND p_id > 0 THEN
    UPDATE public.dash_menu_set
       SET name = btrim(p_name), description = coalesce(p_description,''),
           is_active = coalesce(p_is_active,false) AND v_avail,
           is_available = v_avail, updated_at = now()
     WHERE id = p_id
    RETURNING dash_menu_set.id INTO v_id;
    IF v_id IS NULL THEN
      RETURN QUERY SELECT 'error', 'Menu not found', NULL::bigint; RETURN;
    END IF;
  ELSE
    INSERT INTO public.dash_menu_set
      (name, description, is_active, is_available, created_by)
    VALUES (btrim(p_name), coalesce(p_description,''),
            coalesce(p_is_active,false) AND v_avail, v_avail,
            coalesce(nullif(p_user,''),'ADMIN'))
    RETURNING dash_menu_set.id INTO v_id;
  END IF;

  /* Anyone pointing at a menu that is no longer offered goes back to the
     default instead of silently seeing nothing. */
  DELETE FROM public.dash_menu_user_choice uc
   WHERE NOT EXISTS (SELECT 1 FROM public.dash_menu_set ms
                      WHERE ms.id = uc.set_id AND ms.is_available);

  RETURN QUERY SELECT 'ok', 'Saved', v_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_menu_set_delete(p_id bigint)
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
BEGIN
  IF p_id IS NULL OR p_id <= 0 THEN
    RETURN QUERY SELECT 'error', 'Invalid menu id'; RETURN;
  END IF;
  DELETE FROM public.dash_menu_set WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'error', 'Menu not found'; RETURN;
  END IF;
  RETURN QUERY SELECT 'ok', 'Deleted';
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_menu_item_list(p_set_id bigint)
RETURNS TABLE("Id" bigint, "set_id" bigint, "parent_id" bigint, "label" text, "icon" text,
              "kind" text, "target" text, "open_new" boolean, "color" text,
              "sort_order" integer, "visible" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
  RETURN QUERY
    SELECT i.id, i.set_id, i.parent_id, i.label, i.icon, i.kind, i.target,
           i.open_new, i.color, i.sort_order, i.visible
      FROM public.dash_menu_item i
     WHERE i.set_id = p_set_id
     ORDER BY i.sort_order, i.id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_menu_item_save(
  p_set_id bigint, p_id bigint, p_parent_id bigint, p_label text, p_icon text,
  p_kind text, p_target text, p_open_new boolean, p_color text, p_sort integer, p_visible boolean)
RETURNS TABLE("status" text, "message" text, "Id" bigint)
LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint;
BEGIN
  IF p_set_id IS NULL OR p_set_id <= 0 THEN
    RETURN QUERY SELECT 'error', 'Invalid menu', NULL::bigint; RETURN;
  END IF;
  IF p_label IS NULL OR btrim(p_label) = '' THEN
    RETURN QUERY SELECT 'error', 'Item needs a label', NULL::bigint; RETURN;
  END IF;
  /* A cycle here would make the sidebar recurse forever. */
  IF p_parent_id IS NOT NULL AND p_id IS NOT NULL AND p_id > 0 AND p_parent_id = p_id THEN
    RETURN QUERY SELECT 'error', 'An item cannot be its own parent', NULL::bigint; RETURN;
  END IF;

  IF p_id IS NOT NULL AND p_id > 0 THEN
    UPDATE public.dash_menu_item
       SET parent_id = p_parent_id, label = btrim(p_label), icon = coalesce(nullif(p_icon,''),'bi-folder'),
           kind = coalesce(nullif(p_kind,''),'link'), target = coalesce(p_target,''),
           open_new = coalesce(p_open_new,true), color = coalesce(p_color,''),
           sort_order = coalesce(p_sort,0), visible = coalesce(p_visible,true)
     WHERE id = p_id AND set_id = p_set_id
    RETURNING dash_menu_item.id INTO v_id;
    IF v_id IS NULL THEN
      RETURN QUERY SELECT 'error', 'Item not found in this menu', NULL::bigint; RETURN;
    END IF;
  ELSE
    INSERT INTO public.dash_menu_item
      (set_id, parent_id, label, icon, kind, target, open_new, color, sort_order, visible)
    VALUES (p_set_id, p_parent_id, btrim(p_label), coalesce(nullif(p_icon,''),'bi-folder'),
            coalesce(nullif(p_kind,''),'link'), coalesce(p_target,''), coalesce(p_open_new,true),
            coalesce(p_color,''), coalesce(p_sort,0), coalesce(p_visible,true))
    RETURNING dash_menu_item.id INTO v_id;
  END IF;

  RETURN QUERY SELECT 'ok', 'Saved', v_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_menu_item_delete(p_id bigint)
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
BEGIN
  IF p_id IS NULL OR p_id <= 0 THEN
    RETURN QUERY SELECT 'error', 'Invalid item id'; RETURN;
  END IF;
  /* parent_id is ON DELETE CASCADE, so children go with it. */
  DELETE FROM public.dash_menu_item WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'error', 'Item not found'; RETURN;
  END IF;
  RETURN QUERY SELECT 'ok', 'Deleted';
END $fn$;

/* Rewrite a whole menu in one go.

   Dragging a link around touches its parent and the sort order of everything it
   passes, so saving a single row at a time would leave the menu in a half-moved
   state if the browser lost connection halfway. This takes the finished tree as
   a jsonb array and rewrites the set atomically, so a menu is either exactly
   what was dragged or exactly what it was before.

   The array is flat, in display order, with each row naming its parent by the
   "key" its own row uses, so the order rows arrive in is the order they are
   displayed in. */
CREATE OR REPLACE FUNCTION public.sp_dash_menu_item_replace(
  p_set_id bigint, p_items jsonb)
RETURNS TABLE("status" text, "message" text, "count" integer)
LANGUAGE plpgsql AS $fn$
DECLARE
  v_row    jsonb;
  v_i      integer;
  v_key    text;
  v_parent text;
  v_key_id bigint;
  v_ids    jsonb := '{}'::jsonb;
  v_new    bigint[] := ARRAY[]::bigint[];
  v_n      integer := 0;
BEGIN
  IF p_set_id IS NULL OR p_set_id <= 0 THEN
    RETURN QUERY SELECT 'error', 'Invalid menu set', 0; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dash_menu_set WHERE id = p_set_id) THEN
    RETURN QUERY SELECT 'error', 'Menu set not found', 0; RETURN;
  END IF;
  IF p_items IS NULL OR p_items = '[]'::jsonb THEN
    DELETE FROM public.dash_menu_item WHERE set_id = p_set_id;
    RETURN QUERY SELECT 'ok', 'Menu saved', 0; RETURN;
  END IF;
  IF jsonb_typeof(p_items) <> 'array' THEN
    RETURN QUERY SELECT 'error', 'Items must be a list', 0; RETURN;
  END IF;

  /* Check every key before writing anything, so a payload with a mistake in it
     is refused whole rather than writing the rows that happened to come first. */
  SELECT e.value INTO v_row
    FROM jsonb_array_elements(p_items) e
   WHERE coalesce(e.value->>'key', e.value->>'Key', '') = ''
   LIMIT 1;
  IF v_row IS NOT NULL THEN
    RETURN QUERY SELECT 'error', 'Every link needs a key', 0; RETURN;
  END IF;

  SELECT e.value->>'key' INTO v_key
    FROM jsonb_array_elements(p_items) e
   GROUP BY e.value->>'key'
  HAVING count(*) > 1
   LIMIT 1;
  IF v_key IS NOT NULL THEN
    RETURN QUERY SELECT 'error', 'Duplicate item key: ' || v_key, 0; RETURN;
  END IF;

  /* Two passes, because a child can be listed before its parent. Pass one
     inserts every row and remembers the id each key ended up with; pass two
     points each row at its parent. */
  FOR v_i IN 1 .. jsonb_array_length(p_items) LOOP
    v_row := p_items -> (v_i - 1);
    v_key := coalesce(v_row->>'key', v_row->>'Key', '');
    IF v_key = '' THEN CONTINUE; END IF;

    v_key_id := NULL;
    INSERT INTO public.dash_menu_item
      (set_id, parent_id, label, icon, kind, target, open_new, color, sort_order, visible)
    VALUES (
      p_set_id,
      NULL,
      coalesce(nullif(btrim(v_row->>'label'), ''), 'Link'),
      coalesce(nullif(v_row->>'icon', ''), 'bi-folder'),
      coalesce(nullif(v_row->>'kind', ''), 'link'),
      coalesce(v_row->>'target', ''),
      coalesce((v_row->>'openNew')::boolean, true),
      coalesce(v_row->>'color', ''),
      coalesce((v_row->>'sort')::integer, v_n),
      coalesce((v_row->>'visible')::boolean, true))
    RETURNING dash_menu_item.id INTO v_key_id;

    v_ids := v_ids || jsonb_build_object(v_key, v_key_id::text);
    v_new := v_new || v_key_id;
    v_n := v_n + 1;
  END LOOP;

  FOR v_i IN 1 .. jsonb_array_length(p_items) LOOP
    v_row := p_items -> (v_i - 1);
    v_key    := coalesce(v_row->>'key', v_row->>'Key', '');
    v_parent := coalesce(nullif(v_row->>'parent', ''), nullif(v_row->>'parentKey', ''), '');
    CONTINUE WHEN v_key = '' OR v_parent = '' OR v_parent = v_key;
    /* An unknown parent means the child is dropped to the top level rather than
       rejected: one bad key should not cost somebody their whole menu. */
    UPDATE public.dash_menu_item
       SET parent_id = (v_ids ->> v_parent)::bigint
     WHERE id = (v_ids ->> v_key)::bigint
       AND (v_ids ? v_parent);
  END LOOP;

  /* Anything no longer in the tree is removed. parent_id cascades, so this also
     clears anything left hanging under a removed section. */
  DELETE FROM public.dash_menu_item
   WHERE set_id = p_set_id
     AND NOT (id = ANY (v_new));

  RETURN QUERY SELECT 'ok', 'Menu saved', v_n;
END $fn$;

/* Everything that has been pinned to a set. Powers the Assign dialog. */
CREATE OR REPLACE FUNCTION public.sp_dash_menu_assignment_list(p_set_id bigint)
RETURNS TABLE("Id" bigint, "SetId" bigint, "SubjectType" text, "SubjectId" text,
              "Name" text, "CreatedAt" timestamptz)
LANGUAGE plpgsql STABLE AS $fn$
BEGIN
  RETURN QUERY
    SELECT a.id, a.set_id, a.subject_type, a.subject_id,
           coalesce(nullif(btrim(a.subject_id),''), 'Everyone'),
           a.created_at
      FROM public.dash_menu_assignment a
     WHERE a.set_id = coalesce(p_set_id, 0)
     ORDER BY a.subject_type, lower(a.subject_id);
END $fn$;

/* Pin a set to a person, a group or everybody. A person can only be pinned to
   one set at a time, so re-pinning moves them rather than stacking up rows. */
CREATE OR REPLACE FUNCTION public.sp_dash_menu_assign(
  p_set_id bigint, p_subject_type text, p_subject_id text, p_user text)
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_type text := lower(btrim(coalesce(p_subject_type,'user')));
  v_subj text := btrim(coalesce(p_subject_id,''));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dash_menu_set WHERE id = p_set_id) THEN
    RETURN QUERY SELECT 'error', 'Menu not found'; RETURN;
  END IF;
  IF v_type NOT IN ('user','group','all') THEN
    RETURN QUERY SELECT 'error', 'Choose a person, a group or everyone'; RETURN;
  END IF;
  IF v_type IN ('user','group') AND v_subj = '' THEN
    RETURN QUERY SELECT 'error', 'Nothing was chosen'; RETURN;
  END IF;

  IF v_type = 'user' THEN
    /* a person has one menu: the new choice replaces the old one */
    DELETE FROM public.dash_menu_assignment WHERE subject_type = 'user' AND subject_id = v_subj;
  ELSIF v_type = 'group' THEN
    /* A group has one menu too, so this replaces any other menu the group was
       given. Leaving both would leave the resolver to pick one at random, and
       the person administering this would have no way to tell which. */
    DELETE FROM public.dash_menu_assignment
     WHERE subject_type = 'group' AND subject_id = v_subj;
    /* membership moves too: a person moved into the group now follows the
       group, and no longer keeps the copy that was pinned to them directly.
       Groups are named for people to recognise, so match on GrpName. The
       alias cannot be used in a DELETE's WHERE, so the real table is named. */
    DELETE FROM public.dash_menu_assignment
     WHERE public.dash_menu_assignment.subject_type = 'user'
       AND lower(public.dash_menu_assignment.subject_id) IN (
             SELECT lower(m."UserId") FROM public."tblSecUserGrp" m
               JOIN public."tblSecGroup" g ON g."GrpId" = m."GrpId"
              WHERE lower(g."GrpName") = lower(v_subj));
  ELSE
    /* Likewise there is only ever one menu for everyone. */
    DELETE FROM public.dash_menu_assignment WHERE subject_type = 'all';
  END IF;

  INSERT INTO public.dash_menu_assignment (set_id, subject_type, subject_id, created_by)
  VALUES (p_set_id, v_type, CASE WHEN v_type = 'all' THEN '' ELSE v_subj END,
          coalesce(nullif(p_user,''),'ADMIN'))
  ON CONFLICT (set_id, subject_type, subject_id) DO NOTHING;

  RETURN QUERY SELECT 'ok', 'Assigned';
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_menu_unassign(p_id bigint)
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dash_menu_assignment WHERE id = p_id) THEN
    RETURN QUERY SELECT 'error', 'Not found'; RETURN;
  END IF;
  DELETE FROM public.dash_menu_assignment WHERE id = p_id;
  RETURN QUERY SELECT 'ok', 'Removed';
END $fn$;

/* Which menu set a person sees, most specific wins:
     1. pinned to them directly
     2. pinned to a group they belong to
     3. pinned to everybody
     4. their own choice, if that set is still available
     5. the single active (default) set
   The candidates are tried in that order and the first one that actually has
   something to show wins. A set with no visible items is skipped rather than
   honoured, because an empty menu is indistinguishable from a broken one to
   the person looking at it: a stale saved choice pointing at an empty set used
   to blank the whole sidebar with no way to tell why. Returns nothing when no
   candidate has content, and the caller keeps the original menu. */
CREATE OR REPLACE FUNCTION public.sp_dash_menu_resolve(p_user text, p_grp text DEFAULT NULL)
RETURNS TABLE("SetId" bigint, "Name" text, "IsUserChoice" boolean, "Reason" text)
LANGUAGE plpgsql STABLE AS $fn$
DECLARE
  c record;
  v_uid text := btrim(coalesce(p_user, ''));
  v_why text;
  v_own boolean;
BEGIN
  FOR c IN
    SELECT * FROM (
      /* 1. pinned to this person */
      SELECT 1 AS prio, a.set_id AS set_id, false AS own, 'assigned to you'::text AS why
        FROM public.dash_menu_assignment a
       WHERE a.subject_type = 'user' AND v_uid <> ''
         AND lower(a.subject_id) = lower(v_uid)
      UNION ALL
      /* 2. pinned to a group. The membership table is the authority: a person's
            GRP column is free text and may name a group, several, or none. */
      SELECT 2, a.set_id, false, 'assigned to group ' || a.subject_id
        FROM public.dash_menu_assignment a
       WHERE a.subject_type = 'group' AND v_uid <> ''
         AND lower(a.subject_id) IN (
               SELECT lower(g."GrpName") FROM public."tblSecUserGrp" m
                 JOIN public."tblSecGroup" g ON g."GrpId" = m."GrpId"
                WHERE lower(m."UserId") = lower(v_uid))
      UNION ALL
      /* the group the caller already knows about, for callers that resolved it */
      SELECT 3, a.set_id, false, 'assigned to group ' || a.subject_id
        FROM public.dash_menu_assignment a
       WHERE a.subject_type = 'group' AND btrim(coalesce(p_grp,'')) <> ''
         AND lower(a.subject_id) = lower(btrim(p_grp))
      UNION ALL
      /* 3. pinned to everybody */
      SELECT 4, a.set_id, false, 'assigned to everyone'
        FROM public.dash_menu_assignment a
       WHERE a.subject_type = 'all'
      UNION ALL
      /* 4. the person's own pick, only while that set is still offered */
      SELECT 5, uc.set_id, true, 'your own choice'
        FROM public.dash_menu_user_choice uc
        JOIN public.dash_menu_set ms ON ms.id = uc.set_id AND ms.is_available
       WHERE v_uid <> '' AND uc.userid = v_uid
      UNION ALL
      /* 5. the company default */
      SELECT 6, s.id, false, 'company default'
        FROM public.dash_menu_set s
       WHERE s.is_active AND s.is_available
    ) cand
   ORDER BY cand.prio ASC, cand.set_id ASC
  LOOP
    /* Only a set with something visible in it may win. */
    IF NOT EXISTS (SELECT 1 FROM public.dash_menu_item m
                    WHERE m.set_id = c.set_id AND m.visible) THEN
      CONTINUE;
    END IF;
    v_own := coalesce(c.own, false);
    v_why := coalesce(c.why, 'default');
    RETURN QUERY
      SELECT c.set_id, s.name, v_own, v_why
        FROM public.dash_menu_set s WHERE s.id = c.set_id;
    RETURN;
  END LOOP;
  RETURN;                           -- nothing to show: caller keeps the normal menu
END $fn$;

/* Remember (or clear) a person's menu choice. Clearing means "fall back to the
   active menu". Choices pointing at a set that is later withdrawn are ignored,
   and removed outright by sp_dash_menu_set_save. */
CREATE OR REPLACE FUNCTION public.sp_dash_menu_select(
  p_set_id bigint, p_user text)
RETURNS TABLE("status" text, "message" text, "Id" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
  IF p_user IS NULL OR btrim(p_user) = '' THEN
    RETURN QUERY SELECT 'error', 'A user is required', NULL::bigint;
    RETURN;
  END IF;
  IF p_set_id IS NULL THEN
    DELETE FROM public.dash_menu_user_choice WHERE userid = p_user;
    RETURN QUERY SELECT 'ok', 'Using the default menu', NULL::bigint;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dash_menu_set
                  WHERE id = p_set_id AND is_available) THEN
    RETURN QUERY SELECT 'error', 'That menu is not available', NULL::bigint;
    RETURN;
  END IF;
  INSERT INTO public.dash_menu_user_choice (userid, set_id)
  VALUES (p_user, p_set_id)
  ON CONFLICT (userid) DO UPDATE
    SET set_id = EXCLUDED.set_id, updated_at = now();
  RETURN QUERY SELECT 'ok', 'Menu selected', p_set_id;
END $fn$;

/* The menu rows the sidebar renders, flat and in display order, with a depth
   so the client can nest them to any level. */
CREATE OR REPLACE FUNCTION public.sp_dash_menu_tree(
  p_user text DEFAULT NULL, p_grp text DEFAULT NULL)
RETURNS TABLE("Id" bigint, "ParentId" bigint, "SetId" bigint, "Label" text,
              "Icon" text, "Kind" text, "Target" text, "OpenNew" boolean,
              "Color" text, "SortOrder" integer, "Depth" integer, "SortPath" text)
LANGUAGE plpgsql STABLE AS $fn$
DECLARE v_set bigint;
BEGIN
  SELECT r."SetId" INTO v_set FROM public.sp_dash_menu_resolve(p_user, p_grp) r LIMIT 1;
  IF v_set IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    WITH RECURSIVE t AS (
      SELECT m.id, m.parent_id, m.set_id, m.label, m.icon, m.kind, m.target,
             m.open_new, m.color, m.sort_order, 0 AS depth,
             lpad(m.sort_order::text, 7, '0') || '.' || lpad(m.id::text, 12, '0') AS sort_path,
             ARRAY[m.id] AS chain
        FROM public.dash_menu_item m
       WHERE m.set_id = v_set AND m.visible AND m.parent_id IS NULL
      UNION ALL
      SELECT c.id, c.parent_id, c.set_id, c.label, c.icon, c.kind, c.target,
             c.open_new, c.color, c.sort_order, t.depth + 1,
             t.sort_path || '>' || lpad(c.sort_order::text, 7, '0')
                            || '.' || lpad(c.id::text, 12, '0'),
             t.chain || c.id
        FROM public.dash_menu_item c
        JOIN t ON c.parent_id = t.id
       WHERE c.set_id = v_set AND c.visible
         AND NOT (c.id = ANY (t.chain))    -- a bad parent cycle must not hang the menu
    )
    SELECT t.id, t.parent_id, t.set_id, t.label, t.icon, t.kind, t.target,
           t.open_new, t.color, t.sort_order, t.depth, t.sort_path
      FROM t
     ORDER BY t.sort_path;
END $fn$;

/* ─────────────────────────── dashboard links ───────────────────────── */

CREATE OR REPLACE FUNCTION public.sp_dash_link_list()
RETURNS TABLE("Id" bigint, "section" text, "label" text, "icon" text, "kind" text,
              "target" text, "open_new" boolean, "color" text,
              "sort_order" integer, "visible" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
  RETURN QUERY
    SELECT l.id, l.section, l.label, l.icon, l.kind, l.target, l.open_new,
           l.color, l.sort_order, l.visible
      FROM public.dash_link l
     ORDER BY l.section, l.sort_order, l.id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_link_save(
  p_id bigint, p_section text, p_label text, p_icon text, p_kind text,
  p_target text, p_open_new boolean, p_color text, p_sort integer, p_visible boolean)
RETURNS TABLE("status" text, "message" text, "Id" bigint)
LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint;
BEGIN
  IF p_label IS NULL OR btrim(p_label) = '' THEN
    RETURN QUERY SELECT 'error', 'Link needs a label', NULL::bigint; RETURN;
  END IF;
  IF p_id IS NOT NULL AND p_id > 0 THEN
    UPDATE public.dash_link
       SET section = coalesce(nullif(btrim(p_section),''),'General'), label = btrim(p_label),
           icon = coalesce(nullif(p_icon,''),'bi-link-45deg'), kind = coalesce(nullif(p_kind,''),'page'),
           target = coalesce(p_target,''), open_new = coalesce(p_open_new,true),
           color = coalesce(p_color,''), sort_order = coalesce(p_sort,0), visible = coalesce(p_visible,true)
     WHERE id = p_id
    RETURNING dash_link.id INTO v_id;
    IF v_id IS NULL THEN
      RETURN QUERY SELECT 'error', 'Link not found', NULL::bigint; RETURN;
    END IF;
  ELSE
    INSERT INTO public.dash_link (section, label, icon, kind, target, open_new, color, sort_order, visible)
    VALUES (coalesce(nullif(btrim(p_section),''),'General'), btrim(p_label),
            coalesce(nullif(p_icon,''),'bi-link-45deg'), coalesce(nullif(p_kind,''),'page'),
            coalesce(p_target,''), coalesce(p_open_new,true), coalesce(p_color,''),
            coalesce(p_sort,0), coalesce(p_visible,true))
    RETURNING dash_link.id INTO v_id;
  END IF;
  RETURN QUERY SELECT 'ok', 'Saved', v_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_link_delete(p_id bigint)
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
BEGIN
  IF p_id IS NULL OR p_id <= 0 THEN
    RETURN QUERY SELECT 'error', 'Invalid link id'; RETURN;
  END IF;
  DELETE FROM public.dash_link WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'error', 'Link not found'; RETURN;
  END IF;
  RETURN QUERY SELECT 'ok', 'Deleted';
END $fn$;

/* ─────────────────────────── dynamic pages ─────────────────────────── */

CREATE OR REPLACE FUNCTION public.sp_dyn_page_list()
RETURNS TABLE("Id" bigint, "slug" text, "title" text, "icon" text, "description" text,
              "mode" text, "style" jsonb, "sort_order" integer, "updated_at" timestamptz)
LANGUAGE plpgsql AS $fn$
BEGIN
  RETURN QUERY
    SELECT d.id, d.slug, d.title, d.icon, d.description, d.mode, d.style,
           d.sort_order, d.updated_at
      FROM public.dyn_page d
     ORDER BY d.sort_order, d.id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dyn_page_save(
  p_slug text, p_title text, p_icon text, p_description text, p_mode text,
  p_config text, p_style text, p_sort integer, p_user text)
RETURNS TABLE("status" text, "message" text, "Id" bigint)
LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint;
BEGIN
  IF p_slug IS NULL OR btrim(p_slug) !~ '^[A-Za-z0-9_\-]{1,64}$' THEN
    RETURN QUERY SELECT 'error', 'Page id must be letters, digits, - or _ (max 64)', NULL::bigint; RETURN;
  END IF;
  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RETURN QUERY SELECT 'error', 'Page title is required', NULL::bigint; RETURN;
  END IF;

  INSERT INTO public.dyn_page (slug, title, icon, description, mode, config, style, sort_order, created_by, updated_at)
  VALUES (btrim(p_slug), btrim(p_title), coalesce(nullif(p_icon,''),'bi-table'), coalesce(p_description,''),
          coalesce(nullif(p_mode,''),'builder'), coalesce(p_config,'{}')::jsonb, coalesce(p_style,'{}')::jsonb,
          coalesce(p_sort,0), coalesce(nullif(p_user,''),'ADMIN'), now())
  ON CONFLICT ((lower(slug))) DO UPDATE
     SET title = EXCLUDED.title, icon = EXCLUDED.icon, description = EXCLUDED.description,
         mode = EXCLUDED.mode, config = EXCLUDED.config, style = EXCLUDED.style,
         sort_order = EXCLUDED.sort_order, updated_at = now()
  RETURNING dyn_page.id INTO v_id;

  RETURN QUERY SELECT 'ok', 'Saved', v_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dyn_page_delete(p_slug text)
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
BEGIN
  DELETE FROM public.dyn_page WHERE lower(slug) = lower(coalesce(p_slug,''));
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'error', 'Page not found'; RETURN;
  END IF;
  /* Drop navigation entries that pointed at it so the sidebar cannot go stale. */
  DELETE FROM public.dash_link WHERE kind = 'page' AND lower(target) = lower(coalesce(p_slug,''));
  DELETE FROM public.dash_menu_item WHERE kind = 'page' AND lower(target) = lower(coalesce(p_slug,''));
  RETURN QUERY SELECT 'ok', 'Deleted';
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dyn_page_get(p_slug text)
RETURNS TABLE("Id" bigint, "slug" text, "title" text, "icon" text, "description" text,
              "mode" text, "config" jsonb, "style" jsonb, "sort_order" integer, "updated_at" timestamptz)
LANGUAGE plpgsql AS $fn$
BEGIN
  RETURN QUERY
    SELECT d.id, d.slug, d.title, d.icon, d.description, d.mode, d.config,
           d.style, d.sort_order, d.updated_at
      FROM public.dyn_page d
     WHERE lower(d.slug) = lower(coalesce(p_slug,''))
     LIMIT 1;
END $fn$;
