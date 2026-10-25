# Source-backed PRIVATE Windows one-click installer builder.
# Requires explicitly supplied runtimes/licences. Does not install, publish,
# pair the TV, run capture, create services, or touch other projects.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$PreviewBundle,
 [Parameter(Mandatory=$true)][string]$NodeExe,
 [Parameter(Mandatory=$true)][string]$NodeLicense,
 [Parameter(Mandatory=$true)][string]$FFmpegExe,
 [Parameter(Mandatory=$true)][string]$FFmpegLicense,
 [Parameter(Mandatory=$true)][string]$FFmpegReadme,
 [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$source=Split-Path -Parent $MyInvocation.MyCommand.Path
$csc='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
foreach($inputPath in @($csc,$NodeExe,$NodeLicense,$FFmpegExe,$FFmpegLicense,$FFmpegReadme,
 (Join-Path $source 'ImAccessibilitySetup.cs'),(Join-Path $source 'ImAccessibilityApp.cs'),
 (Join-Path $source 'ImAccessibilityUninstall.cs'),(Join-Path $source 'gui-config-bridge.cjs'),
 (Join-Path $PreviewBundle 'package-manifest.json'),(Join-Path $PreviewBundle 'payload'))) {
 if(!(Test-Path -LiteralPath $inputPath)){throw ('Missing required input: '+$inputPath)}
}
if(Test-Path -LiteralPath $OutputDirectory){throw 'Refusing to overwrite existing output directory'}
$nodeVersion=(& $NodeExe -p 'process.version' | Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v24\.'){throw ('Expected tested Node 24, got '+$nodeVersion)}
$ffmpegVersion=(& $FFmpegExe -version | Select-Object -First 1 | Out-String).Trim()
if($ffmpegVersion -notmatch '^ffmpeg version '){throw 'FFmpeg version information unavailable'}
$preview=Get-Content -LiteralPath (Join-Path $PreviewBundle 'package-manifest.json') -Raw|ConvertFrom-Json
if($preview.product -ne 'ImAccessibility' -or @($preview.files).Count -lt 70){throw 'Unexpected TV payload provenance'}
$from=Join-Path $PreviewBundle 'payload'
$root=[IO.Path]::GetFullPath($OutputDirectory)
$stage=Join-Path $root 'staging'
$out=Join-Path $root 'out'
New-Item -ItemType Directory -Path $stage,$out -ErrorAction Stop|Out-Null
foreach($entry in $preview.files){
 $rel=[string]$entry.path
 if($rel -notmatch '^[A-Za-z0-9._/-]+$' -or $rel -match '(^|/)\.\.?(/|$)'){throw ('Invalid TV package path: '+$rel)}
 $item=Join-Path $from $rel.Replace('/','\')
 if(!(Test-Path -LiteralPath $item -PathType Leaf)){throw ('TV package missing: '+$rel)}
 if((Get-Item -LiteralPath $item).Length -ne [long]$entry.bytes -or
  (Get-FileHash -LiteralPath $item -Algorithm SHA256).Hash.ToLowerInvariant() -ne [string]$entry.sha256){
  throw ('TV package checksum mismatch: '+$rel)
 }
}
Copy-Item -Path (Join-Path $from '*') -Destination $stage -Recurse -ErrorAction Stop
# Compile all three native helpers from checked-in source into an isolated
# evidence folder; verify shipped EXEs differ only by CSC-generated metadata.
# Never execute a helper or replace the working TV's binaries.
$nativeEvidence=Join-Path $out 'native-helper-provenance'
& (Join-Path $source 'verify-native-source.ps1') -TvBundleRoot $stage -OutputDirectory $nativeEvidence
if(!(Test-Path -LiteralPath (Join-Path $nativeEvidence 'native-verification.json'))){
 throw 'Native source/binary correspondence was not verified'
}
Copy-Item -LiteralPath (Join-Path $source 'gui-config-bridge.cjs') -Destination (Join-Path $stage 'gui-config-bridge.cjs') -ErrorAction Stop
$rt=Join-Path $stage 'Runtime'
$third=Join-Path $stage 'THIRD_PARTY'
New-Item -ItemType Directory -Path $rt,$third -ErrorAction Stop|Out-Null
Copy-Item -LiteralPath $NodeExe -Destination (Join-Path $rt 'node.exe') -ErrorAction Stop
Copy-Item -LiteralPath $FFmpegExe -Destination (Join-Path $rt 'ffmpeg.exe') -ErrorAction Stop
Copy-Item -LiteralPath $NodeLicense -Destination (Join-Path $third 'Node-LICENSE.txt') -ErrorAction Stop
Copy-Item -LiteralPath $FFmpegLicense -Destination (Join-Path $third 'FFmpeg-LICENSE.txt') -ErrorAction Stop
Copy-Item -LiteralPath $FFmpegReadme -Destination (Join-Path $third 'FFmpeg-README.txt') -ErrorAction Stop
function Compile-Exe([string]$sourceFile,[string]$outputName,[string[]]$references){
 $argsList=@('/nologo','/target:winexe','/platform:x64',('/out:'+(Join-Path $stage $outputName)))
 foreach($ref in $references){$argsList+=('/reference:'+$ref)}
 $argsList+=(Join-Path $source $sourceFile)
 & $csc @argsList
 if($LASTEXITCODE -ne 0){throw ('C# failed to compile '+$sourceFile)}
}
Compile-Exe 'ImAccessibilityApp.cs' 'ImAccessibility.exe' @('System.Windows.Forms.dll','System.Drawing.dll','System.Web.Extensions.dll')
Compile-Exe 'ImAccessibilityUninstall.cs' 'ImAccessibility-Uninstall.exe' @('System.Windows.Forms.dll','System.Web.Extensions.dll')
$crlf=([string][char]13)+([string][char]10)
$launch='@echo off'+$crlf+'start "" "%~dp0ImAccessibility.exe"'+$crlf
foreach($file in @('Setup.cmd','Start.cmd','StartSound.cmd','Status.cmd')){
 [IO.File]::WriteAllText((Join-Path $stage $file),$launch,[Text.Encoding]::ASCII)
}
[IO.File]::WriteAllText((Join-Path $stage 'Uninstall.cmd'),'@echo off'+$crlf+'start "" "%~dp0ImAccessibility-Uninstall.exe"'+$crlf,[Text.Encoding]::ASCII)
[IO.File]::WriteAllText((Join-Path $stage 'Stop.cmd'),'@echo off'+$crlf+'"%~dp0Runtime\node.exe" "%~dp0stop-session.cjs"'+$crlf+'exit /b %errorlevel%'+$crlf,[Text.Encoding]::ASCII)
$notice=@(
 'ImAccessibility v0.3.19 CINEMA PRIVATE single-file click installer',
 'Install and launch with a graphical Windows app; TV never starts during install.',
 'Node.js and FFmpeg binaries are bundled with this local preview.',
 'Initial supported LG model: OLED55CX6LA.',
 'UNSIGNED PRIVATE PREVIEW. Independent Windows 11 hardware, user experience,',
 'binary provenance and software redistribution/licence review remain outstanding.',
 'Do not publish the executable or represent it as a customer-ready release.'
)
[IO.File]::WriteAllLines((Join-Path $stage 'PRIVATE-PREVIEW-NOTICE.txt'),$notice,(New-Object Text.UTF8Encoding($false)))
$files=@(Get-ChildItem -LiteralPath $stage -Recurse -File|Sort-Object FullName)
if($files.Count -lt 80 -or $files.Count -gt 250){throw ('Unexpected file count '+$files.Count)}
$inventory=@(foreach($item in $files){[pscustomobject]@{
 path=$item.FullName.Substring($stage.Length+1).Replace('\','/')
 bytes=[long]$item.Length
 sha256=(Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
}})
$manifest=[pscustomobject]@{
 format=1;product='ImAccessibility';version='v0.3.19-cinema-compact-private-preview';files=$inventory
}
$man=Join-Path $stage 'installer-manifest.json'
[IO.File]::WriteAllText($man,($manifest|ConvertTo-Json -Depth 8)+[Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=Join-Path $out 'ImAccessibilityEmbeddedPayload.zip'
[IO.Compression.ZipFile]::CreateFromDirectory($stage,$zip,[IO.Compression.CompressionLevel]::Optimal,$false)
$exe=Join-Path $out 'ImAccessibility-Setup-v0.3.19-CINEMA-PRIVATE-PREVIEW.exe'
$compilerArgs=@('/nologo','/target:winexe','/platform:x64',('/out:'+$exe))
foreach($ref in @('System.Windows.Forms.dll','System.Drawing.dll','System.Web.Extensions.dll',
 'System.IO.Compression.dll','System.IO.Compression.FileSystem.dll','Microsoft.CSharp.dll')){
 $compilerArgs+=('/reference:'+$ref)
}
$compilerArgs+=('/resource:'+$zip+',ImAccessibilityInstallerPayload')
$compilerArgs+=(Join-Path $source 'ImAccessibilitySetup.cs')
& $csc @compilerArgs
if($LASTEXITCODE -ne 0){throw 'Windows installer EXE compiler failed'}
# Never mistake a successfully built private EXE for a cleared public release.
& $NodeExe (Join-Path $source 'audit-release.cjs') $stage (Join-Path $out 'release-audit.json') $exe
if($LASTEXITCODE -ne 0){throw 'Release audit detected package corruption or private data'}
$summary=[pscustomobject]@{
 file=$exe;sizeBytes=(Get-Item -LiteralPath $exe).Length
 sha256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant()
 files=$files.Count;nodeVersion=$nodeVersion;ffmpegVersion=$ffmpegVersion;privatePreview=$true
}
$summary|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $out 'build-report.json') -Encoding UTF8
$summary|ConvertTo-Json -Compress
