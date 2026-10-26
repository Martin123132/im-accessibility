# ImAccessibility owner-started TV task runner.
# Independent Windows Task Scheduler process; not attached to a PC Bridge job.
# Scope: exact owner-approved private R67 installation. No arbitrary commands.
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$app=Split-Path -Parent $root
$node=Join-Path $app 'Runtime\node.exe'
$ffmpeg=Join-Path $app 'Runtime\ffmpeg.exe'
$ownerHostScript=Join-Path $app 'tv-reliability-v0.5\resume-host.cjs'
$launcher=Join-Path $app 'launch-host.cjs'
$settings=Join-Path $profile 'ImAccessibility\settings.json'
$manifest=Join-Path $app 'installer-manifest.json'
if(!(Test-Path -LiteralPath $node -PathType Leaf) -or
   !(Test-Path -LiteralPath $ffmpeg -PathType Leaf) -or
   !(Test-Path -LiteralPath $ownerHostScript -PathType Leaf) -or
   !(Test-Path -LiteralPath $launcher -PathType Leaf) -or
   !(Test-Path -LiteralPath $settings -PathType Leaf) -or
   !(Test-Path -LiteralPath $manifest -PathType Leaf)){throw 'Verified owner TV installation incomplete'}
$m=Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
if($m.product -ne 'ImAccessibility' -or
   $m.version -ne 'v0.3.21-independent-audio-guard-private-preview' -or
   @($m.files).Count -ne 88){throw 'Owner TV task is not bound to verified private v0.3.21'}
foreach($item in @(
  @{rel='tv-reliability-v0.5/resume-host.cjs';file=$ownerHostScript},
  @{rel='launch-host.cjs';file=$launcher},
  @{rel='Runtime/node.exe';file=$node}
)){
 $entry=@($m.files|Where-Object { $_.path -eq $item.rel })
 if($entry.Count -ne 1){throw ('Pinned manifest missing '+$item.rel)}
 $digest=(Get-FileHash -LiteralPath $item.file -Algorithm SHA256).Hash.ToLowerInvariant()
 if($digest -ne $entry[0].sha256){throw ('Owner TV task file differs from manifest: '+$item.rel)}
}
$env:IM_ACCESSIBILITY_CONFIG_PATH=$settings
# HLS audio capture is available, but independent audio guard and TV control
# are still required before laptop muting. No automatic Windows mouse control.
$env:IM_ACCESSIBILITY_TV_AUDIO='1'
& $node $launcher --check | Out-Null
if($LASTEXITCODE -ne 0){throw 'Owner TV session preflight rejected'}
& $node $ownerHostScript
if($LASTEXITCODE -ne 0){throw ('Owner TV supervisor exited with '+$LASTEXITCODE)}
