# PRIVATE local builder. Third-party redistribution is NOT approved by this script.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$PayloadPath,
 [Parameter(Mandatory=$true)][string]$NodeExe,
 [Parameter(Mandatory=$true)][string]$NodeLicense,
 [Parameter(Mandatory=$true)][string]$FFmpegExe,
 [Parameter(Mandatory=$true)][string]$FFmpegLicense,
 [Parameter(Mandatory=$true)][string]$OutputFolder
)
$ErrorActionPreference='Stop'
$source=Split-Path -Parent $MyInvocation.MyCommand.Path
$out=[IO.Path]::GetFullPath($OutputFolder)
if(Test-Path -LiteralPath $out){throw 'Output exists; refusing overwrite'}
foreach($p in @($PayloadPath,$NodeExe,$NodeLicense,$FFmpegExe,$FFmpegLicense)){
 if(!(Test-Path -LiteralPath $p)){throw "Missing input: $p"}
}
$csc='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(!(Test-Path $csc)){throw 'No Windows .NET Framework C# compiler'}
if(!(Test-Path (Join-Path $PayloadPath 'tv-reliability-v0.5\viewer\web\fast-video.js'))){throw 'Unsupported TV payload'}
$stage=Join-Path $out 'payload'
New-Item -ItemType Directory -Path $stage -Force|Out-Null
Copy-Item -Path (Join-Path $PayloadPath '*') -Destination $stage -Recurse -ErrorAction Stop
& $csc /nologo /target:winexe /platform:x64 ('/out:'+(Join-Path $stage 'ImAccessibility.exe')) /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll (Join-Path $source 'ImAccessibilityApp.cs')
if($LASTEXITCODE -ne 0){throw 'App GUI compile failed'}
& $csc /nologo /target:winexe /platform:x64 ('/out:'+(Join-Path $stage 'ImAccessibility-Uninstall.exe')) /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll (Join-Path $source 'ImAccessibilityUninstall.cs')
if($LASTEXITCODE -ne 0){throw 'Uninstaller compile failed'}
Copy-Item (Join-Path $source 'gui-config-bridge.cjs') (Join-Path $stage 'gui-config-bridge.cjs')
$rt=Join-Path $stage 'Runtime';$lic=Join-Path $stage 'THIRD_PARTY'
New-Item -ItemType Directory -Path $rt,$lic -Force|Out-Null
Copy-Item $NodeExe (Join-Path $rt 'node.exe')
Copy-Item $FFmpegExe (Join-Path $rt 'ffmpeg.exe')
Copy-Item $NodeLicense (Join-Path $lic 'Node-LICENSE.txt')
Copy-Item $FFmpegLicense (Join-Path $lic 'FFmpeg-LICENSE.txt')
$notice='PRIVATE engineering preview. Not cleared for public distribution, signing or Windows 11 hardware acceptance.'
[IO.File]::WriteAllText((Join-Path $stage 'PRIVATE-PREVIEW-NOTICE.txt'),$notice)
foreach($n in @('Setup.cmd','Start.cmd','StartSound.cmd','Status.cmd')){
 $value='@echo off'+[Environment]::NewLine+'start "" "%~dp0ImAccessibility.exe"'+[Environment]::NewLine
 [IO.File]::WriteAllText((Join-Path $stage $n),$value,[Text.Encoding]::ASCII)
}
$value='@echo off'+[Environment]::NewLine+'start "" "%~dp0ImAccessibility-Uninstall.exe"'+[Environment]::NewLine
[IO.File]::WriteAllText((Join-Path $stage 'Uninstall.cmd'),$value,[Text.Encoding]::ASCII)
$value='@echo off'+[Environment]::NewLine+'"%~dp0Runtime\node.exe" "%~dp0stop-session.cjs"'+[Environment]::NewLine+'exit /b %errorlevel%'+[Environment]::NewLine
[IO.File]::WriteAllText((Join-Path $stage 'Stop.cmd'),$value,[Text.Encoding]::ASCII)
$items=@(Get-ChildItem -LiteralPath $stage -Recurse -File|Sort-Object FullName)
$records=@(foreach($file in $items){
 [pscustomobject]@{
  path=$file.FullName.Substring($stage.Length+1).Replace('\','/')
  bytes=[long]$file.Length
  sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLower()
 }
})
$manifest=[pscustomobject]@{format=1;product='ImAccessibility';version='v0.3.17-click-installer-private-preview';files=$records}
$mf=Join-Path $stage 'installer-manifest.json'
[IO.File]::WriteAllText($mf,(($manifest|ConvertTo-Json -Depth 8)+[Environment]::NewLine),(New-Object Text.UTF8Encoding($false)))
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=Join-Path $out 'app-payload.zip'
[IO.Compression.ZipFile]::CreateFromDirectory($stage,$zip,[IO.Compression.CompressionLevel]::Optimal,$false)
$exe=Join-Path $out 'ImAccessibility-Setup-PRIVATE-PREVIEW.exe'
& $csc /nologo /target:winexe /platform:x64 ('/out:'+$exe) /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /reference:Microsoft.CSharp.dll ('/resource:'+$zip+',ImAccessibilityInstallerPayload') (Join-Path $source 'ImAccessibilitySetup.cs')
if($LASTEXITCODE -ne 0){throw 'Setup EXE compile failed'}
[pscustomobject]@{
 setup=$exe
 files=$records.Count
 sizeBytes=(Get-Item $exe).Length
 sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $exe).Hash.ToLower()
 note='PRIVATE PREVIEW — not a public release'
}|ConvertTo-Json -Compress
