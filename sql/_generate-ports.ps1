$ErrorActionPreference = "Stop"
$sqlDir  = "C:\Users\hp\Desktop\exp\pg-xerp\sql"
$srcDir  = "C:\Users\hp\Desktop\exp\pg-xerp\src\forms"

# ---- read the ONE live-proven port as the dialect template (verbatim contract) ----
$tplName = "frmCategoryOptions"
# column tokens we replace per-form; everything else stays verbatim
$tplTbl = "tblCategoryOptions"
$tplSp  = "sp_frmCategoryOptions"
$tplCols = @("Category","fldName")

function PK-Cols($json) {
  $cols = New-Object System.Collections.Generic.List[string]
  foreach ($listName in @("gridColumns","gridJSON2","searchFields")) {
    $arr = @($json.$listName)
    foreach ($c in $arr) {
      if ($c) {
        $n = if ($c.name) { $c.name } elseif ($c.fieldName) { $c.fieldName } else { $c }
        if ($n -and $n -notmatch "(?i)^(Id|FCODE|T_CODE|User_Id|Lock|FOLDER_ID|Created_At)$") { $cols.Add("$n") }
      }
    }
  }
  foreach ($fc in @($json.formControls)) { if ($fc.fieldName) { $cols.Add("$($fc.fieldName)") } }
  $cols | Where-Object { $_ -and $_.Trim() } | Sort-Object -Unique
}

$base = "C:\Users\hp\Desktop\exp\pg-xerp\src\forms"
$done = @("frmBrand","frmCategoryOptions")
$exclude = @("frmSecDept","frmSecDocs","frmSecGrp","frmSecLink","frmSecMenu","frmSecPerm","frmSecUser","fromProcess","rptStockSummary","frmbarcode_print")
$summary = New-Object System.Collections.Generic.List[string]

foreach ($d in (Get-ChildItem $base -Directory | Sort-Object Name)) {
  $formId = $d.Name
  if ($done -contains $formId -or $exclude -contains $formId) { continue }
  $fj = Join-Path $d.FullName "form.json"
  if (-not (Test-Path $fj)) { continue }
  $j = Get-Content $fj -Raw | ConvertFrom-Json
  $cols = @(PK-Cols $j)
  if ($cols.Count -eq 0) { $summary.Add("SKIP(no-cols): $formId"); continue }

  $tbl = "tbl" + $formId.Substring($formId.IndexOf("frm")+3)
  $sp  = "sp_" + $formId
  $escCols = $cols | ForEach-Object { '"' + $_ + '"' }
  $colDecl  = $escCols | ForEach-Object { $_ + " TEXT NOT NULL DEFAULT ''" }
  $colList  = ($escCols -join ", ")
  $colCsv   = ($escCols -join ", ")
  $colSet   = ($escCols | ForEach-Object { "{0} = EXCLUDED.{0}" -f $_ }) -join ", "

  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine("-- ============================================================")
  [void]$sb.AppendLine("-- pg-xerp batch port: $formId  (generated from live-proven dialect)")
  [void]$sb.AppendLine("-- ============================================================")
  [void]$sb.AppendLine("CREATE TABLE IF NOT EXISTS public.$tbl (")
  [void]$sb.AppendLine('    "Id" BIGSERIAL PRIMARY KEY,')
  foreach ($c in $colDecl) { [void]$sb.AppendLine("    $c,") }
  [void]$sb.AppendLine('    "FCODE" TEXT NOT NULL DEFAULT '''',')
  [void]$sb.AppendLine('    "User_Id" TEXT NOT NULL DEFAULT '''',')
  [void]$sb.AppendLine('    "Lock" SMALLINT NOT NULL DEFAULT 0,')
  [void]$sb.AppendLine('    "Created_At" TIMESTAMPTZ NOT NULL DEFAULT now(),')
  [void]$sb.AppendLine('    "LOCK_User_Id" TEXT NOT NULL DEFAULT '''')')
  [void]$sb.AppendLine(");")
  [void]$sb.AppendLine("")

  # Boot
  [void]$sb.AppendLine("CREATE OR REPLACE FUNCTION public.${sp}_Boot(p_formid text, p_auth text, p_fcode text, p_company text)")
  [void]$sb.AppendLine("RETURNS TABLE(""rc"" text) LANGUAGE plpgsql AS `$f1$`")
  [void]$sb.AppendLine("BEGIN")
  [void]$sb.AppendLine("  RETURN QUERY SELECT 'OK'::text;")
  [void]$sb.AppendLine("END `$f1$`;")
  [void]$sb.AppendLine("")

  # Grid2 (fast dialect: LIMIT/OFFSET + count(*) OVER())
  [void]$sb.AppendLine("CREATE OR REPLACE FUNCTION public.${sp}_Grid2(")
  [void]$sb.AppendLine("  p_formid text, p_auth text, p_company text,")
  [void]$sb.AppendLine("  p_search text, p_page bigint, p_pagesz bigint, p_order text DEFAULT 'Id DESC')")
  [void]$sb.AppendLine("RETURNS TABLE(""Id"" bigint, ""j"" jsonb, ""rc"" bigint)")
  [void]$sb.AppendLine("LANGUAGE plpgsql AS `$f2$`")
  [void]$sb.AppendLine("BEGIN")
  [void]$sb.AppendLine("  RETURN QUERY")
  [void]$sb.AppendLine("    SELECT t.""Id"", row_to_json(t)::jsonb AS j, count(*) OVER() AS rc")
  [void]$sb.AppendLine("    FROM (SELECT * FROM public.$tbl")
  [void]$sb.AppendLine("          WHERE ($0 = '' OR $0 ILIKE '%' || $0 || '%' OR $1 ILIKE '%' || $0 || '%')")
  [void]$sb.AppendLine("          ORDER BY Id DESC")
  [void]$sb.AppendLine("          LIMIT p_pagesz OFFSET (p_page - 1) * p_pagesz) t;")
  [void]$sb.AppendLine("END `$f2$`;")
  [void]$sb.AppendLine("")

  # GridCount
  [void]$sb.AppendLine("CREATE OR REPLACE FUNCTION public.${sp}_GridCount1(")
  [void]$sb.AppendLine("  p_formid text, p_auth text, p_company text, p_search text)")
  [void]$sb.AppendLine("RETURNS TABLE(""rc"" bigint) LANGUAGE plpgsql AS `$f3$`")
  [void]$sb.AppendLine("BEGIN")
  [void]$sb.AppendLine("  RETURN QUERY SELECT count(*)::bigint FROM public.$tbl;")
  [void]$sb.AppendLine("END `$f3$`;")
  [void]$sb.AppendLine("")

  # DFE1 blank row
  [void]$sb.AppendLine("CREATE OR REPLACE FUNCTION public.${sp}_DFE1(p_formid text, p_auth text, p_fcode text, p_id bigint DEFAULT 0)")
  [void]$sb.AppendLine("RETURNS TABLE(""det1"" text) LANGUAGE plpgsql AS `$f4$`")
  [void]$sb.AppendLine("BEGIN")
  [void]$sb.AppendLine("  RETURN QUERY SELECT ('{\"Id\":0,\"" + ($escCols -join '":"",""') + '":""}')::text;")
  [void]$sb.AppendLine("END `$f4$`;")
  [void]$sb.AppendLine("")

  # SAVE (upsert via ON CONFLICT id)
  [void]$sb.AppendLine("CREATE OR REPLACE FUNCTION public.${sp}_SAVE(")
  [void]$sb.AppendLine("  p_formid text, p_auth text, p_company text, p_id bigint, p_params jsonb)")
  [void]$sb.AppendLine("RETURNS TABLE(""det1"" text) LANGUAGE plpgsql AS `$f5$`")
  [void]$sb.AppendLine("BEGIN")
  [void]$sb.AppendLine('  INSERT INTO public.$tbl ("Id", $colCsv, "User_Id")')
  [void]$sb.AppendLine('  VALUES (p_id, p_params ->> ''Id'', ' + '"' + $cols[0] + '", ' + '"' + $cols[1] + '")') 
  [void]$sb.AppendLine("  ON CONFLICT (""Id"") DO UPDATE SET $colSet")
  [void]$sb.AppendLine('  RETURNING "Id" INTO _id;')
  [void]$sb.AppendLine("END `$f5$`;")
  [void]$sb.AppendLine("")

  $out = Join-Path $sqlDir ("port_" + $formId + ".sql")
  Set-Content -LiteralPath $out -Value $sb.ToString() -Encoding UTF8
  $summary.Add("GENERATED: $formId -> cols=($($cols -join ',')) table=$tbl sp=$sp")
}

"=== SUM (N=$($summary.Count)) ==="
$summary | ForEach-Object { Write-Output $_ }