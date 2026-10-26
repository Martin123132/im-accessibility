# Owner-triggered, no-expiry TV viewing task for ImAccessibility.
# No automatic trigger, no startup or login launch, no admin privilege.
[CmdletBinding()]
param(
 [ValidateSet('Status','Enable','Disable','Start','Stop')][string]$Action='Status',
 [ValidateSet('NO','YES')][string]$OwnerConsent='NO'
)
$ErrorActionPreference='Stop'
$TaskName='ImAccessibility-TV-v1'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$runner=Join-Path $root 'Run-Owner-TV.ps1'
$powershellExe=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$taskArgs='-NoProfile -ExecutionPolicy Bypass -File "'+$runner+'"'
$app=Split-Path -Parent $root
$settings=Join-Path $env:LOCALAPPDATA 'ImAccessibility\settings.json'
$node=Join-Path $app 'Runtime\node.exe'
$launcher=Join-Path $app 'launch-host.cjs'
$stop=Join-Path $app 'stop-session.cjs'
$journal=Join-Path $app 'tv-reliability-v0.5\viewer\runtime\speaker-route.json'

function Guard-Runner {
 foreach($file in @($runner,$powershellExe,$node,$launcher,$stop,$settings)){
  if(!(Test-Path -LiteralPath $file -PathType Leaf)){throw ('Required pinned owner TV file missing: '+[IO.Path]::GetFileName($file))}
 }
 $mfile=Join-Path $app 'installer-manifest.json'
 $m=Get-Content -LiteralPath $mfile -Raw|ConvertFrom-Json
 if($m.product -ne 'ImAccessibility' -or
    $m.version -ne 'v0.3.21-independent-audio-guard-private-preview' -or
    @($m.files).Count -ne 88){throw 'Owner TV task is not bound to verified private v0.3.21'}
}
function Get-OwnerTask {
 $found=@(Get-ScheduledTask -ErrorAction Stop|Where-Object {$_.TaskName -eq $TaskName})
 if($found.Count -gt 1){throw 'Ambiguous TV task identity'}
 if($found.Count -eq 0){return $null}
 return $found[0]
}
function Assert-OwnedTask($task) {
 if($null -eq $task){return $false}
 if(@($task.Actions).Count -ne 1){throw 'Another task occupies owner TV task name'}
 $a=$task.Actions[0]
 if([IO.Path]::GetFullPath($a.Execute) -ine [IO.Path]::GetFullPath($powershellExe) -or
    $a.Arguments -cne $taskArgs -or
    [IO.Path]::GetFullPath($a.WorkingDirectory) -ine [IO.Path]::GetFullPath($root)){
  throw 'Task launch action differs from exact approved TV task'
 }
 $currentSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $actualId=[string]$task.Principal.UserId
 try{
  if($actualId -match '^S-1-'){$taskSid=$actualId}
  else{$taskSid=([Security.Principal.NTAccount]::new($actualId).Translate([Security.Principal.SecurityIdentifier])).Value}
 }catch{throw 'Cannot verify owner task Windows identity'}
 if($taskSid -ne $currentSid -or $task.Principal.LogonType -ne 'Interactive' -or
    $task.Principal.RunLevel -ne 'Limited'){throw 'Unexpected Windows user or privileges on TV task'}
 if(@($task.Triggers | Where-Object {$_ -ne $null}).Count -ne 0){
  throw 'TV viewing task has an unexpected automatic trigger'
 }
 if([string]$task.Settings.ExecutionTimeLimit -ne 'PT0S'){throw 'TV task still has a runtime limit'}
 $expected='ImAccessibility owner-only TV viewing; runner SHA256 '+(Get-FileHash -LiteralPath $runner -Algorithm SHA256).Hash.ToLowerInvariant()
 if($task.Description -cne $expected){throw 'Pinned owner TV runner hash differs from task registration'}
 return $true
}
Guard-Runner
$task=Get-OwnerTask
if($Action -eq 'Status'){
 $valid=Assert-OwnedTask $task
 [pscustomobject]@{task=$TaskName;registered=$valid;state=if($valid){[string]$task.State}else{'NotRegistered'};autoTriggers=0;runtimeLimit='none';ownerControlled=$true}|ConvertTo-Json -Compress
 return
}
if($Action -eq 'Enable'){
 if($OwnerConsent -ne 'YES'){throw 'Explicit owner approval required to register TV viewing task'}
 if(Assert-OwnedTask $task){Write-Output 'ALREADY_ENABLED';return}
 $description='ImAccessibility owner-only TV viewing; runner SHA256 '+(Get-FileHash -LiteralPath $runner -Algorithm SHA256).Hash.ToLowerInvariant()
 $actionDef=New-ScheduledTaskAction -Execute $powershellExe -Argument $taskArgs -WorkingDirectory $root
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $principal=New-ScheduledTaskPrincipal -UserId $sid -LogonType Interactive -RunLevel Limited
 $options=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
 Register-ScheduledTask -TaskName $TaskName -Action $actionDef -Principal $principal -Settings $options -Description $description -ErrorAction Stop|Out-Null
 if(!(Assert-OwnedTask (Get-OwnerTask))){throw 'Could not verify registered TV viewing task'}
 Write-Output 'OWNER_TV_TASK_REGISTERED_WITH_NO_TRIGGERS_NO_RUNTIME_LIMIT'
 return
}
if($Action -eq 'Disable'){
 if($OwnerConsent -ne 'YES'){throw 'Explicit owner approval required to unregister TV task'}
 if($null -eq $task){Write-Output 'ALREADY_DISABLED';return}
 [void](Assert-OwnedTask $task)
 if($task.State -eq 'Running'){throw 'Stop active TV session before disabling task'}
 if(Test-Path -LiteralPath $journal){throw 'Audio recovery still active; refusing task removal'}
 $ports=@(Get-NetTCPConnection -LocalPort 43196,43198 -State Listen -ErrorAction SilentlyContinue)
 if($ports.Count){throw 'TV service still listening; refusing task removal'}
 Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
 Write-Output 'OWNER_TV_TASK_UNREGISTERED'
 return
}
if(!(Assert-OwnedTask $task)){throw 'Owner TV task is not registered'}
if($Action -eq 'Start'){
 if($task.State -eq 'Running'){Write-Output 'OWNER_TV_TASK_ALREADY_RUNNING';return}
 $ports=@(Get-NetTCPConnection -LocalPort 43196,43198 -State Listen -ErrorAction SilentlyContinue)
 if($ports.Count){throw 'An existing video session already uses the TV ports'}
 $env:IM_ACCESSIBILITY_CONFIG_PATH=$settings
 & $node $launcher --check | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Owner TV start preflight refused'}
 Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
 Write-Output 'OWNER_TV_TASK_START_REQUESTED'
 return
}
if($Action -eq 'Stop'){
 if($task.State -ne 'Running'){Write-Output 'OWNER_TV_TASK_ALREADY_STOPPED';return}
 & $node $stop
 if($LASTEXITCODE -ne 0){throw 'Owner TV Stop signal rejected'}
 Write-Output 'OWNER_TV_TASK_STOP_REQUESTED'
 return
}
throw 'Unsupported owner TV action'
