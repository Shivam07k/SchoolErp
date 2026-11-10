$c = Get-Content "src\pages\school\library\Fines.jsx" -Raw
$c = $c -replace "Badge status=\{f\.status \|\| 'pending'\}\>\{", "Badge status={f.status || 'pending'}{"
[IO.File]::WriteAllText("src\pages\school\library\Fines.jsx", $c)