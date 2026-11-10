/* ------------------------------------------------------------------
   SIDEBAR MENU EXAMPLES
   Three ready-made menus so the drag-and-drop builder has something
   real to open. Every form link is checked against tblWebMenus first,
   so a company that does not have a form simply does not get a dead
   link pointing at it. Re-running never edits a menu that already
   exists, so anything you have changed by hand is left alone.
   ------------------------------------------------------------------ */

CREATE OR REPLACE FUNCTION public.sp_dash_menu_add(
  p_set bigint, p_parent bigint, p_label text, p_icon text,
  p_kind text, p_target text, p_sort integer,
  p_open_new boolean DEFAULT true)
RETURNS bigint
LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint;
BEGIN
  /* Match on the label so a second run reuses the row instead of
     stacking up duplicates. */
  SELECT id INTO v_id FROM public.dash_menu_item
   WHERE set_id = p_set AND lower(label) = lower(btrim(p_label))
   LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  INSERT INTO public.dash_menu_item
    (set_id, parent_id, label, icon, kind, target, open_new, sort_order, visible)
  VALUES (p_set, p_parent, btrim(p_label),
          coalesce(nullif(btrim(p_icon),''), 'bi-circle'),
          coalesce(nullif(btrim(p_kind),''), 'form'),
          coalesce(btrim(p_target), ''),
          p_open_new, coalesce(p_sort, 0), true)
  RETURNING id INTO v_id;
  RETURN v_id;
END $fn$;

/* "frmCustomer" -> the friendly title and icon the rest of the app shows,
   so a link reads "Customer Master" instead of its form id. */
CREATE OR REPLACE FUNCTION public.sp_dash_menu_form_meta(p_form text)
RETURNS TABLE("Title" text, "Icon" text)
LANGUAGE plpgsql STABLE AS $fn$
BEGIN
  RETURN QUERY
    SELECT m."MenuTitle", m."DisplayIcon"
      FROM public."tblWebMenus" m
     WHERE lower(regexp_replace(coalesce(m."WebPage",''), '\.aspx?$', '', 'i'))
         = lower(btrim(p_form))
     LIMIT 1;
END $fn$;

/* Add a form link if the company really has that form. Returns the new id,
   or NULL when the form is not here. */
CREATE OR REPLACE FUNCTION public.sp_dash_menu_add_form(
  p_set bigint, p_parent bigint, p_form text, p_sort integer)
RETURNS bigint
LANGUAGE plpgsql AS $fn$
DECLARE m record; v_id bigint;
BEGIN
  SELECT * INTO m FROM public.sp_dash_menu_form_meta(p_form) t;
  IF m."Title" IS NULL THEN
    RETURN NULL;                 -- no such form in this company
  END IF;
  v_id := public.sp_dash_menu_add(p_set, p_parent, m."Title",
         coalesce(m."Icon", 'bi-file-earmark-text'), 'form', btrim(p_form), p_sort, false);
  RETURN v_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_menu_seed_examples()
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
DECLARE
  v_set  bigint;
  v_sec  bigint;
  v_made integer := 0;
  v_why  text;
BEGIN
  /* ---------------------------------------------- 1. Sales Desk --- */
  IF NOT EXISTS (SELECT 1 FROM public.dash_menu_set
                  WHERE lower(name) = 'sales desk') THEN
    INSERT INTO public.dash_menu_set
      (name, description, is_active, is_available, created_by)
    VALUES ('Sales Desk', 'Counter sales: customers, items and the two sale forms.',
            false, true, 'ADMIN')
    RETURNING id INTO v_set;
    v_made := v_made + 1;

    v_sec := public.sp_dash_menu_add(v_set, NULL, '01. Sales Masters', 'bi-people', 'section', '', 1, false);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmCustomer', 1);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmItem', 2);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmBrand', 3);

    v_sec := public.sp_dash_menu_add(v_set, NULL, '02. Sales Transactions', 'bi-cart', 'section', '', 2, false);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmDeptSale2', 1);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmDeptSale3', 2);

    v_sec := public.sp_dash_menu_add(v_set, NULL, '03. Outside Links', 'bi-box-arrow-up-right', 'section', '', 3, false);
    PERFORM public.sp_dash_menu_add(v_set, v_sec, 'Google', 'bi-search', 'url', 'https://www.google.com', 1, true);
    PERFORM public.sp_dash_menu_add(v_set, v_sec, 'Gmail', 'bi-envelope', 'url', 'https://mail.google.com', 2, true);
  END IF;

  /* ----------------------------------------- 2. Purchase & Stock --- */
  IF NOT EXISTS (SELECT 1 FROM public.dash_menu_set
                  WHERE lower(name) = 'purchase & stock') THEN
    INSERT INTO public.dash_menu_set
      (name, description, is_active, is_available, created_by)
    VALUES ('Purchase & Stock', 'For the stores team: buying in, moving out and stock reports.',
            false, true, 'ADMIN')
    RETURNING id INTO v_set;
    v_made := v_made + 1;

    v_sec := public.sp_dash_menu_add(v_set, NULL, '01. Item Masters', 'bi-box', 'section', '', 1, false);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmItem', 1);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmBrand', 2);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmhsn', 3);

    v_sec := public.sp_dash_menu_add(v_set, NULL, '02. Stock Movement', 'bi-arrow-left-right', 'section', '', 2, false);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmGoodsInward', 1);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmgoodsoutward', 2);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmitemno', 3);

    v_sec := public.sp_dash_menu_add(v_set, NULL, '03. Stock Reports', 'bi-file-earmark-bar-graph', 'section', '', 3, false);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'rptStockSummary', 1);
  END IF;

  /* ------------------------------------------ 3. Administration --- */
  IF NOT EXISTS (SELECT 1 FROM public.dash_menu_set
                  WHERE lower(name) = 'administration') THEN
    INSERT INTO public.dash_menu_set
      (name, description, is_active, is_available, created_by)
    VALUES ('Administration', 'Only for admins: users, groups, rights and company setup.',
            false, true, 'ADMIN')
    RETURNING id INTO v_set;
    v_made := v_made + 1;

    v_sec := public.sp_dash_menu_add(v_set, NULL, '01. Users & Groups', 'bi-person-gear', 'section', '', 1, false);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmSecUser', 1);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmSecGrp', 2);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmSecDept', 3);

    v_sec := public.sp_dash_menu_add(v_set, NULL, '02. Access Control', 'bi-shield-lock', 'section', '', 2, false);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmSecPerm', 1);

    v_sec := public.sp_dash_menu_add(v_set, NULL, '03. Company Setup', 'bi-building', 'section', '', 3, false);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmCompany', 1);
    PERFORM public.sp_dash_menu_add_form(v_set, v_sec, 'frmSecMenu', 2);
  END IF;

  /* Nobody is switched over without being asked. The first menu made
     becomes the company default only when nothing is set as default yet,
     so a company that is already running its own menu is untouched. */
  IF NOT EXISTS (SELECT 1 FROM public.dash_menu_set WHERE is_active) THEN
    UPDATE public.dash_menu_set SET is_active = true
     WHERE id = (SELECT id FROM public.dash_menu_set
                  WHERE lower(name) = 'sales desk' LIMIT 1);
    v_why := 'sales desk became the default';
  ELSE
    v_why := 'left the existing default alone';
  END IF;

  RETURN QUERY SELECT 'ok',
    format('created %s example menu(s); %s', v_made, coalesce(v_why, ''));
END $fn$;
