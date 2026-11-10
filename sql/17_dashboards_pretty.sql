/* ─────────────────────────────────────────────────────────────────────────────
   Three ready-made dashboards, shaped the way dashboards are designed in 2026:
   a "stat row" of big, tinted KPI tiles across the top, then the catalog and
   the daily forms below — colour carries meaning, one number per card, and as
   few cards as the answer needs.

     Trade Pulse           - for everyone: the business numbers at a glance
     Sales Desk            - for the sales team: value, units, customer book
     Stock & Purchasing    - for the warehouse: goods in, goods out, catalog

   Each KPI is a real, read-only query on this company's own tables (sums and
   counts over tblGoodsSaleDet / tblGoodsInwardDet / tblGoodsOutwardDet /
   tblfrmCustomer / tblfrmItem / ...). Every tile keeps its query so it can be
   edited right in the builder, and the boards stay available for assignment
   to a person, a group or everyone; none of them takes the company default
   away from whatever the company already chose.

   Re-runnable: boards match on name, tiles match on label inside their board,
   so running the SQL again never duplicates anything.
   ──────────────────────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.sp_dash_board_pretty_item(
  p_board bigint, p_parent bigint, p_label text, p_icon text, p_color text,
  p_kind text, p_target text, p_sort integer, p_chart text, p_query text,
  p_style text, p_open boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql AS $fn$
DECLARE m record; v_label text; v_icon text; v_kind text; v_target text;
BEGIN
  v_label := btrim(p_label);
  v_icon  := btrim(coalesce(p_icon, 'bi-link-45deg'));
  v_kind  := lower(btrim(coalesce(p_kind, 'link')));
  v_target := btrim(coalesce(p_target, ''));

  /* A form link is only useful when the company actually has that form. */
  IF v_kind = 'form' THEN
    SELECT * INTO m FROM public.sp_dash_menu_form_meta(v_target) t;
    IF m."Title" IS NULL THEN RETURN; END IF;
    v_label := coalesce(nullif(v_label, ''), m."Title");
    v_icon  := coalesce(nullif(v_icon, 'bi-link-45deg'), coalesce(m."Icon", 'bi-file-earmark-text'));
  END IF;

  IF EXISTS (SELECT 1 FROM public.dash_board_item
              WHERE board_id = p_board AND coalesce(parent_id,0) = coalesce(p_parent,0)
                AND lower(label) = lower(v_label)) THEN
    RETURN;
  END IF;

  INSERT INTO public.dash_board_item
    (board_id, parent_id, kind, label, icon, color, chart_type, query,
     target, open_new, style, sort_order, visible)
  VALUES (p_board, p_parent, v_kind, v_label, v_icon, coalesce(nullif(p_color,''), ''),
          coalesce(nullif(p_chart,''),'kpi'), coalesce(p_query,'{}')::jsonb,
          v_target, p_open, coalesce(p_style,'{}')::jsonb, p_sort, true);
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_board_seed_pretty()
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
DECLARE
  v_board bigint; v_sec bigint; v_made integer := 0; v_names text[] := '{}';
  /* the sql fragments the widget builder would produce for these KPIs */
  v_sales     text := '{"mode":"builder","from":[{"table":"tblGoodsSaleDet","alias":"t1"}],"select":[{"type":"agg","fn":"sum","column":"InvoiceAmt","alias":"Sales","table":"t1"}],"filters":[],"groupBy":[],"orderBy":[{"alias":"Sales","dir":"desc"}],"limit":20}';
  v_units     text := '{"mode":"builder","from":[{"table":"tblGoodsSaleDet","alias":"t1"}],"select":[{"type":"agg","fn":"sum","column":"Qty","alias":"Units","table":"t1"}],"filters":[],"groupBy":[],"orderBy":[{"alias":"Units","dir":"desc"}],"limit":20}';
  v_salelines text := '{"mode":"builder","from":[{"table":"tblGoodsSaleDet","alias":"t1"}],"select":[{"type":"agg","fn":"count","column":"*","alias":"Lines","table":"t1"}],"filters":[],"groupBy":[],"orderBy":[{"alias":"Lines","dir":"desc"}],"limit":20}';
  v_inamt     text := '{"mode":"builder","from":[{"table":"tblGoodsInwardDet","alias":"t1"}],"select":[{"type":"agg","fn":"sum","column":"TaxableAmt","alias":"Purchases","table":"t1"}],"filters":[],"groupBy":[],"orderBy":[{"alias":"Purchases","dir":"desc"}],"limit":20}';
  v_inqty     text := '{"mode":"builder","from":[{"table":"tblGoodsInwardDet","alias":"t1"}],"select":[{"type":"agg","fn":"sum","column":"Qty","alias":"Units","table":"t1"}],"filters":[],"groupBy":[],"orderBy":[{"alias":"Units","dir":"desc"}],"limit":20}';
  v_outamt    text := '{"mode":"builder","from":[{"table":"tblGoodsOutwardDet","alias":"t1"}],"select":[{"type":"agg","fn":"sum","column":"TaxableAmt","alias":"Outward","table":"t1"}],"filters":[],"groupBy":[],"orderBy":[{"alias":"Outward","dir":"desc"}],"limit":20}';
  v_outqty    text := '{"mode":"builder","from":[{"table":"tblGoodsOutwardDet","alias":"t1"}],"select":[{"type":"agg","fn":"sum","column":"Qty","alias":"Units","table":"t1"}],"filters":[],"groupBy":[],"orderBy":[{"alias":"Units","dir":"desc"}],"limit":20}';
  v_customers text := '{"mode":"builder","from":[{"table":"tblfrmCustomer","alias":"t1"}],"select":[{"type":"agg","fn":"count","column":"*","alias":"Customers","table":"t1"}],"filters":[],"groupBy":[],"orderBy":[{"alias":"Customers","dir":"desc"}],"limit":20}';
  v_suppliers text := '{"mode":"builder","from":[{"table":"tblfrmCustomer","alias":"t1"}],"select":[{"type":"agg","fn":"count","column":"*","alias":"Customers","table":"t1"}],"filters":[{"table":"t1","column":"IsSupplier","op":"=","value":"true"}],"groupBy":[],"orderBy":[{"alias":"Customers","dir":"desc"}],"limit":20}';
  v_items     text := '{"mode":"builder","from":[{"table":"tblfrmItem","alias":"t1"}],"select":[{"type":"agg","fn":"count","column":"*","alias":"Items","table":"t1"}],"filters":[],"groupBy":[],"orderBy":[{"alias":"Items","dir":"desc"}],"limit":20}';
  v_brands    text := '{"mode":"builder","from":[{"table":"tblBrand","alias":"t1"}],"select":[{"type":"agg","fn":"count","column":"*","alias":"Brands","table":"t1"}],"filters":[],"groupBy":[],"orderBy":[{"alias":"Brands","dir":"desc"}],"limit":20}';
  v_hsn       text := '{"mode":"builder","from":[{"table":"tblfrmhsn","alias":"t1"}],"select":[{"type":"agg","fn":"count","column":"*","alias":"HSN","table":"t1"}],"filters":[],"groupBy":[],"orderBy":[{"alias":"HSN","dir":"desc"}],"limit":20}';
  v_packcats  text := '{"mode":"builder","from":[{"table":"tblfrmPackingCategory","alias":"t1"}],"select":[{"type":"agg","fn":"count","column":"*","alias":"Cats","table":"t1"}],"filters":[],"groupBy":[],"orderBy":[{"alias":"Cats","dir":"desc"}],"limit":20}';
  v_itemcats  text := '{"mode":"builder","from":[{"table":"tblfrmItemCategory","alias":"t1"}],"select":[{"type":"agg","fn":"count","column":"*","alias":"Cats","table":"t1"}],"filters":[],"groupBy":[],"orderBy":[{"alias":"Cats","dir":"desc"}],"limit":20}';
BEGIN
  /* ─────────────── Trade Pulse ─────────────── */
  SELECT id INTO v_board FROM public.dash_board WHERE lower(name) = 'trade pulse' LIMIT 1;
  IF v_board IS NULL THEN
    INSERT INTO public.dash_board (name, description, is_active, is_available, created_by)
    VALUES ('Trade Pulse',
            'The numbers that move your business — sales, purchases, dispatches '
            'and your people — on one read. Colour carries the meaning, one '
            'number per card.',
            false, true, 'seed-pretty')
    RETURNING id INTO v_board;
    v_made := v_made + 1; v_names := array_append(v_names, 'Trade Pulse');
  END IF;

  v_sec := NULL;
  SELECT i.id INTO v_sec FROM public.dash_board_item i
   WHERE i.board_id = v_board AND i.kind = 'section' AND lower(i.label) = 'the numbers' LIMIT 1;
  IF v_sec IS NULL THEN
    INSERT INTO public.dash_board_item
      (board_id, parent_id, kind, label, icon, color, chart_type, query, target, open_new, style, sort_order, visible)
    VALUES (v_board, NULL, 'section', 'The numbers', 'bi-activity', '#6366f1', 'kpi', '{}', '', false,
            '{"cols":4,"itemStyle":"card"}', 1, true) RETURNING id INTO v_sec;
  END IF;
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Sales so far', 'bi-currency-rupee', '#f59e0b', 'kpi', '', 1, 'kpi', v_sales, '{"itemStyle":"card","palette":"sunset"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Units shipped', 'bi-box-seam', '#2563eb', 'kpi', '', 2, 'kpi', v_units, '{"itemStyle":"card","palette":"ocean"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Purchases to date', 'bi-cart-plus', '#10b981', 'kpi', '', 3, 'kpi', v_inamt, '{"itemStyle":"card","palette":"nature"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Dispatches to date', 'bi-truck', '#7c3aed', 'kpi', '', 4, 'kpi', v_outamt, '{"itemStyle":"card","palette":"candy"}');

  v_sec := NULL;
  SELECT i.id INTO v_sec FROM public.dash_board_item i
   WHERE i.board_id = v_board AND i.kind = 'section' AND lower(i.label) = 'people & catalog' LIMIT 1;
  IF v_sec IS NULL THEN
    INSERT INTO public.dash_board_item
      (board_id, parent_id, kind, label, icon, color, chart_type, query, target, open_new, style, sort_order, visible)
    VALUES (v_board, NULL, 'section', 'People & catalog', 'bi-people', '#0d9488', 'kpi', '{}', '', false,
            '{"cols":3,"itemStyle":"card"}', 2, true) RETURNING id INTO v_sec;
  END IF;
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Customers', 'bi-person-badge', '#059669', 'kpi', '', 1, 'kpi', v_customers, '{"itemStyle":"card","palette":"nature"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Suppliers', 'bi-truck-flatbed', '#0e7490', 'kpi', '', 2, 'kpi', v_suppliers, '{"itemStyle":"card","palette":"ocean"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Items', 'bi-box', '#2563eb', 'kpi', '', 3, 'kpi', v_items, '{"itemStyle":"card","palette":"ocean"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Brands', 'bi-tags', '#d97706', 'kpi', '', 4, 'kpi', v_brands, '{"itemStyle":"card","palette":"sunset"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'HSN codes', 'bi-upc-scan', '#7c3aed', 'kpi', '', 5, 'kpi', v_hsn, '{"itemStyle":"card","palette":"accent"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Packing categories', 'bi-box2', '#e11d48', 'kpi', '', 6, 'kpi', v_packcats, '{"itemStyle":"card","palette":"candy"}');

  v_sec := NULL;
  SELECT i.id INTO v_sec FROM public.dash_board_item i
   WHERE i.board_id = v_board AND i.kind = 'section' AND lower(i.label) = 'quick work' LIMIT 1;
  IF v_sec IS NULL THEN
    INSERT INTO public.dash_board_item
      (board_id, parent_id, kind, label, icon, color, chart_type, query, target, open_new, style, sort_order, visible)
    VALUES (v_board, NULL, 'section', 'Quick work', 'bi-collection', '#f59e0b', 'kpi', '{}', '', false,
            '{"cols":2,"itemStyle":"box"}', 3, true) RETURNING id INTO v_sec;
  END IF;
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, '', 'bi-file-earmark-text', '#f59e0b', 'form', 'frmDeptSale2', 1, 'kpi', NULL, '{"itemStyle":"box"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, '', 'bi-file-earmark-text', '#f59e0b', 'form', 'frmCustomer', 2, 'kpi', NULL, '{"itemStyle":"box"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, '', 'bi-file-earmark-text', '#f59e0b', 'form', 'frmItem', 3, 'kpi', NULL, '{"itemStyle":"box"}');

  /* ─────────────── Sales Desk ─────────────── */
  v_board := NULL;
  SELECT id INTO v_board FROM public.dash_board WHERE lower(name) = 'sales desk' LIMIT 1;
  IF v_board IS NULL THEN
    INSERT INTO public.dash_board (name, description, is_active, is_available, created_by)
    VALUES ('Sales Desk',
            'For the sales team: the value and units you have moved, the size of '
            'your customer book, and the forms you open before lunch.',
            false, true, 'seed-pretty')
    RETURNING id INTO v_board;
    v_made := v_made + 1; v_names := array_append(v_names, 'Sales Desk');
  END IF;

  v_sec := NULL;
  SELECT i.id INTO v_sec FROM public.dash_board_item i
   WHERE i.board_id = v_board AND i.kind = 'section' AND lower(i.label) = 'sales so far' LIMIT 1;
  IF v_sec IS NULL THEN
    INSERT INTO public.dash_board_item
      (board_id, parent_id, kind, label, icon, color, chart_type, query, target, open_new, style, sort_order, visible)
    VALUES (v_board, NULL, 'section', 'Sales so far', 'bi-graph-up-arrow', '#4f46e5', 'kpi', '{}', '', false,
            '{"cols":3,"itemStyle":"card"}', 1, true) RETURNING id INTO v_sec;
  END IF;
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Value invoiced', 'bi-currency-rupee', '#f59e0b', 'kpi', '', 1, 'kpi', v_sales, '{"itemStyle":"card","palette":"sunset"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Units sold', 'bi-box-seam', '#2563eb', 'kpi', '', 2, 'kpi', v_units, '{"itemStyle":"card","palette":"ocean"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Sale lines', 'bi-receipt', '#10b981', 'kpi', '', 3, 'kpi', v_salelines, '{"itemStyle":"card","palette":"nature"}');

  v_sec := NULL;
  SELECT i.id INTO v_sec FROM public.dash_board_item i
   WHERE i.board_id = v_board AND i.kind = 'section' AND lower(i.label) = 'your customer book' LIMIT 1;
  IF v_sec IS NULL THEN
    INSERT INTO public.dash_board_item
      (board_id, parent_id, kind, label, icon, color, chart_type, query, target, open_new, style, sort_order, visible)
    VALUES (v_board, NULL, 'section', 'Customer book', 'bi-people-fill', '#0d9488', 'kpi', '{}', '', false,
            '{"cols":3,"itemStyle":"card"}', 2, true) RETURNING id INTO v_sec;
  END IF;
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Customers', 'bi-person-badge', '#059669', 'kpi', '', 1, 'kpi', v_customers, '{"itemStyle":"card","palette":"nature"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Suppliers', 'bi-truck-flatbed', '#0e7490', 'kpi', '', 2, 'kpi', v_suppliers, '{"itemStyle":"card","palette":"ocean"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Items', 'bi-box', '#2563eb', 'kpi', '', 3, 'kpi', v_items, '{"itemStyle":"card","palette":"ocean"}');

  v_sec := NULL;
  SELECT i.id INTO v_sec FROM public.dash_board_item i
   WHERE i.board_id = v_board AND i.kind = 'section' AND lower(i.label) = 'open a form' LIMIT 1;
  IF v_sec IS NULL THEN
    INSERT INTO public.dash_board_item
      (board_id, parent_id, kind, label, icon, color, chart_type, query, target, open_new, style, sort_order, visible)
    VALUES (v_board, NULL, 'section', 'Open a form', 'bi-collection', '#e11d48', 'kpi', '{}', '', false,
            '{"cols":2,"itemStyle":"card"}', 3, true) RETURNING id INTO v_sec;
  END IF;
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, '', 'bi-file-earmark-text', '#e11d48', 'form', 'frmDeptSale2', 1, 'kpi', NULL, '{"itemStyle":"card","palette":"sunset"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, '', 'bi-file-earmark-text', '#e11d48', 'form', 'frmCustomer', 2, 'kpi', NULL, '{"itemStyle":"card","palette":"ocean"}');

  /* ─────────────── Stock & Purchasing ─────────────── */
  v_board := NULL;
  SELECT id INTO v_board FROM public.dash_board WHERE lower(name) = 'stock & purchasing' LIMIT 1;
  IF v_board IS NULL THEN
    INSERT INTO public.dash_board (name, description, is_active, is_available, created_by)
    VALUES ('Stock & Purchasing',
            'For the warehouse: what came in, what went out, and how your '
            'catalog and codes stand right now.',
            false, true, 'seed-pretty')
    RETURNING id INTO v_board;
    v_made := v_made + 1; v_names := array_append(v_names, 'Stock & Purchasing');
  END IF;

  v_sec := NULL;
  SELECT i.id INTO v_sec FROM public.dash_board_item i
   WHERE i.board_id = v_board AND i.kind = 'section' AND lower(i.label) = 'goods inward' LIMIT 1;
  IF v_sec IS NULL THEN
    INSERT INTO public.dash_board_item
      (board_id, parent_id, kind, label, icon, color, chart_type, query, target, open_new, style, sort_order, visible)
    VALUES (v_board, NULL, 'section', 'Goods inward', 'bi-box-arrow-in-down', '#059669', 'kpi', '{}', '', false,
            '{"cols":3,"itemStyle":"card"}', 1, true) RETURNING id INTO v_sec;
  END IF;
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Purchases to date', 'bi-cart-plus', '#059669', 'kpi', '', 1, 'kpi', v_inamt, '{"itemStyle":"card","palette":"nature"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Units received', 'bi-archive', '#0e7490', 'kpi', '', 2, 'kpi', v_inqty, '{"itemStyle":"card","palette":"ocean"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Item categories', 'bi-diagram-3', '#7c3aed', 'kpi', '', 3, 'kpi', v_itemcats, '{"itemStyle":"card","palette":"accent"}');

  v_sec := NULL;
  SELECT i.id INTO v_sec FROM public.dash_board_item i
   WHERE i.board_id = v_board AND i.kind = 'section' AND lower(i.label) = 'goods outward' LIMIT 1;
  IF v_sec IS NULL THEN
    INSERT INTO public.dash_board_item
      (board_id, parent_id, kind, label, icon, color, chart_type, query, target, open_new, style, sort_order, visible)
    VALUES (v_board, NULL, 'section', 'Goods outward', 'bi-box-arrow-up-right', '#0e7490', 'kpi', '{}', '', false,
            '{"cols":3,"itemStyle":"card"}', 2, true) RETURNING id INTO v_sec;
  END IF;
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Dispatches to date', 'bi-truck', '#0e7490', 'kpi', '', 1, 'kpi', v_outamt, '{"itemStyle":"card","palette":"ocean"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Units dispatched', 'bi-box-seam', '#2563eb', 'kpi', '', 2, 'kpi', v_outqty, '{"itemStyle":"card","palette":"ocean"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Packing categories', 'bi-box2', '#e11d48', 'kpi', '', 3, 'kpi', v_packcats, '{"itemStyle":"card","palette":"candy"}');

  v_sec := NULL;
  SELECT i.id INTO v_sec FROM public.dash_board_item i
   WHERE i.board_id = v_board AND i.kind = 'section' AND lower(i.label) = 'catalog' LIMIT 1;
  IF v_sec IS NULL THEN
    INSERT INTO public.dash_board_item
      (board_id, parent_id, kind, label, icon, color, chart_type, query, target, open_new, style, sort_order, visible)
    VALUES (v_board, NULL, 'section', 'Catalog', 'bi-collection', '#d97706', 'kpi', '{}', '', false,
            '{"cols":3,"itemStyle":"card"}', 3, true) RETURNING id INTO v_sec;
  END IF;
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Items', 'bi-box', '#2563eb', 'kpi', '', 1, 'kpi', v_items, '{"itemStyle":"card","palette":"ocean"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'Brands', 'bi-tags', '#d97706', 'kpi', '', 2, 'kpi', v_brands, '{"itemStyle":"card","palette":"sunset"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, 'HSN codes', 'bi-upc-scan', '#7c3aed', 'kpi', '', 3, 'kpi', v_hsn, '{"itemStyle":"card","palette":"accent"}');

  v_sec := NULL;
  SELECT i.id INTO v_sec FROM public.dash_board_item i
   WHERE i.board_id = v_board AND i.kind = 'section' AND lower(i.label) = 'warehouse forms' LIMIT 1;
  IF v_sec IS NULL THEN
    INSERT INTO public.dash_board_item
      (board_id, parent_id, kind, label, icon, color, chart_type, query, target, open_new, style, sort_order, visible)
    VALUES (v_board, NULL, 'section', 'Warehouse forms', 'bi-tools', '#10b981', 'kpi', '{}', '', false,
            '{"cols":2,"itemStyle":"box"}', 4, true) RETURNING id INTO v_sec;
  END IF;
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, '', 'bi-file-earmark-text', '#10b981', 'form', 'frmGoodsInward', 1, 'kpi', NULL, '{"itemStyle":"box"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, '', 'bi-file-earmark-text', '#10b981', 'form', 'frmgoodsoutward', 2, 'kpi', NULL, '{"itemStyle":"box"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, '', 'bi-file-earmark-text', '#10b981', 'form', 'frmItem', 3, 'kpi', NULL, '{"itemStyle":"box"}');
  PERFORM public.sp_dash_board_pretty_item(v_board, v_sec, '', 'bi-file-earmark-text', '#10b981', 'form', 'frmPackingCategory', 4, 'kpi', NULL, '{"itemStyle":"box"}');

  RETURN QUERY SELECT 'ok',
    format('created %s pretty board(s): %s; the existing default was left alone',
           v_made, coalesce(array_to_string(v_names, ', '), 'none'));
END $fn$;

/* Seed them when this file is applied. Matching on name makes the second run a
   no-op, so re-running the setup is always safe. */
SELECT * FROM public.sp_dash_board_seed_pretty();