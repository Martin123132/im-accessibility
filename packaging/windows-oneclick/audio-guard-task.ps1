# I'm-accessibility — optional per-user independent audio-restoration task.
# Does NOT start a TV stream and never registers without explicit -OwnerConsent YES.
[CmdletBinding()]
param(
 [ValidateSet('Status','Enable','Disable')][string]$Action='Status',
 [ValidateSet('NO','YES')][string]$OwnerConsent='NO'
)
$ErrorActionPreference='Stop'
$TaskName='ImAccessibility-AudioGuard-v1'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$node=Join-Path $root 'Runtime\node.exe'
$watch=Join-Path $root 'tv-reliability-v0.5\viewer\speaker-route-watch.cjs'
$journal=Join-Path $root 'tv-reliability-v0.5\viewer\runtime\speaker-route.json'
$manifest=Join-Path $root 'installer-manifest.json'
$arguments='"'+$watch+'" --task-guardian'
function Check-PinnedFiles {
 if(!(Test-Path -LiteralPath $node -PathType Leaf)){throw 'Bundled verified Node runtime missing'}
 if(!(Test-Path -LiteralPath $watch -PathType Leaf)){throw 'Independent audio watcher missing'}
 if(!(Test-Path -LiteralPath $manifest -PathType Leaf)){throw 'Installed application manifest missing'}
 $info=Get-Content -LiteralPath $manifest -Raw|ConvertFrom-Json
 if($info.product -ne 'ImAccessibility' -or $info.version -ne 'v0.3.21-independent-audio-guard-private-preview'){
  throw 'Independent guardian requires the matching installed private preview'
 }
 if(@($info.files).Count -lt 80){throw 'Installed file manifest incomplete'}
 $bound=@($info.files|Where-Object{$_.path -eq 'tv-reliability-v0.5/viewer/speaker-route-watch.cjs'})
 if($bound.Count -ne 1){throw 'Independent watcher not bound in the installed manifest'}
 $digest=(Get-FileHash -LiteralPath $watch -Algorithm SHA256).Hash.ToLowerInvariant()
 if($digest -ne $bound[0].sha256){throw 'Independent watcher differs from installed manifest'}
}
function Get-Task {
 # Windows writes an error stream for Get-ScheduledTask -TaskName when absent.
 # Enumerating and filtering is read-only and makes a missing task a normal status.
 $matches=@(Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.TaskName -eq $TaskName })
 if($matches.Count -gt 1){throw 'Ambiguous audio guardian task name'}
 if($matches.Count -eq 0){return $null}
 return $matches[0]
}
function Assert-OwnedTask($task){
 if($null -eq $task){return $false}
 $items=@($task.Actions)
 if($items.Count -ne 1){throw 'Task name is used by another configuration'}
 $actual=$items[0]
 if([IO.Path]::GetFullPath($actual.Execute) -ine [IO.Path]::GetFullPath($node) -or
    $actual.Arguments -cne $arguments -or
    [IO.Path]::GetFullPath($actual.WorkingDirectory) -ine [IO.Path]::GetFullPath((Split-Path -Parent $watch))){
  throw 'A different Windows task already uses the audio guardian name; refusing overwrite'
 }
 $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 try{
  $entry=[string]$task.Principal.UserId
  if($entry -match '^S-1-'){$taskOwner=$entry}
  else{$taskOwner=([Security.Principal.NTAccount]::new($entry).Translate([Security.Principal.SecurityIdentifier])).Value}
 }catch{throw 'Unable to verify audio guardian task owner'}
 if($taskOwner -ne $owner -or $task.Principal.RunLevel -ne 'Limited' -or
    $task.Principal.LogonType -ne 'Interactive'){
  throw 'Unexpected scheduled task owner or permission level'
 }
 if(@($task.Triggers | Where-Object {$_ -ne $null}).Count -ne 0){
  throw 'Audio guardian must have no automatic task triggers'
 }
 return $true
}
Check-PinnedFiles
$existing=Get-Task
if($Action -eq 'Status'){
 $matched=Assert-OwnedTask $existing
 [pscustomobject]@{task=$TaskName;installed=$matched;state=if($matched){[string]$existing.State}else{'NotRegistered'};startsTv=$false;privilege='CurrentUserLimited'}|ConvertTo-Json -Compress
 return
}
if($OwnerConsent -ne 'YES'){throw 'Explicit owner approval required: -OwnerConsent YES'}
if($Action -eq 'Enable'){
 if(Test-Path -LiteralPath $journal){throw 'Audio recovery record exists: finish previous session before enabling guardian'}
 if(Assert-OwnedTask $existing){
  Write-Output 'ALREADY_ENABLED_NO_CHANGES'
  return
 }
 $actionDef=New-ScheduledTaskAction -Execute $node -Argument $arguments -WorkingDirectory (Split-Path -Parent $watch)
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $principal=New-ScheduledTaskPrincipal -UserId $sid -LogonType Interactive -RunLevel Limited
 $settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
 Register-ScheduledTask -TaskName $TaskName -Action $actionDef -Settings $settings -Principal $principal -Description 'Owner-approved independent audio-only recovery for ImAccessibility. Runs on demand, never starts TV.' -ErrorAction Stop | Out-Null
 if(!(Assert-OwnedTask (Get-Task))){throw 'Task registration could not be verified'}
 Write-Output 'ENABLED_CURRENT_USER_NO_TV_LAUNCH'
 return
}
if($Action -eq 'Disable'){
 if(Test-Path -LiteralPath $journal){throw 'Cannot disable audio restoration while the app owns a playback device'}
 if($null -eq $existing){Write-Output 'ALREADY_DISABLED';return}
 [void](Assert-OwnedTask $existing)
 if($existing.State -eq 'Running'){throw 'Audio guardian is still running; do not delete active recovery'}
 Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
 Write-Output 'DISABLED_CURRENT_USER'
 return
}
throw 'Unsupported audio guardian action'
