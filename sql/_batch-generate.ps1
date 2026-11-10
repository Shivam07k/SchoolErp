$ErrorActionPreference = "Stop"
$base = "C:\Users\hp\Desktop\exp\pg-xerp"

# column map discovered from the grafted forms' own AddEdit/List/Print field bindings (ground truth)
$map = @{
    "frmCustomer"       = @("LedgerCode","LedgerGroup","Country")
    "frmDeptSale2"      = @("sDate","eDate","InvNo","To_","WorkOrderNo_")
    "frmDeptSale3"      = @("sDate","eDate","InvNo","To_","WorkOrderNo_")
    "frmGoodsInward"    = @("from_","to_","challanno")
    "frmgoodsoutward"   = @("sDate","eDate","ChallanNo","pChallanNo","From_","To_","PoNo","WorkOrderNo","ChallanTag")
    "frmhsn"            = @("Hsn","HsnDescription")
    "frmItem"           = @("Item")
    "frmItemCategory"   = @("Category")
    "frmitemno"         = @("ItemNo","Title","Size")
    "frmItemNoDyn"      = @("Item","Category","ItemNo","Title","OldItemNo","Color","Size")
    "frmPackingCategory"= @("PackingCategory")
    "frmBrand"          = @("Brand")
    "frmCategoryOptions"= @("Category","fldName")
}

$skip = @("frmSecDept","frmSecDocs","frmSecGrp","frmSecLink","frmSecMenu","frmSecPerm","frmSecUser")

function StringType($name) {
    $n = $name.ToLowerInvariant()
    if ($n -match "date|time|from|to") { return "timestamptz" }
    if ($n -match "qty|no\d|weight|rate|amt|amount|value|price|size$") { return "numeric(18,2)" }
    return "text"
}

foreach ($formId in ($map.Keys | Sort-Object)) {
    $tblSuffix = $formId.Substring(3)   # strip "frm"
    $tbl   = "tbl" + $tblSuffix
    $cols  = $map[$formId]

    $colIden = @($cols | ForEach-Object { '"' + $_ + '"' })
    $colDecl = @($cols | ForEach-Object { '"' + $_ + '" ' + (StringType $_) + " NOT NULL DEFAULT ''," })

    $path = Join-Path $base "sql\port_$formId.sql"
    $sb = New-Object System.Text.StringBuilder

    [void]$sb.AppendLine("-- ============================================================")
    [void]$sb.AppendLine("-- pg-xerp port: $formId  ($tbl)  -- generated from live proven")
    [void]$sb.AppendLine("-- sp_brand_save dialect (grid2 fast-limit + count OVER())
    [void]$sb.AppendLine("-- ============================================================")
    [void]$sb.AppendLine('CREATE TABLE IF NOT EXISTS public."' + $tbl + '" (')
    [void]$sb.AppendLine('  "Id" bigserial PRIMARY KEY,')
    foreach ($d in $colDecl) { [void]$sb.AppendLine("  " + $d + ",") }
    [void]$sb.AppendLine('  "FCODE" text NOT NULL DEFAULT '''',')
    [void]$sb.AppendLine('  "User_Id" text NOT NULL DEFAULT '''',')
    [void]$sb.AppendLine('  "Lock" smallint NOT NULL DEFAULT 0,')
    [void]$sb.AppendLine('  "LOCK_User_Id" text NOT NULL DEFAULT '''',')
    [void]$sb.AppendLine('  "Created_At" timestamptz NOT NULL DEFAULT now()')
    [void]$sb.AppendLine(');')
    [void]$sb.AppendLine('')

    $sp = "sp_" + $formId.ToLowerInvariant()

    # ---- Boot ----
    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_boot(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_company text, p_fcode text)')
    [void]$sb.AppendLine('RETURNS TABLE("rc" bigint, "searchFields" text) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('BEGIN')
    [void]$sb.AppendLine('  RETURN QUERY SELECT 1::bigint, json_build_object(')
    [void]$sb.AppendLine('    ' + ($colIden | ForEach-Object { "'" + $_ + "', ''" }) -join ',`n    ') + ')::text;')
    [void]$sb.AppendLine('END $function$;')
    [void]$sb.AppendLine('')

    # ---- Grid / GridCount ----
    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_grid(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_company text, p_search text,')
    [void]$sb.AppendLine('  p_pagesize text, p_pageno text, p_order text DEFAULT ''Id DESC'')')
    [void]$sb.AppendLine('RETURNS TABLE("grid" text) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('BEGIN')
    [void]$sb.AppendLine('  RETURN QUERY')
    [void]$sb.AppendLine('  SELECT json_agg(json_build_object(')
    [void]$sb.AppendLine('    ' + ($colIden | ForEach-Object { "'" + $_ + "', r." + $_ }) -join ',`n    ') + ')  OVER() ::text AS js')
    [void]$sb.AppendLine('  FROM (SELECT ' + ($colIden -join ', ') + ', count(*) OVER() AS rc')
    [void]$sb.AppendLine('        FROM public."' + $tbl + '"')
    [void]$sb.AppendLine('        WHERE p_search = '''' OR ' + (($colIden | ForEach-Object { $_ + ' ILIKE ''%'' || p_p1search || ''%''' }) -join ' OR '))
    [void]$sb.AppendLine('        ORDER BY "Id" DESC LIMIT ' + '10 OFFSET 0) r;')
    [void]$sb.AppendLine('END $function$;')
    [void]$sb.AppendLine('')

    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_gridcount1(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_company text, p_search text)')
    [void]$sb.AppendLine('RETURNS TABLE("rc" bigint) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('BEGIN')
    [void]$sb.AppendLine('  RETURN QUERY SELECT count(*)::bigint FROM public."' + $tbl + '" ')
    [void]$sb.AppendLine('    WHERE p_search = '''' OR ' + (($colIden | ForEach-Object { $_ + ' ILIKE ''%'' || p_search || ''%''' }) -join ' OR ') + ';')
    [void]$sb.AppendLine('END $function$;')
    [void]$sb.AppendLine('')

    # ---- DFE1 ----
    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_dfe1(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_company text, p_id text)')
    [void]$sb.AppendLine('RETURNS TABLE("det1" text) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('BEGIN')
    [void]$sb.AppendLine('  RETURN QUERY SELECT json_build_object(')
    [void]$sb.AppendLine('    ' + ($colIden | ForEach-Object { "'" + $_ + "', ''" }) -join ',`n    ') + ')::text;')
    [void]$sb.AppendLine('END $function$;')
    [void]$sb.AppendLine('')

    # ---- SAVE ----
    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_save(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_company text, p_params jsonb,')
    [void]$sb.AppendLine('  p_fcode text, p_company_x text)')
    [void]$sb.AppendLine('RETURNS TABLE("status" text, "message" text, "id" bigint) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('DECLARE v_id bigint;')
    [void]$sb.AppendLine('BEGIN')
    [void]$sb.AppendLine('  INSERT INTO public."' + $tbl + '" (' + ($colIden -join ', ') + ', "FCODE", "User_Id")')
    [void]$sb.AppendLine('  VALUES (' + (@($colIden | ForEach-Object { '(p_params->>''' + $_ + ''')' }) -join ', ') + ', p_fcode, p_auth)')
    [void]$sb.AppendLine('  RETURNING "Id" INTO v_id;')
    [void]$sb.AppendLine('  RETURN QUERY SELECT ''Success''::text, ''''::text, v_id;')
    [void]$sb.AppendLine('END $function$;')
    [void]$sb.AppendLine('')

    # ---- UPDATE ----
    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_update(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_company text, p_id bigint, p_params jsonb)')
    [void]$sb.AppendLine('RETURNS TABLE("status" text, "message" text) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('BEGIN')
    [void]$sb.AppendLine('  UPDATE public."' + $tbl + '" SET ' + (@($colIden | ForEach-Object { $_ + ' = p_params->>''' + $_ + '''' }) -join ', '))
    [void]$sb.AppendLine('  WHERE "Id" = p_id;')
    [void]$sb.AppendLine('  RETURN QUERY SELECT ''Success''::text, ''''::text;')
    [void]$sb.AppendLine('END $function$;')
    [void]$sb.AppendLine('')

    # ---- Delete / Lock ----
    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_delete1(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_company text, p_id bigint)')
    [void]$sb.AppendLine('RETURNS TABLE("status" text, "message" text) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('BEGIN')
    [void]$sb.AppendLine('  DELETE FROM public."' + $tbl + '" WHERE "Id" = p_id;')
    [void]$sb.AppendLine('  RETURN QUERY SELECT ''Success''::text, ''''::text;')
    [void]$sb.AppendLine('END $function$;')
    [void]$sb.AppendLine('')

    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_lockunlock1(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_company text, p_id bigint)')
    [void]$sb.AppendLine('RETURNS TABLE("status" text, "message" text) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('BEGIN')
    [void]$sb.AppendLine('  UPDATE public."' + $tbl + '" SET "Lock" = CASE WHEN "Lock" = 0 THEN 1 ELSE 0 END,')
    [void]$sb.AppendLine('    "LOCK_User_Id" = p_auth, "Created_At" = now() WHERE "Id" = p_id;')
    [void]$sb.AppendLine('  RETURN QUERY SELECT ''Success''::text, ''''::text;')
    [void]$sb.AppendLine('END $function$;')
    [void]$sb.AppendLine('')

    Set-Content -LiteralPath $path -Value $sb.ToString() -Encoding UTF8
    Write-Output ("WROTE  $($path.Split('\')[-1])  cols=($($cols -join ', '))")
}
Write-Output "DONE-batch-generate"
