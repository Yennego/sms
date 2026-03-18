$apiDir = "d:\CodeGram\topFoundation\Frontend\sms-client\src\app\api"
$files = Get-ChildItem -Path $apiDir -Recurse -Filter "route.ts"
$count = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $original = $content
    
    # Replace all patterns of cookieStore.get('accessToken')?.value
    $content = $content -replace "cookieStore\.get\('accessToken'\)\?\.value", "getAccessToken(cookieStore)"
    $content = $content -replace "cookieStore\.get\('tn_accessToken'\)\?\.value", "getAccessToken(cookieStore)"
    $content = $content -replace "cookieStore\.get\('sa_accessToken'\)\?\.value", "getAccessToken(cookieStore)"
    
    if ($content -ne $original) {
        # Add import for getAccessToken if not already present
        if ($content -match "getAccessToken\(cookieStore\)" -and $content -notmatch "import.*getAccessToken") {
            if ($content -match "import \{([^}]+)\} from '@/lib/cookies'") {
                $existingImports = $Matches[1]
                if ($existingImports -notmatch "getAccessToken") {
                    $newImports = "$existingImports, getAccessToken"
                    $content = $content -replace "import \{[^}]+\} from '@/lib/cookies'", "import {$newImports } from '@/lib/cookies'"
                }
            } else {
                # Add new import after last existing import
                $lines = $content -split "`n"
                $lastImportIndex = -1
                for ($i = 0; $i -lt $lines.Length; $i++) {
                    if ($lines[$i] -match "^import ") { $lastImportIndex = $i }
                }
                if ($lastImportIndex -ge 0) {
                    $before = $lines[0..$lastImportIndex] -join "`n"
                    $after = $lines[($lastImportIndex+1)..($lines.Length-1)] -join "`n"
                    $content = $before + "`nimport { getAccessToken } from '@/lib/cookies';`n" + $after
                }
            }
        }
        
        Set-Content $file.FullName -Value $content -NoNewline
        $count++
        Write-Host "Updated: $($file.FullName)"
    }
}

Write-Host "Total files updated: $count"
