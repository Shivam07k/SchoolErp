/* =============================================================
   Dashboard builder / dynamic page query engine.

   One entry point, sp_dash_query_run(spec, max_rows), so the server
   route never assembles SQL from request data.

   spec (builder mode):
     {
       "mode":  "builder",
       "from":  [ { "table":"tblGoodsSaleDet", "alias":"d" } ],
       "select":[ { "type":"agg", "fn":"sum", "table":"d",
                    "column":"TotalAmount", "alias":"Total Sale" },
                  { "type":"col", "table":"d", "column":"TrnDate",
                    "alias":"Date" } ],
       "groupBy": [ { "table":"d", "column":"PartyCode" } ],
       "filters": [ { "table":"d", "column":"TrnDate", "op":">=",
                      "value":"2024-01-01" },
                    { "table":"d", "column":"PartyCode", "op":"in",
                      "value":["A","B"] },
                    { "table":"d", "column":"TotalAmount", "op":"between",
                      "value":1, "value2":10 } ],
       "orderBy": [ { "alias":"Total Sale", "dir":"desc" } ],
       "limit": 100
     }

   spec (sql mode): { "mode":"sql", "sql":"select 1 as one" }

   Identifiers are resolved to their real spelling by
   sp_dash_resolve_table / sp_dash_resolve_column, checked against
   information_schema, then quoted with %I. Values travel as bound
   parameters. Unknown operators and aggregate functions are refused, so
   nothing from the request can become executable SQL. The route runs this
   inside a READ ONLY transaction with a statement timeout.
   ============================================================= */

CREATE OR REPLACE FUNCTION public.sp_dash_query_run(
  p_spec jsonb, p_max_rows integer DEFAULT 200)
RETURNS TABLE("status" text, "message" text, "columns" jsonb,
              "rows" jsonb, "sql" text, "row_count" integer)
LANGUAGE plpgsql AS $fn$
DECLARE
  v_spec jsonb := coalesce(p_spec, '{}'::jsonb);
  v_mode text  := lower(coalesce(v_spec->>'mode', 'builder'));
  v_cap  integer := least(greatest(coalesce(p_max_rows, 200), 1), 5000);
  v_from  text[] := '{}';
  v_real  text[] := '{}';        -- real table name per source, in order
  v_alias text[] := '{}';        -- alias per source, in order
  v_sel   text[] := '{}';
  v_where text[] := '{}';
  v_wdisp text[] := '{}';        -- same filters, values shown as $n
  v_grp   text[] := '{}';
  v_ord   text[] := '{}';
  v_known text[] := '{}';        -- output labels; ORDER BY may not invent one
  v_n integer := 0;              -- how many filter values were used
  v_user_sql text;
  v_stripped text;
  v_inner text;
  v_shown text;
  v_json jsonb;
  v_rows jsonb;
  v_cols jsonb;
  e jsonb;  s jsonb;
  want text;                     -- the caller's spelling
  realcol text; own text;        -- resolved column, and the alias owning it
  op text; fn text; lbl text;
  j integer; n integer;
  v_items text[];
  v_idisp text[];
BEGIN
  IF v_mode = 'sql' THEN
    /* ---------------- read-only SQL mode ---------------- */
    v_user_sql := btrim(coalesce(v_spec->>'sql', ''));
    IF v_user_sql = '' THEN
      RETURN QUERY SELECT 'error', 'Enter a query', NULL::jsonb, NULL::jsonb, NULL::text, 0;
      RETURN;
    END IF;

    /* Hide literals, quoted identifiers and comments before looking for
       dangerous words, so a value such as 'delete' cannot trip a refusal. */
    v_stripped := regexp_replace(v_user_sql, '(?s)\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$.*?\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$', ' ', 'g');
    v_stripped := regexp_replace(v_stripped, '''(?:[^'']|'''')*''', ' ', 'g');
    v_stripped := regexp_replace(v_stripped, '"[^"]*"', ' ', 'g');
    v_stripped := regexp_replace(v_stripped, '--[^\n]*', ' ', 'g');
    v_stripped := regexp_replace(v_stripped, '/\*.*?\*/', ' ', 'g');

    /* Word edges are spelled out as a non-word character on each side, because
       PostgreSQL has no \b and its [[:<:]] class is easy to break. */
    IF v_stripped !~* '^[[:space:]]*(select|with)([^A-Za-z0-9_]|$)' THEN
      RETURN QUERY SELECT 'error', 'Only SELECT and WITH queries are allowed', NULL::jsonb, NULL::jsonb, NULL::text, 0;
      RETURN;
    END IF;
    IF v_stripped ~* '(^|[^A-Za-z0-9_])(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|do|call|refresh|vacuum|reindex|cluster|comment|set|reset|lock|listen|notify|prepare|execute|deallocate|into|merge)([^A-Za-z0-9_]|$)' THEN
      RETURN QUERY SELECT 'error', 'That query is not read-only', NULL::jsonb, NULL::jsonb, NULL::text, 0;
      RETURN;
    END IF;
    /* One statement at a time: a semicolon may only close the last one. */
    IF replace(v_stripped, ';', '') ~ ';' THEN
      RETURN QUERY SELECT 'error', 'Run one query at a time', NULL::jsonb, NULL::jsonb, NULL::text, 0;
      RETURN;
    END IF;
    IF v_stripped ~ ';[[:space:]]*[^;[:space:]]' THEN
      RETURN QUERY SELECT 'error', 'Run one query at a time', NULL::jsonb, NULL::jsonb, NULL::text, 0;
      RETURN;
    END IF;
    /* Drop a closing semicolon together with any comments trailing it, so that
       "select 1; -- note" is still a single valid statement once wrapped. */
    v_user_sql := regexp_replace(v_user_sql,
      '(?s);[[:space:]]*([[:space:]]*(--[^\n\r]*|/\*.*?\*/))*[[:space:]]*$', '', 'g');

    /* The newline matters: without it a query ending in a "-- comment" would
       comment out the closing bracket of the wrapper. */
    v_inner  := format('SELECT * FROM (%s' || chr(10) || ') _q LIMIT %s', v_user_sql, v_cap);
    v_shown  := v_user_sql;
  ELSE
    /* ---------------- builder mode ---------------- */
    FOR e IN SELECT value FROM jsonb_array_elements(coalesce(v_spec->'from', '[]'::jsonb)) LOOP
      want := btrim(coalesce(e->>'table', ''));
      IF want !~ '^[A-Za-z_][A-Za-z0-9_]*$' THEN
        RETURN QUERY SELECT 'error', 'Choose a table for every data source', NULL::jsonb, NULL::jsonb, NULL::text, 0;
        RETURN;
      END IF;
      realcol := public.sp_dash_resolve_table(want);
      IF realcol IS NULL THEN
        RETURN QUERY SELECT 'error', 'Unknown table: ' || want, NULL::jsonb, NULL::jsonb, NULL::text, 0;
        RETURN;
      END IF;
      own := lower(regexp_replace(coalesce(nullif(btrim(e->>'alias', ''), ''), 't'),
                                  '[^a-z0-9_]', '', 'g'));
      IF own !~ '^[a-z_][a-z0-9_]*$' OR own = ANY (v_alias) THEN
        own := 't' || (coalesce(array_length(v_from, 1), 0) + 1)::text;
      END IF;
      v_real  := array_append(v_real,  realcol);
      v_alias := array_append(v_alias, own);
      v_from  := array_append(v_from,  format('%I AS %I', realcol, own));
    END LOOP;
    IF array_length(v_from, 1) IS NULL THEN
      RETURN QUERY SELECT 'error', 'Add at least one data source', NULL::jsonb, NULL::jsonb, NULL::text, 0;
      RETURN;
    END IF;

    /* --- fields --- */
    FOR e IN SELECT value FROM jsonb_array_elements(coalesce(v_spec->'select', '[]'::jsonb)) LOOP
      lbl := coalesce(nullif(btrim(coalesce(e->>'alias', '')), ''), '');
      IF lower(coalesce(e->>'type', 'col')) = 'agg' THEN
        fn := lower(btrim(coalesce(e->>'fn', 'count')));
        want := lower(btrim(coalesce(e->>'column', '')));
        IF fn NOT IN ('count','sum','avg','min','max','count_distinct') THEN
          RETURN QUERY SELECT 'error', 'Unknown calculation: ' || fn, NULL::jsonb, NULL::jsonb, NULL::text, 0;
          RETURN;
        END IF;
        IF want = '*' AND fn = 'count' THEN
          v_sel := array_append(v_sel, 'count(*)');
          lbl := coalesce(nullif(lbl, ''), 'Count');
        ELSE
          realcol := NULL; own := NULL;
          IF coalesce(e->>'table', '') <> '' THEN
            j := array_position(v_alias, lower(btrim(e->>'table')));
            IF j IS NULL THEN
              RETURN QUERY SELECT 'error', 'Unknown data source: ' || e->>'table', NULL::jsonb, NULL::jsonb, NULL::text, 0;
              RETURN;
            END IF;
            realcol := public.sp_dash_resolve_column(v_real[j], want);
            IF realcol IS NULL THEN
              RETURN QUERY SELECT 'error', want || ' is not in that table', NULL::jsonb, NULL::jsonb, NULL::text, 0;
              RETURN;
            END IF;
            own := v_alias[j];
          ELSE
            FOR j IN 1 .. array_length(v_real, 1) LOOP
              realcol := public.sp_dash_resolve_column(v_real[j], want);
              IF realcol IS NOT NULL THEN own := v_alias[j]; EXIT; END IF;
            END LOOP;
            IF realcol IS NULL THEN
              RETURN QUERY SELECT 'error',
                'Unknown column: ' || coalesce(nullif(want, ''), '(none)'), NULL::jsonb, NULL::jsonb, NULL::text, 0;
              RETURN;
            END IF;
          END IF;
          IF fn = 'count_distinct' THEN
            v_sel := array_append(v_sel, format('count(DISTINCT %I.%I)', own, realcol));
          ELSE
            v_sel := array_append(v_sel, format('%s(%I.%I)', fn, own, realcol));
          END IF;
          lbl := coalesce(nullif(lbl, ''), want);
        END IF;
      ELSE
        want := lower(btrim(coalesce(e->>'column', '')));
        realcol := NULL; own := NULL;
        IF coalesce(e->>'table', '') <> '' THEN
          j := array_position(v_alias, lower(btrim(e->>'table')));
          IF j IS NULL THEN
            RETURN QUERY SELECT 'error', 'Unknown data source: ' || e->>'table', NULL::jsonb, NULL::jsonb, NULL::text, 0;
            RETURN;
          END IF;
          realcol := public.sp_dash_resolve_column(v_real[j], want);
          IF realcol IS NULL THEN
            RETURN QUERY SELECT 'error', want || ' is not in that table', NULL::jsonb, NULL::jsonb, NULL::text, 0;
            RETURN;
          END IF;
          own := v_alias[j];
        ELSE
          FOR j IN 1 .. array_length(v_real, 1) LOOP
            realcol := public.sp_dash_resolve_column(v_real[j], want);
            IF realcol IS NOT NULL THEN own := v_alias[j]; EXIT; END IF;
          END LOOP;
          IF realcol IS NULL THEN
            RETURN QUERY SELECT 'error',
              'Unknown column: ' || coalesce(nullif(want, ''), '(none)'), NULL::jsonb, NULL::jsonb, NULL::text, 0;
            RETURN;
          END IF;
        END IF;
        v_sel := array_append(v_sel, format('%I.%I', own, realcol));
        lbl := coalesce(nullif(lbl, ''), want);
      END IF;
      /* the alias belongs to this field, not to a new list entry */
      v_sel[array_length(v_sel, 1)] :=
        v_sel[array_length(v_sel, 1)] || format(' AS %I', lbl);
      v_known := array_append(v_known, lbl);
    END LOOP;
    IF array_length(v_sel, 1) IS NULL THEN
      RETURN QUERY SELECT 'error', 'Add at least one field', NULL::jsonb, NULL::jsonb, NULL::text, 0;
      RETURN;
    END IF;

    /* --- filters: every value becomes a bound parameter --- */
    FOR e IN SELECT value FROM jsonb_array_elements(coalesce(v_spec->'filters', '[]'::jsonb)) LOOP
      want := lower(btrim(coalesce(e->>'column', '')));
      op    := lower(btrim(coalesce(e->>'op', '=')));
      IF want !~ '^[a-z_][a-z0-9_]*$' OR op NOT IN
         ('=','!=','<>','<','<=','>','>=','like','ilike','in','not in',
          'between','is null','is not null') THEN
        RETURN QUERY SELECT 'error', 'That filter is not supported', NULL::jsonb, NULL::jsonb, NULL::text, 0;
        RETURN;
      END IF;
      realcol := NULL; own := NULL;
      IF coalesce(e->>'table', '') <> '' THEN
        j := array_position(v_alias, lower(btrim(e->>'table')));
        IF j IS NULL THEN
          RETURN QUERY SELECT 'error', 'Unknown data source: ' || e->>'table', NULL::jsonb, NULL::jsonb, NULL::text, 0;
          RETURN;
        END IF;
        realcol := public.sp_dash_resolve_column(v_real[j], want);
        IF realcol IS NULL THEN
          RETURN QUERY SELECT 'error', want || ' is not in that table', NULL::jsonb, NULL::jsonb, NULL::text, 0;
          RETURN;
        END IF;
        own := v_alias[j];
      ELSE
        FOR j IN 1 .. array_length(v_real, 1) LOOP
          realcol := public.sp_dash_resolve_column(v_real[j], want);
          IF realcol IS NOT NULL THEN own := v_alias[j]; EXIT; END IF;
        END LOOP;
        IF realcol IS NULL THEN
          RETURN QUERY SELECT 'error', 'Unknown column: ' || want, NULL::jsonb, NULL::jsonb, NULL::text, 0;
          RETURN;
        END IF;
      END IF;

      /* Values go in with format('%L'), which quotes and escapes them, so a
         value can never become SQL. A parallel list keeps $n placeholders so
         the SQL echoed back to the user does not expose their data.
         (EXECUTE ... USING cannot take a variable-length parameter list, so
         bound parameters are not an option for a builder with N filters.) */
      IF op IN ('is null', 'is not null') THEN
        v_where := array_append(v_where, format('%I.%I %s', own, realcol, op));
        v_wdisp := array_append(v_wdisp, format('%I.%I %s', own, realcol, op));
      ELSIF op IN ('in', 'not in') THEN
        v_items := '{}';
        v_idisp := '{}';
        FOR s IN SELECT value FROM jsonb_array_elements(coalesce(e->'value', '[]'::jsonb)) LOOP
          v_n := v_n + 1;
          v_items  := array_append(v_items,  format('%L', (s #>> '{}')));
          v_idisp := array_append(v_idisp, format('$%s', v_n));
        END LOOP;
        IF array_length(v_items, 1) IS NULL THEN
          RETURN QUERY SELECT 'error', 'Pick at least one value to match', NULL::jsonb, NULL::jsonb, NULL::text, 0;
          RETURN;
        END IF;
        v_where := array_append(v_where,
          format('%I.%I %s (%s)', own, realcol, op, array_to_string(v_items, ', ')));
        v_wdisp := array_append(v_wdisp,
          format('%I.%I %s (%s)', own, realcol, op, array_to_string(v_idisp, ', ')));
      ELSIF op = 'between' THEN
        v_n := v_n + 1;
        v_where := array_append(v_where,
          format('%I.%I BETWEEN %L AND %L', own, realcol, (e->>'value'), (e->>'value2')));
        v_wdisp := array_append(v_wdisp,
          format('%I.%I BETWEEN $%s AND $%s', own, realcol, v_n, (v_n + 1)::text));
        v_n := v_n + 1;
      ELSE
        v_n := v_n + 1;
        v_where := array_append(v_where,
          format('%I.%I %s %L', own, realcol, op, (e->>'value')));
        v_wdisp := array_append(v_wdisp,
          format('%I.%I %s $%s', own, realcol, op, v_n));
      END IF;
    END LOOP;

    /* --- group by --- */
    FOR e IN SELECT value FROM jsonb_array_elements(coalesce(v_spec->'groupBy', '[]'::jsonb)) LOOP
      want := lower(btrim(coalesce(e->>'column', '')));
      IF want !~ '^[a-z_][a-z0-9_]*$' THEN
        RETURN QUERY SELECT 'error', 'Cannot group by that field', NULL::jsonb, NULL::jsonb, NULL::text, 0;
        RETURN;
      END IF;
      realcol := NULL; own := NULL;
      IF coalesce(e->>'table', '') <> '' THEN
        j := array_position(v_alias, lower(btrim(e->>'table')));
        IF j IS NULL THEN
          RETURN QUERY SELECT 'error', 'Unknown data source: ' || e->>'table', NULL::jsonb, NULL::jsonb, NULL::text, 0;
          RETURN;
        END IF;
        realcol := public.sp_dash_resolve_column(v_real[j], want);
        IF realcol IS NULL THEN
          RETURN QUERY SELECT 'error', want || ' is not in that table', NULL::jsonb, NULL::jsonb, NULL::text, 0;
          RETURN;
        END IF;
        own := v_alias[j];
      ELSE
        FOR j IN 1 .. array_length(v_real, 1) LOOP
          realcol := public.sp_dash_resolve_column(v_real[j], want);
          IF realcol IS NOT NULL THEN own := v_alias[j]; EXIT; END IF;
        END LOOP;
        IF realcol IS NULL THEN
          RETURN QUERY SELECT 'error', 'Cannot group by that field', NULL::jsonb, NULL::jsonb, NULL::text, 0;
          RETURN;
        END IF;
      END IF;
      v_grp := array_append(v_grp, format('%I.%I', own, realcol));
    END LOOP;

    /* --- order by: only a label this query actually produces --- */
    FOR e IN SELECT value FROM jsonb_array_elements(coalesce(v_spec->'orderBy', '[]'::jsonb)) LOOP
      lbl := btrim(coalesce(e->>'alias', ''));
      IF NOT (lbl = ANY (v_known)) THEN
        RETURN QUERY SELECT 'error', 'Cannot sort by that field', NULL::jsonb, NULL::jsonb, NULL::text, 0;
        RETURN;
      END IF;
      v_ord := array_append(v_ord, format('%I %s', lbl,
        CASE WHEN lower(coalesce(e->>'dir', 'asc')) = 'desc' THEN 'DESC' ELSE 'ASC' END));
    END LOOP;

    n := least(greatest(coalesce(nullif(v_spec->>'limit', '')::int, v_cap), 1), v_cap);
    v_inner := format('SELECT %s FROM %s%s%s%s LIMIT %s',
      array_to_string(v_sel, ', '),
      array_to_string(v_from, ', '),
      CASE WHEN array_length(v_where, 1) IS NOT NULL
           THEN ' WHERE ' || array_to_string(v_where, ' AND ') ELSE '' END,
      CASE WHEN array_length(v_grp, 1) IS NOT NULL
           THEN ' GROUP BY ' || array_to_string(v_grp, ', ') ELSE '' END,
      CASE WHEN array_length(v_ord, 1) IS NOT NULL
           THEN ' ORDER BY ' || array_to_string(v_ord, ', ') ELSE '' END,
      n);
    /* what the user sees, with the filter values hidden */
    v_shown := format('SELECT %s FROM %s%s%s%s LIMIT %s',
      array_to_string(v_sel, ', '),
      array_to_string(v_from, ', '),
      CASE WHEN array_length(v_wdisp, 1) IS NOT NULL
           THEN ' WHERE ' || array_to_string(v_wdisp, ' AND ') ELSE '' END,
      CASE WHEN array_length(v_grp, 1) IS NOT NULL
           THEN ' GROUP BY ' || array_to_string(v_grp, ', ') ELSE '' END,
      CASE WHEN array_length(v_ord, 1) IS NOT NULL
           THEN ' ORDER BY ' || array_to_string(v_ord, ', ') ELSE '' END,
      n);
  END IF;

  /* ---------------- run it ---------------- */
  BEGIN
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(_r)), ''[]''::jsonb) FROM (%s) _r', v_inner)
      INTO v_json;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'error', left(SQLERRM, 300), NULL::jsonb, NULL::jsonb, v_shown, 0;
    RETURN;
  END;

  v_rows := coalesce(v_json, '[]'::jsonb);
  v_cols := coalesce(
    (SELECT jsonb_agg(k ORDER BY k) FROM (SELECT jsonb_object_keys(v_rows->0) AS k) _k),
    '[]'::jsonb);

  RETURN QUERY SELECT 'ok', 'Done', v_cols, v_rows, v_shown,
                       coalesce(jsonb_array_length(v_rows), 0);
END $fn$;
