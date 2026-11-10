/* ═══════════════════════════════════════════════════════════════════════
   16 — Dashboard boards: shareable KPI / link dashboards.

   A board is to the dashboard what a menu set is to the sidebar: a named,
   internally-visible thing the Customize screen builds, that the company,
   a group or one person can be pinned to. Persisting it in the database,
   with the same assignment machinery the menus use, is what makes a board
   built once usable by everybody.

     dash_board             one named dashboard (an example: "Operations").
     dash_board_item        sections and the links / KPI cards inside them.
       kind='section'       a titled band; its style sets cols-per-row and a
                            default look for the cards inside it.
       kind='link'          a shortcut to a form, a dashboard page, a dynamic
                            page or a web address.
       kind='kpi'           a number (or small chart) built from a table via
                            the same query spec the widget builder produces.
       style                jsonb; sections carry {cols, itemStyle, ...}, items
                            carry their own look (link | box | card | chart).
     dash_board_user_choice      "your own" board, mirroring the menus.
     dash_board_assignment       who is pinned to a board (user | group | all).

   The resolver is a copy of the menu one with the same precedence, so the
   rules stay the same wherever a person looks for them.
   ═══════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS public.dash_board (
  id           bigserial   PRIMARY KEY,
  name         text        NOT NULL,
  description  text        NOT NULL DEFAULT '',
  is_active    boolean     NOT NULL DEFAULT false,
  is_available boolean     NOT NULL DEFAULT true,
  created_by   text        NOT NULL DEFAULT 'ADMIN',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
/* Only one board may be the whole company's default at a time. */
CREATE UNIQUE INDEX IF NOT EXISTS ux_dash_board_active
  ON public.dash_board ((true)) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.dash_board_item (
  id          bigserial   PRIMARY KEY,
  board_id    bigint      NOT NULL REFERENCES public.dash_board (id) ON DELETE CASCADE,
  parent_id   bigint      REFERENCES public.dash_board_item (id) ON DELETE CASCADE,
  kind        text        NOT NULL DEFAULT 'link',   -- section | link | kpi
  label       text        NOT NULL,
  icon        text        NOT NULL DEFAULT 'bi-link-45deg',
  color       text        NOT NULL DEFAULT '',
  chart_type  text        NOT NULL DEFAULT 'kpi',    -- what a kpi card renders as
  query       jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- builder spec (kpi)
  target      text        NOT NULL DEFAULT '',       -- form / page slug / url (link)
  open_new    boolean     NOT NULL DEFAULT true,
  style       jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- per-item / per-section look
  sort_order  integer     NOT NULL DEFAULT 0,
  visible     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_dash_board_item_board
  ON public.dash_board_item (board_id, parent_id, sort_order);

/* Whose own board. Same shape (and the same fallback rule) as the menus. */
CREATE TABLE IF NOT EXISTS public.dash_board_user_choice (
  userid     text        NOT NULL PRIMARY KEY,
  board_id   bigint      NOT NULL REFERENCES public.dash_board (id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

/* Who is pinned to a board. subject_type: user | group | all. */
CREATE TABLE IF NOT EXISTS public.dash_board_assignment (
  id           bigserial   PRIMARY KEY,
  board_id     bigint      NOT NULL REFERENCES public.dash_board (id) ON DELETE CASCADE,
  subject_type text        NOT NULL DEFAULT 'user',
  subject_id   text        NOT NULL DEFAULT '',
  created_by   text        NOT NULL DEFAULT 'ADMIN',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_dash_board_assignment
  ON public.dash_board_assignment (board_id, subject_type, subject_id);
CREATE INDEX IF NOT EXISTS ix_dash_board_assignment_subject
  ON public.dash_board_assignment (subject_type, subject_id);

/* ─────────────────────────── the board itself ─────────────────────────── */

CREATE OR REPLACE FUNCTION public.sp_dash_board_list()
RETURNS TABLE("Id" bigint, "name" text, "description" text, "is_active" boolean,
              "is_available" boolean, "created_by" text, "updated_at" timestamptz,
              "items" integer)
LANGUAGE plpgsql AS $fn$
BEGIN
  RETURN QUERY
    SELECT b.id, b.name, b.description, b.is_active, b.is_available,
           b.created_by, b.updated_at,
           (SELECT count(*)::int FROM public.dash_board_item i WHERE i.board_id = b.id)
      FROM public.dash_board b
     ORDER BY b.is_active DESC, b.id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_board_save(
  p_id bigint, p_name text, p_description text, p_is_active boolean,
  p_user text, p_is_available boolean DEFAULT true)
RETURNS TABLE("status" text, "message" text, "Id" bigint)
LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint; v_avail boolean := coalesce(p_is_available, true);
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN QUERY SELECT 'error', 'Board name is required', NULL::bigint; RETURN;
  END IF;

  /* One default board at a time. Clear the others before marking this one, or
     the partial unique index would trip on our own update. */
  IF coalesce(p_is_active,false) AND v_avail THEN
    IF p_id IS NOT NULL AND p_id > 0 THEN
      UPDATE public.dash_board SET is_active = false
       WHERE id <> p_id AND is_active;
    ELSE
      UPDATE public.dash_board SET is_active = false WHERE is_active;
    END IF;
  END IF;

  IF p_id IS NOT NULL AND p_id > 0 THEN
    UPDATE public.dash_board
       SET name = btrim(p_name), description = coalesce(p_description,''),
           is_active = coalesce(p_is_active,false) AND v_avail,
           is_available = v_avail, updated_at = now()
     WHERE id = p_id
    RETURNING dash_board.id INTO v_id;
    IF v_id IS NULL THEN
      RETURN QUERY SELECT 'error', 'Board not found', NULL::bigint; RETURN;
    END IF;
  ELSE
    INSERT INTO public.dash_board
      (name, description, is_active, is_available, created_by)
    VALUES (btrim(p_name), coalesce(p_description,''),
            coalesce(p_is_active,false) AND v_avail, v_avail,
            coalesce(nullif(p_user,''),'ADMIN'))
    RETURNING dash_board.id INTO v_id;
  END IF;

  /* A choice pointing at a board that is no longer offered is dropped so the
     resolver falls back to the default instead of silently nothing. */
  DELETE FROM public.dash_board_user_choice uc
   WHERE NOT EXISTS (SELECT 1 FROM public.dash_board b
                      WHERE b.id = uc.board_id AND b.is_available);

  RETURN QUERY SELECT 'ok', 'Saved', v_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_board_delete(p_id bigint)
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
BEGIN
  IF p_id IS NULL OR p_id <= 0 THEN
    RETURN QUERY SELECT 'error', 'Invalid board id'; RETURN;
  END IF;
  DELETE FROM public.dash_board WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'error', 'Board not found'; RETURN;
  END IF;
  RETURN QUERY SELECT 'ok', 'Deleted';
END $fn$;

/* ─────────────────────────── items inside it ──────────────────────────── */

CREATE OR REPLACE FUNCTION public.sp_dash_board_item_list(p_board_id bigint)
RETURNS TABLE("Id" bigint, "BoardId" bigint, "ParentId" bigint, "Kind" text,
              "Label" text, "Icon" text, "Color" text, "ChartType" text,
              "Query" jsonb, "Target" text, "OpenNew" boolean, "Style" jsonb,
              "SortOrder" integer, "Visible" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
  RETURN QUERY
    SELECT i.id, i.board_id, i.parent_id, i.kind, i.label, i.icon, i.color,
           i.chart_type, i.query, i.target, i.open_new, i.style, i.sort_order,
           i.visible
      FROM public.dash_board_item i
     WHERE i.board_id = p_board_id
     ORDER BY i.sort_order, i.id;
END $fn$;

/* Rewrite a whole board in one transaction, the same way a menu is replaced:
   the client sends the finished flat list (each row naming its section by the
   key that row uses) and the board is rewritten atomically. */
CREATE OR REPLACE FUNCTION public.sp_dash_board_item_replace(
  p_board_id bigint, p_items jsonb)
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
  IF p_board_id IS NULL OR p_board_id <= 0 THEN
    RETURN QUERY SELECT 'error', 'Invalid board', 0; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dash_board WHERE id = p_board_id) THEN
    RETURN QUERY SELECT 'error', 'Board not found', 0; RETURN;
  END IF;
  IF p_items IS NULL OR p_items = '[]'::jsonb THEN
    DELETE FROM public.dash_board_item WHERE board_id = p_board_id;
    RETURN QUERY SELECT 'ok', 'Board saved', 0; RETURN;
  END IF;
  IF jsonb_typeof(p_items) <> 'array' THEN
    RETURN QUERY SELECT 'error', 'Items must be a list', 0; RETURN;
  END IF;

  SELECT e.value INTO v_row
    FROM jsonb_array_elements(p_items) e
   WHERE coalesce(e.value->>'key', e.value->>'Key', '') = ''
   LIMIT 1;
  IF v_row IS NOT NULL THEN
    RETURN QUERY SELECT 'error', 'Every item needs a key', 0; RETURN;
  END IF;

  SELECT e.value->>'key' INTO v_key
    FROM jsonb_array_elements(p_items) e
   GROUP BY e.value->>'key'
  HAVING count(*) > 1
   LIMIT 1;
  IF v_key IS NOT NULL THEN
    RETURN QUERY SELECT 'error', 'Duplicate item key: ' || v_key, 0; RETURN;
  END IF;

  /* Pass one inserts every row; pass two attaches each item to its section. */
  FOR v_i IN 1 .. jsonb_array_length(p_items) LOOP
    v_row := p_items -> (v_i - 1);
    v_key := coalesce(v_row->>'key', v_row->>'Key', '');
    IF v_key = '' THEN CONTINUE; END IF;

    INSERT INTO public.dash_board_item
      (board_id, parent_id, kind, label, icon, color, chart_type, query,
       target, open_new, style, sort_order, visible)
    VALUES (
      p_board_id, NULL,
      coalesce(nullif(v_row->>'kind', ''), 'link'),
      coalesce(nullif(btrim(v_row->>'label'), ''), 'Untitled'),
      coalesce(nullif(v_row->>'icon', ''), 'bi-link-45deg'),
      coalesce(v_row->>'color', ''),
      coalesce(nullif(v_row->>'chartType', ''), 'kpi'),
      coalesce(v_row->>'query', '{}')::jsonb,
      coalesce(v_row->>'target', ''),
      coalesce((v_row->>'openNew')::boolean, true),
      coalesce(v_row->>'style', '{}')::jsonb,
      coalesce((v_row->>'sort')::integer, v_n),
      coalesce((v_row->>'visible')::boolean, true))
    RETURNING dash_board_item.id INTO v_key_id;

    v_ids := v_ids || jsonb_build_object(v_key, v_key_id::text);
    v_new := v_new || v_key_id;
    v_n := v_n + 1;
  END LOOP;

  FOR v_i IN 1 .. jsonb_array_length(p_items) LOOP
    v_row    := p_items -> (v_i - 1);
    v_key    := coalesce(v_row->>'key', v_row->>'Key', '');
    v_parent := coalesce(nullif(v_row->>'parent', ''), nullif(v_row->>'parentKey', ''), '');
    CONTINUE WHEN v_key = '' OR v_parent = '' OR v_parent = v_key;
    UPDATE public.dash_board_item
       SET parent_id = (v_ids ->> v_parent)::bigint
     WHERE id = (v_ids ->> v_key)::bigint
       AND (v_ids ? v_parent);
  END LOOP;

  DELETE FROM public.dash_board_item
   WHERE board_id = p_board_id
     AND NOT (id = ANY (v_new));

  RETURN QUERY SELECT 'ok', 'Board saved', v_n;
END $fn$;

/* ─────────────────────────── assignment (like menus) ──────────────────── */

CREATE OR REPLACE FUNCTION public.sp_dash_board_assignment_list(p_board_id bigint)
RETURNS TABLE("Id" bigint, "BoardId" bigint, "SubjectType" text, "SubjectId" text,
              "Name" text, "CreatedAt" timestamptz)
LANGUAGE plpgsql STABLE AS $fn$
BEGIN
  RETURN QUERY
    SELECT a.id, a.board_id, a.subject_type, a.subject_id,
           coalesce(nullif(btrim(a.subject_id),''), 'Everyone'),
           a.created_at
      FROM public.dash_board_assignment a
     WHERE a.board_id = coalesce(p_board_id, 0)
     ORDER BY a.subject_type, lower(a.subject_id);
END $fn$;

/* Pin a board to a person, a group or everybody. A person/group has one board
   at a time, exactly like their one menu, so re-pinning moves them. */
CREATE OR REPLACE FUNCTION public.sp_dash_board_assign(
  p_board_id bigint, p_subject_type text, p_subject_id text, p_user text)
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_type text := lower(btrim(coalesce(p_subject_type,'user')));
  v_subj text := btrim(coalesce(p_subject_id,''));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dash_board WHERE id = p_board_id) THEN
    RETURN QUERY SELECT 'error', 'Board not found'; RETURN;
  END IF;
  IF v_type NOT IN ('user','group','all') THEN
    RETURN QUERY SELECT 'error', 'Choose a person, a group or everyone'; RETURN;
  END IF;
  IF v_type IN ('user','group') AND v_subj = '' THEN
    RETURN QUERY SELECT 'error', 'Nothing was chosen'; RETURN;
  END IF;

  IF v_type = 'user' THEN
    DELETE FROM public.dash_board_assignment WHERE subject_type = 'user' AND subject_id = v_subj;
  ELSIF v_type = 'group' THEN
    DELETE FROM public.dash_board_assignment
     WHERE subject_type = 'group' AND subject_id = v_subj;
    DELETE FROM public.dash_board_assignment
     WHERE public.dash_board_assignment.subject_type = 'user'
       AND lower(public.dash_board_assignment.subject_id) IN (
             SELECT lower(m."UserId") FROM public."tblSecUserGrp" m
               JOIN public."tblSecGroup" g ON g."GrpId" = m."GrpId"
              WHERE lower(g."GrpName") = lower(v_subj));
  ELSE
    DELETE FROM public.dash_board_assignment WHERE subject_type = 'all';
  END IF;

  INSERT INTO public.dash_board_assignment (board_id, subject_type, subject_id, created_by)
  VALUES (p_board_id, v_type, CASE WHEN v_type = 'all' THEN '' ELSE v_subj END,
          coalesce(nullif(p_user,''),'ADMIN'))
  ON CONFLICT (board_id, subject_type, subject_id) DO NOTHING;

  RETURN QUERY SELECT 'ok', 'Assigned';
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_board_unassign(p_id bigint)
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dash_board_assignment WHERE id = p_id) THEN
    RETURN QUERY SELECT 'error', 'Not found'; RETURN;
  END IF;
  DELETE FROM public.dash_board_assignment WHERE id = p_id;
  RETURN QUERY SELECT 'ok', 'Removed';
END $fn$;

/* Remember (or clear) a person's own board. Same rule as menus: an
   administrator's assignment always wins over this. */
CREATE OR REPLACE FUNCTION public.sp_dash_board_select(
  p_board_id bigint, p_user text)
RETURNS TABLE("status" text, "message" text, "Id" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
  IF p_user IS NULL OR btrim(p_user) = '' THEN
    RETURN QUERY SELECT 'error', 'A user is required', NULL::bigint;
    RETURN;
  END IF;
  IF p_board_id IS NULL THEN
    DELETE FROM public.dash_board_user_choice WHERE userid = p_user;
    RETURN QUERY SELECT 'ok', 'Using the company dashboard', NULL::bigint;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dash_board
                  WHERE id = p_board_id AND is_available) THEN
    RETURN QUERY SELECT 'error', 'That dashboard is not available', NULL::bigint;
    RETURN;
  END IF;
  INSERT INTO public.dash_board_user_choice (userid, board_id)
  VALUES (p_user, p_board_id)
  ON CONFLICT (userid) DO UPDATE
    SET board_id = EXCLUDED.board_id, updated_at = now();
  RETURN QUERY SELECT 'ok', 'Dashboard selected', p_board_id;
END $fn$;

/* Which board a person sees. Same precedence as the sidebar menus:
     1. pinned to them directly
     2. pinned to a group they belong to
     3. the group the caller already resolved
     4. pinned to everybody
     5. their own choice, while that board is still available
     6. the single active (default) board
   A board with nothing visible in it is skipped, so nobody is ever shown an
   empty dashboard frame. Returns nothing when no candidate has content, and
   the caller keeps whatever it was showing before. */
CREATE OR REPLACE FUNCTION public.sp_dash_board_resolve(p_user text, p_grp text DEFAULT NULL)
RETURNS TABLE("BoardId" bigint, "Name" text, "IsUserChoice" boolean, "Reason" text)
LANGUAGE plpgsql STABLE AS $fn$
DECLARE
  c record;
  v_uid text := btrim(coalesce(p_user, ''));
  v_why text;
  v_own boolean;
BEGIN
  FOR c IN
    SELECT * FROM (
      SELECT 1 AS prio, a.board_id AS board_id, false AS own, 'assigned to you'::text AS why
        FROM public.dash_board_assignment a
       WHERE a.subject_type = 'user' AND v_uid <> ''
         AND lower(a.subject_id) = lower(v_uid)
      UNION ALL
      SELECT 2, a.board_id, false, 'assigned to group ' || a.subject_id
        FROM public.dash_board_assignment a
       WHERE a.subject_type = 'group' AND v_uid <> ''
         AND lower(a.subject_id) IN (
               SELECT lower(g."GrpName") FROM public."tblSecUserGrp" m
                 JOIN public."tblSecGroup" g ON g."GrpId" = m."GrpId"
                WHERE lower(m."UserId") = lower(v_uid))
      UNION ALL
      SELECT 3, a.board_id, false, 'assigned to group ' || a.subject_id
        FROM public.dash_board_assignment a
       WHERE a.subject_type = 'group' AND btrim(coalesce(p_grp,'')) <> ''
         AND lower(a.subject_id) = lower(btrim(p_grp))
      UNION ALL
      SELECT 4, a.board_id, false, 'assigned to everyone'
        FROM public.dash_board_assignment a
       WHERE a.subject_type = 'all'
      UNION ALL
      SELECT 5, uc.board_id, true, 'your own choice'
        FROM public.dash_board_user_choice uc
        JOIN public.dash_board b ON b.id = uc.board_id AND b.is_available
       WHERE v_uid <> '' AND uc.userid = v_uid
      UNION ALL
      SELECT 6, b.id, false, 'company default'
        FROM public.dash_board b
       WHERE b.is_active AND b.is_available
    ) cand
   ORDER BY cand.prio ASC, cand.board_id ASC
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.dash_board_item i
                    WHERE i.board_id = c.board_id AND i.visible) THEN
      CONTINUE;
    END IF;
    v_own := coalesce(c.own, false);
    v_why := coalesce(c.why, 'default');
    RETURN QUERY
      SELECT c.board_id, b.name, v_own, v_why
        FROM public.dash_board b WHERE b.id = c.board_id;
    RETURN;
  END LOOP;
  RETURN;
END $fn$;

/* ─────────────────────────── example boards ───────────────────────────── */

CREATE OR REPLACE FUNCTION public.sp_dash_board_add(
  p_board bigint, p_parent bigint, p_label text, p_icon text,
  p_kind text, p_target text, p_sort integer,
  p_chart_type text DEFAULT 'kpi', p_query text DEFAULT NULL,
  p_style text DEFAULT NULL, p_open_new boolean DEFAULT true)
RETURNS bigint
LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint;
BEGIN
  /* Match on the label so a second run reuses the row. */
  SELECT id INTO v_id FROM public.dash_board_item
   WHERE board_id = p_board AND lower(label) = lower(btrim(p_label))
     AND coalesce(parent_id,0) = coalesce(p_parent,0)
   LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  INSERT INTO public.dash_board_item
    (board_id, parent_id, kind, label, icon, color, chart_type, query,
     target, open_new, style, sort_order, visible)
  VALUES (p_board, p_parent, coalesce(nullif(btrim(p_kind),''), 'link'),
          btrim(p_label), coalesce(nullif(btrim(p_icon),''), 'bi-link-45deg'), '',
          coalesce(nullif(p_chart_type,''),'kpi'),
          coalesce(p_query,'{}')::jsonb, coalesce(btrim(p_target), ''),
          p_open_new, coalesce(p_style,'{}')::jsonb, coalesce(p_sort, 0), true)
  RETURNING id INTO v_id;
  RETURN v_id;
END $fn$;

/* A form link, only when the company really has that form. */
CREATE OR REPLACE FUNCTION public.sp_dash_board_add_form(
  p_board bigint, p_parent bigint, p_form text, p_sort integer)
RETURNS bigint
LANGUAGE plpgsql AS $fn$
DECLARE m record; v_id bigint;
BEGIN
  SELECT * INTO m FROM public.sp_dash_menu_form_meta(p_form) t;
  IF m."Title" IS NULL THEN
    RETURN NULL;
  END IF;
  v_id := public.sp_dash_board_add(
    p_board, p_parent, m."Title",
    coalesce(m."Icon", 'bi-file-earmark-text'), 'form', btrim(p_form), p_sort,
    'kpi', NULL, '{"itemStyle":"card"}'::text, false);
  RETURN v_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_board_seed_examples()
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
DECLARE
  v_board bigint;
  v_sec   bigint;
  v_made  integer := 0;
  v_why   text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dash_board
                  WHERE lower(name) = 'operations overview') THEN
    INSERT INTO public.dash_board
      (name, description, is_active, is_available, created_by)
    VALUES ('Operations Overview',
            'Everyday counts and the forms the store team opens most.',
            false, true, 'ADMIN')
    RETURNING id INTO v_board;
    v_made := v_made + 1;

    v_sec := public.sp_dash_board_add(
      v_board, NULL, '01. Home', 'bi-house', 'section', '', 1,
      'kpi', NULL, '{"cols":3,"itemStyle":"card"}'::text, false);
    /* Count of web-menu entries: a query the widget builder would produce for
       "count of rows" on tblWebMenus. */
    PERFORM public.sp_dash_board_add(
      v_board, v_sec, 'Forms in this company', 'bi-file-earmark-text', 'kpi', '', 1,
      'kpi',
      '{"mode":"builder","from":[{"table":"tblWebMenus","alias":"t1"}],' ||
      '"select":[{"type":"agg","fn":"count","table":"t1","column":"*","alias":"Total"}],' ||
      '"groupBy":[],"filters":[],"orderBy":[{"alias":"Total","dir":"desc"}],"limit":20}'::text,
      '{"itemStyle":"card","palette":"green"}'::text, false);
    PERFORM public.sp_dash_board_add_form(v_board, v_sec, 'frmCustomer', 2);

    v_sec := public.sp_dash_board_add(
      v_board, NULL, '02. Master', 'bi-collection', 'section', '', 2,
      'kpi', NULL, '{"cols":4,"itemStyle":"card"}'::text, false);
    PERFORM public.sp_dash_board_add_form(v_board, v_sec, 'frmCustomer', 1);
    PERFORM public.sp_dash_board_add_form(v_board, v_sec, 'frmItem', 2);
    PERFORM public.sp_dash_board_add_form(v_board, v_sec, 'frmBrand', 3);
    PERFORM public.sp_dash_board_add_form(v_board, v_sec, 'frmDeptSale2', 4);

    v_sec := public.sp_dash_board_add(
      v_board, NULL, '03. Shortcuts', 'bi-grid-3x3-gap', 'section', '', 3,
      'kpi', NULL, '{"cols":2,"itemStyle":"box"}'::text, false);
    PERFORM public.sp_dash_board_add(
      v_board, v_sec, 'Google', 'bi-search', 'url', 'https://www.google.com', 1,
      'kpi', NULL, '{"itemStyle":"box"}'::text, true);
  END IF;

  /* Nobody is switched over without being asked; the first board made becomes
     the company default only when nothing is default yet. */
  IF NOT EXISTS (SELECT 1 FROM public.dash_board WHERE is_active) THEN
    UPDATE public.dash_board SET is_active = true
     WHERE id = (SELECT id FROM public.dash_board
                  WHERE lower(name) = 'operations overview' LIMIT 1);
    v_why := 'operations overview became the default';
  ELSE
    v_why := 'left the existing default alone';
  END IF;

  RETURN QUERY SELECT 'ok',
    format('created %s example board(s); %s', v_made, coalesce(v_why, ''));
END $fn$;