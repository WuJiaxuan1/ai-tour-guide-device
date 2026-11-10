param([switch]$Stop, [switch]$Restart)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$recordPath=Join-Path $PSScriptRoot 'local-processes.json'
$records=@()
if(Test-Path -LiteralPath $recordPath) { $records=@(Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json) }
function Find-OwnedProcess($record) {
    $p=Get-Process -Id $record.id -ErrorAction SilentlyContinue
    if($p -and $p.StartTime.ToUniversalTime().Ticks.ToString() -eq $record.startTicks -and $p.Path -eq $record.executable) { return $p }
    return $null
}
if($Stop -or $Restart) {
    foreach($record in $records) { $p=Find-OwnedProcess $record; if($p) {$p.Kill()} }
    $records=@()
    '[]' | Set-Content -LiteralPath $recordPath
    if($Stop) {Write-Output 'Local debug services stopped.';return}
}
$nodeExe=(Get-Command node.exe).Source
$active=@()
foreach($name in @('backend','frontend')) {
    $record=$records | Where-Object {$_.name -eq $name} | Select-Object -First 1
    if($record -and (Find-OwnedProcess $record)) { $active+=$record;continue }
    $priorPort=$env:PORT
    try {
        if($name -eq 'backend') {
            $env:PORT='8790'
            $arguments=@('--inspect=127.0.0.1:9230','backend/src/server.mjs')
            $work=$projectRoot
        } else {
            $work=Join-Path $projectRoot 'frontend'
            Push-Location $work
            try { & $nodeExe scripts/optimize-images.mjs; if($LASTEXITCODE -ne 0) {throw 'Image preparation failed'} }
            finally {Pop-Location}
            $arguments=@('node_modules/vite/bin/vite.js','--config','../.local-work/vite.local.mjs')
        }
        $p=Start-Process -FilePath $nodeExe -ArgumentList $arguments -WorkingDirectory $work -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $PSScriptRoot "$name.out.log") -RedirectStandardError (Join-Path $PSScriptRoot "$name.err.log")
        $active+=@{name=$name;id=$p.Id;startTicks=$p.StartTime.ToUniversalTime().Ticks.ToString();executable=$nodeExe}
        ConvertTo-Json -InputObject @($active) | Set-Content -LiteralPath $recordPath
    } finally {$env:PORT=$priorPort}
}
ConvertTo-Json -InputObject @($active) | Set-Content -LiteralPath $recordPath
Write-Output 'Web: http://127.0.0.1:5174/  API: http://127.0.0.1:8790/api/health'
Write-Output 'Backend debugger: 127.0.0.1:9230. Logs and local data: .local-work/'


