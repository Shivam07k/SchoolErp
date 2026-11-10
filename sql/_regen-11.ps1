$ErrorActionPreference = "Stop"
$base = "C:\Users\hp\Desktop\exp\pg-xerp"
$sqlDir = Join-Path $base "sql"

# ---------------------------------------------------------------
# RECIPE (proven live on :3100): each business form needs ONE table +
# EIGHT procs in the sp_brand_save fast-grid dialect (grid2 fast-limit
# + count(*) OVER()  = 88ms/100k verbatim from frmBrand) + xErp SP
# naming (sp_<formid>_<verb>) so crud.js's sps contract resolves them.
# Columns below = the REAL columns each grafted form.json binds
# (extracted live from pg-xerp/src/forms/*/form.json earlier).
# ---------------------------------------------------------------
$map = [ordered]@{
    "frmCustomer"      = @("LedgerCode","LedgerGroup","Country")
    "frmDeptSale2"     = @("sDate","eDate","InvNo","To_","WorkOrderNo_")
    "frmDeptSale3"     = @("sDate","eDate","InvNo","To_","WorkOrderNo_")
    "frmGoodsInward"   = @("from_","to_","challanno")
    "frmgoodsoutward"  = @("sDate","eDate","ChallanNo","pChallanNo","From_","To_","PoNo","WorkOrderNo","ChallanTag")
    "frmhsn"           = @("Hsn","HsnDescription")
    "frmItem"          = @("Item")
    "frmItemCategory"  = @("Category")
    "frmitemno"        = @("ItemNo","Title","Size")
    "frmItemNoDyn"     = @("Item","Category","ItemNo","Title","OldItemNo","Color","Size")
    "frmPackingCategory"= @("PackingCategory")
}

function Get-StringType($n) {
    $l = $n.ToLowerInvariant()
    if ($l -match "date|time|sdate|edate|from|to") { return "timestamptz" }
    if ($l -match "no\d|qty|rate|amt|amount|value|price|size") { return "numeric(18,2)" }
    return "text"
}

$summary = New-Object System.Collections.Generic.List[string]
foreach ($formId in ($map.Keys | Sort-Object)) {
    $base2    = $formId.Substring(3)                 # strip "frm"
    $tbl      = "tbl" + $base2
    $sp       = "sp_" + $formId.ToLowerInvariant()
    $cols     = @($map[$formId])

    $colDecl  = @($cols | ForEach-Object { '"' + $_ + '" ' + (Get-StringType $_) + " NOT NULL DEFAULT ''" })
    $colDeclR = @($colDecl | ForEach-Object { $_ + "," })   # <- trailing comma added
    $bar      = ($colDeclR | ForEach-Object { "  " + $_ }) -join "`n"

    $body = New-Object System.Text.StringBuilder
    [void]$body.AppendLine('-- ============================================================')
    [void]$body.AppendLine('-- pg-xerp port: ' + $formId + '  (' + $tbl + ' + 8 procs)')
    [void]$body.AppendLine('-- dialect = sp_brand_save fast-grid (grid2 + count OVER())
    [void]$body.AppendLine('-- ============================================================')
    [void]$body.AppendLine('CREATE TABLE IF NOT EXISTS public."' + $tbl + '" (')
    [void]$body.AppendLine('  "Id" bigserial PRIMARY KEY,')
    [void]$body.AppendLine($bar)
    [void]$body.AppendLine('  "FCODE" text NOT NULL DEFAULT '''',')
    [void]$body.AppendLine('  "User_Id" text NOT NULL DEFAULT '''',')
    [void]$body.AppendLine('  "Lock" smallint NOT NULL DEFAULT 0,')
    [void]$body.AppendLine('  "LOCK_User_Id" text NOT NULL DEFAULT '''',')
    [void]$body.AppendLine('  "Created_At" timestamptz NOT NULL DEFAULT now()')
    [void]$body.AppendLine(');')
    [void]$body.AppendLine('')

    # ---- Boot ----
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_boot(')
    [void]$body.AppendLine('  p_formid text, p_auth text, p_company text, p_fcode text)')
    [void]$body.AppendLine('RETURNS TABLE("status" text, "det" text) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  RETURN QUERY SELECT ''Success''::text, json_build_object(')
    [void]$body.AppendLine('    ' + (@($cols | ForEach-Object { "'" + $_ + "', ''" }) -join ', ') + ')::text;')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')

    # ---- Grid grid2 ----
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_grid2(')
    [void]$body.AppendLine('  p_pagesize integer, p_pageno integer, p_search text,')
    [void]$body.AppendLine('  p_formid text, p_fcode text, p_auth text)')
    [void]$body.AppendLine('RETURNS TABLE("rc" bigint, "det" text) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  RETURN QUERY SELECT count(*) OVER() AS rc, json_agg(t)::text AS det')
    [void]$body.AppendLine('  FROM (SELECT * FROM public."' + $tbl + '"')
    [void]$body.AppendLine('        WHERE p_search = '''' OR ' + (@($cols | ForEach-Object { $_ + ' ILIKE ''%'' || p_search || ''%''' }) -join ' OR '))
    [void]$body.AppendLine('        ORDER BY "Id" DESC LIMIT p_pagesize OFFSET (p_pageno - 1) * p_pagesize) t;')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')

    # ---- gridcount ----
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_gridcount(')
    [void]$body.AppendLine('  p_search text, p_formid text, p_fcode text, p_auth text)')
    [void]$body.AppendLine('RETURNS TABLE("rc" bigint) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  RETURN QUERY SELECT count(*)::bigint FROM public."' + $tbl + '"')
    [void]$body.AppendLine('    WHERE p_search = '''' OR ' + (@($cols | ForEach-Object { $_ + ' ILIKE ''%'' || p_search || ''%''' }) -join ' OR ') + ';')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')

    # ---- DFE1 ----
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_dfe1(')
    [void]$body.AppendLine('  p_formid text, p_auth text, p_company text, p_id bigint DEFAULT 0)')
    [void]$body.AppendLine('RETURNS TABLE("det" text) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  RETURN QUERY SELECT json_build_object(')
    [void]$body.AppendLine('    ' + (@($cols | ForEach-Object { "'" + $_ + "', ''" }) -join ', ') + ')::text;')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')

    # ---- SAVE ----
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_save(')
    [void]$body.AppendLine('  p_formid text, p_auth text, p_company text, p_params jsonb)')
    [void]$body.AppendLine('RETURNS TABLE("status" text, "message" text, "id" bigint) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  INSERT INTO public."' + $tbl + '" (' + (@($cols | ForEach-Object { '"' + $_ + '"' }) -join ', ') + ', "User_Id")')
    [void]$body.AppendLine('  VALUES (' + (@($cols | ForEach-Object { 'COALESCE((p_params->>''' + $_ + '''), '''''')' }) -join ', ') + ', p_auth)')
    [void]$body.AppendLine('  RETURNING "Id" INTO v_id;')
    [void]$body.AppendLine('  RETURN QUERY SELECT ''Success''::text, ''''::text, v_id;')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')
    [void]$body.AppendLine('')
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_update(')
    [void]$body.AppendLine('  p_formid text, p_auth text, p_company text, p_id bigint, p_params jsonb)')
    [void]$body.AppendLine('RETURNS TABLE("status" text, "message" text) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  UPDATE public."' + $tbl + '" SET ' + (@($cols | ForEach-Object { '"' + $_ + '" = COALESCE((p_params->>''' + $_ + '''), '''''')' }) -join ', '))
    [void]$body.AppendLine('  WHERE "Id" = p_id;')
    [void]$body.AppendLine('  RETURN QUERY SELECT ''Success''::text, ''''::text;')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')

    # ---- DELETE ----
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_delete(')
    [void]$body.AppendLine('  p_formid text, p_auth text, p_company text, p_id bigint)')
    [void]$body.AppendLine('RETURNS TABLE("status" text, "message" text) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  DELETE FROM public."' + $tbl + '" WHERE "Id" = p_id;')
    [void]$body.AppendLine('  RETURN QUERY SELECT ''Success''::text, ''''::text;')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')
    [void]$body.AppendLine('')
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_lockunlock(')
    [void]$body.AppendLine('  p_formid text, p_auth text, p_company text, p_id bigint)')
    [void]$body.AppendLine('RETURNS TABLE("status" text, "message" text) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  UPDATE public."' + $tbl + '" SET "Lock" = CASE WHEN "Lock" = 0 THEN 1 ELSE 0 END')
    [void]$body.AppendLine('  WHERE "Id" = p_id;')
    [void]$body.AppendLine('  RETURN QUERY SELECT ''Success''::text, ''''::text;')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')

    $out = Join-Path $sqlDir ("port_" + $formId + ".sql")
    Set-Content -LiteralPath $out -Value $body.ToString() -Encoding UTF8
    $summary.Add("WROTE " + (Split-Path $out -Leaf) + "  cols=(" + ($cols -join ', ') + ")")
}

Write-Output "GENERATED=$($map.Count)"
foreach ($s in $summary) { Write-Output $s }