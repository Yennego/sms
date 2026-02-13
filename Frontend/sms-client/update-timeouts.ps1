# Update all 30_000 timeouts to 90_000 in API routes
Get-ChildItem -Path "src\app\api\v1" -Filter "route.ts" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'createTimeoutSignal\(30_000\)') {
        $newContent = $content -replace 'createTimeoutSignal\(30_000\)', 'createTimeoutSignal(90_000)'
        Set-Content -Path $_.FullName -Value $newContent -NoNewline
        Write-Host "Updated: $($_.FullName)"
    }
}
Write-Host "Done updating timeouts!"
