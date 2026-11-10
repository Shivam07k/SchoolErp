/* ─────────────────────────────────────────────────────────────────────────────
   Ten admin-panel style dashboards — the kind the landing dashboard already
   makes: a row of vivid gradient cards, a compact set of quick links, and then
   every form the company has, as a colourful grid. The design principle from
   classic admin panels: "cards first, then the work".

   Each board is built from this company's OWN menu catalog (tblWebMenus), so
   the "All links" wall only ever contains forms that really exist here. The
   hero cards and quick links are hand-picked per theme; everything on these
   boards is a LINK — there are no queries, so the only thing an administrator
   can edit is the links (add, remove, reorder, restyle) in the board builder.

   No board claims the company default; they stay available for assignment to
   a person, a group or everyone. Re-runnable: boards match on name, links
   match on label inside their section, so setup never duplicates anything.
   ──────────────────────────────────────────────────────────────────────────── */

/* Turns a web page name into the id the app navigates by, exactly like the
   builder's catalog does: frmCustomer.aspx -> frmCustomer, and _JQ/_AE/_AEG
   or _SS suffixes are dropped. */
CREATE OR REPLACE FUNCTION public.sp_dash_admin_link_target(p_webpage text)
RETURNS text
LANGUAGE plpgsql STABLE AS $fn$
DECLARE v_code text; v_prefix text;
BEGIN
  IF p_webpage IS NULL OR btrim(p_webpage) = '' THEN RETURN NULL; END IF;
  v_code := coalesce((regexp_match(btrim(p_webpage), '(?i)(?:frm|rpt)([A-Za-z0-9_]+)'))[1], '');
  IF v_code <> '' THEN
    v_prefix := coalesce((regexp_match(btrim(p_webpage), '(?i)^(frm|rpt)'))[1], 'frm');
    v_code := regexp_replace(v_code, '(?i)(_JQ|_AE|_AEG|_SS)$', '');
    RETURN lower(v_prefix) || v_code;
  END IF;
  RETURN regexp_replace(btrim(p_webpage), '(?i)\.aspx?$', '');
END $fn$;

/* A single link row on an admin board. Labels come from the catalog itself, so
   re-running against a changed menu always matches. */
CREATE OR REPLACE FUNCTION public.sp_dash_admin_item(
  p_board bigint, p_parent bigint, p_label text, p_icon text, p_color text,
  p_target text, p_sort integer, p_style text, p_open boolean)
RETURNS void
LANGUAGE plpgsql AS $fn$
BEGIN
  IF btrim(coalesce(p_label,'')) = '' THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.dash_board_item
              WHERE board_id = p_board AND coalesce(parent_id,0) = coalesce(p_parent,0)
                AND lower(label) = lower(btrim(p_label))) THEN
    RETURN;
  END IF;
  INSERT INTO public.dash_board_item
    (board_id, parent_id, kind, label, icon, color, chart_type, query,
     target, open_new, style, sort_order, visible)
  VALUES (p_board, p_parent, 'form', btrim(p_label), coalesce(nullif(btrim(p_icon),''), 'bi-file-earmark-text'),
          coalesce(nullif(p_color,''), ''), 'kpi', '{}'::jsonb, btrim(coalesce(p_target,'')),
          p_open, coalesce(p_style,'{"itemStyle":"card"}')::jsonb, p_sort, true);
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_admin_sec(
  p_board bigint, p_label text, p_icon text, p_color text, p_sort integer, p_style text)
RETURNS bigint
LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint;
BEGIN
  SELECT i.id INTO v_id FROM public.dash_board_item i
   WHERE i.board_id = p_board AND i.kind = 'section' AND lower(i.label) = lower(btrim(p_label))
   LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.dash_board_item
    (board_id, parent_id, kind, label, icon, color, chart_type, query, target, open_new, style, sort_order, visible)
  VALUES (p_board, NULL, 'section', btrim(p_label), coalesce(nullif(btrim(p_icon),''),'bi-grid-3x3-gap'),
          coalesce(nullif(p_color,''),''), 'kpi', '{}'::jsonb, '', false,
          coalesce(p_style,'{"cols":4,"itemStyle":"card"}')::jsonb, p_sort, true)
  RETURNING id INTO v_id;
  RETURN v_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_board_seed_admin()
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $fn$
DECLARE
  names  text[] := ARRAY['Command Center','Sales & Billing','Purchasing & Stock','Catalog & Pricing',
                         'Master Data','Goods Inward','Goods Outward','Reports & Analytics',
                         'Security & Users','Daily Operations'];
  descs  text[] := ARRAY[
    'The keys to the whole business: sales, goods, stock and customers, on one vivid screen.',
    'Sales value, bills and the customer book — everything a sales person reaches for.',
    'Buy, receive, hold and dispatch. Stock-focused cards and the forms that move goods.',
    'Your items, categories, packings and tax codes — the catalogue that feeds every form.',
    'The master records behind the business: who you trade with, and what.',
    'Receiving desk: challans, item masters and where stock stands today.',
    'Dispatch desk: outward challans, sales and packing, so goods go out right.',
    'The numbers at a glance — reports, transactions and the data behind them.',
    'Users, groups, rights and departments for the team that keeps the system safe.',
    'Today''s business in one tap: enter a sale, receive goods, send goods, done.'];
  icons  text[] := ARRAY['bi-speedometer2','bi-bag-check','bi-truck','bi-collection','bi-database',
                         'bi-box-arrow-in-down','bi-box-arrow-up-right','bi-graph-up',
                         'bi-shield-lock','bi-calendar3'];
  colors text[] := ARRAY['#6366f1','#f59e0b','#10b981','#7c3aed','#0e7490',
                         '#0ea5e9','#f97316','#0891b2','#ef4444','#8b5cf6'];
  pals   text[] := ARRAY['#6366f1','#2563eb','#0ea5e9','#10b981','#84cc16',
                         '#f59e0b','#f97316','#ef4444','#e11d48','#8b5cf6'];
  heros  text[] := ARRAY[
    'frmDeptSale3','frmGoodsInward','rptStockSummary','frmCustomer',
    'frmDeptSale2','frmDeptSale3','rptStockSummary','frmCustomer',
    'frmGoodsInward','frmgoodsoutward','frmItem','rptStockSummary',
    'frmItem','frmItemCategory','frmPackingCategory','frmhsn',
    'frmCustomer','frmItem','frmBrand','frmItemCategory',
    'frmGoodsInward','frmItem','rptStockSummary','frmItemCategory',
    'frmgoodsoutward','frmDeptSale3','frmItem','rptStockSummary',
    'rptStockSummary','frmDeptSale2','frmDeptSale3','frmGoodsInward',
    'frmSecUser','frmSecGrp','frmSecPerm','frmSecDept',
    'frmDeptSale2','frmGoodsInward','frmgoodsoutward','frmCustomer'];
  quicks text[] := ARRAY[
    'frmItem','frmBrand','frmhsn','frmItemCategory',
    'frmItem','frmhsn','frmPackingCategory','frmBrand',
    'frmItemCategory','frmPackingCategory','frmhsn','frmitemno',
    'frmitemno','frmItemNoDyn','frmBrand','fromProcess',
    'frmPackingCategory','frmhsn','frmitemno','frmItemNoDyn',
    'frmitemno','frmBrand','frmhsn','frmItemNoDyn',
    'frmCustomer','frmBrand','frmPackingCategory','frmhsn',
    'frmgoodsoutward','frmItem','frmCustomer','frmItemCategory',
    'frmSecRights','frmSecMenu','frmCompany','frmSecGroup',
    'frmItem','frmBrand','frmhsn','frmitemno'];
  v_board bigint; v_cards bigint; v_quick bigint; v_all bigint;
  v_made integer := 0; v_list text[] := '{}';
  v_hidx integer; v_qidx integer;
  cw record; v_tgt text; v_icon text;
BEGIN
  FOR t IN 1..array_length(names, 1) LOOP
    SELECT id INTO v_board FROM public.dash_board
     WHERE lower(name) = lower(names[t]) LIMIT 1;
    IF v_board IS NULL THEN
      INSERT INTO public.dash_board (name, description, is_active, is_available, created_by)
      VALUES (names[t], descs[t], false, true, 'seed-admin')
      RETURNING id INTO v_board;
      v_made := v_made + 1; v_list := array_append(v_list, names[t]);
    END IF;

    v_cards := public.sp_dash_admin_sec(v_board, 'Cards', icons[t], colors[t], 1,
               '{"cols":4,"itemStyle":"card"}'::text);
    v_quick := public.sp_dash_admin_sec(v_board, 'Quick links', 'bi-lightning', colors[t], 2,
               '{"cols":2,"itemStyle":"box"}'::text);
    v_all   := public.sp_dash_admin_sec(v_board, 'All links', 'bi-collection', colors[t], 3,
               '{"cols":4,"itemStyle":"card"}'::text);

    v_hidx := 0; v_qidx := 0;
    FOR cw IN
      SELECT row_number() OVER (ORDER BY w."MainGroup", w."SubGroup", w."MenuOrder", w."MenuTitle") AS rn,
             w."WebPage", w."MenuTitle", w."DisplayIcon"
        FROM public."tblWebMenus" w
       WHERE w."FCODE" = 'HO' AND w."ShowStatus"
    LOOP
      v_tgt := public.sp_dash_admin_link_target(cw."WebPage");
      IF v_tgt IS NULL OR btrim(v_tgt) = '' THEN CONTINUE; END IF;
      v_icon := coalesce(nullif(btrim(coalesce(cw."DisplayIcon",'')),''), 'bi-file-earmark-text');

      PERFORM public.sp_dash_admin_item(v_board, v_all, cw."MenuTitle", v_icon, ''::text,
                                        v_tgt, cw.rn::integer, '{"itemStyle":"card"}'::text, false);
      IF v_tgt = ANY(heros[(t-1)*4 + 1 : t*4]) THEN
        PERFORM public.sp_dash_admin_item(v_board, v_cards, cw."MenuTitle", v_icon,
                                          pals[( (t-1)*2 + v_hidx ) % 10 + 1],
                                          v_tgt, v_hidx + 1, '{"itemStyle":"card"}'::text, false);
        v_hidx := v_hidx + 1;
      END IF;
      IF v_tgt = ANY(quicks[(t-1)*4 + 1 : t*4]) THEN
        PERFORM public.sp_dash_admin_item(v_board, v_quick, cw."MenuTitle", v_icon, colors[t],
                                          v_tgt, v_qidx + 1, '{"itemStyle":"box"}'::text, false);
        v_qidx := v_qidx + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT 'ok',
    format('created %s admin board(s): %s; the existing default was left alone',
           v_made, coalesce(array_to_string(v_list, ', '), 'none'));
END $fn$;

/* Seed them when this file is applied; the name match makes re-runs no-ops. */
SELECT * FROM public.sp_dash_board_seed_admin();