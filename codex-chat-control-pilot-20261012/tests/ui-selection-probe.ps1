# Read-only Windows UI Automation inspection. No clicks, keystrokes, clipboard or changes.
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WinTargetReadOnly {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
'@
function Describe-Element($e) {
 if($null -eq $e) { return $null }
 try {
  $c=$e.Current
  $name=[string]$c.Name
  $sha=[System.Security.Cryptography.SHA256]::Create()
  try { $hash=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($name))).Replace('-','').ToLowerInvariant() } finally {$sha.Dispose()}
  return @{ pid=$c.ProcessId; type=[string]$c.ControlType.ProgrammaticName;
    automationId=[string]$c.AutomationId; className=[string]$c.ClassName;
    nameLength=$name.Length; nameSha256=$hash; isStokes=($name -eq 'stokes');
    focusable=[bool]$c.IsKeyboardFocusable; focused=[bool]$c.HasKeyboardFocus }
 } catch { return @{ error='element unavailable' } }
}
$handle=[WinTargetReadOnly]::GetForegroundWindow()
[uint32]$id=0
$null=[WinTargetReadOnly]::GetWindowThreadProcessId($handle,[ref]$id)
$proc=Get-Process -Id $id -ErrorAction SilentlyContinue
$path=$null
try {$path=$proc.Path} catch {}
$trusted=($null -ne $path -and $path -match 'OpenAI\.Codex_.*\\app\\ChatGPT\.exe$')
$result=@{checkedUtc=[DateTime]::UtcNow.ToString('o'); mode='READ_ONLY';
foregroundPid=$id; foregroundProcess=$proc.ProcessName;
codexPackageConfirmed=$trusted; foregroundPath=$path;
selectionVerified=$false; reason='Only package identity can be established by process path.'}
if($trusted) {
 try {
  $focused=[System.Windows.Automation.AutomationElement]::FocusedElement
  $anc=@()
  $walker=[System.Windows.Automation.TreeWalker]::RawViewWalker
  for($i=0; $i -lt 12 -and $null -ne $focused; $i++) {
   $anc+=Describe-Element $focused
   $focused=$walker.GetParent($focused)
  }
  $result.focusAncestors=$anc
 } catch {$result.uiError=($_.Exception.GetType().Name)}
 try {
  $root=[System.Windows.Automation.AutomationElement]::FromHandle($handle)
  $queue=New-Object System.Collections.Queue
  $queue.Enqueue(@($root,0))
  $sample=@()
  while($queue.Count -gt 0 -and $sample.Count -lt 65) {
   $entry=$queue.Dequeue(); $el=$entry[0]; $level=[int]$entry[1]
   $row=Describe-Element $el
   if($null -ne $row) { $row.depth=$level; $sample+= $row }
   if($level -ge 5) {continue}
   try {
    $children=$el.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
    for($i=0; $i -lt [Math]::Min(35,$children.Count); $i++) { $queue.Enqueue(@($children.Item($i),($level+1))) }
   } catch {}
  }
  $result.sampledTree=$sample
 } catch {$result.treeError=$_.Exception.Message}
}
$result | ConvertTo-Json -Depth 7 -Compress
