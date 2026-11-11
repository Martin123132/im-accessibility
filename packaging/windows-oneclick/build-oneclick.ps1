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
  (Join-Path $source 'discover-setup.cjs'),
 (Join-Path $PreviewBundle 'package-manifest.json'),(Join-Path $PreviewBundle 'payload'))) {
 if(!(Test-Path -LiteralPath $inputPath)){throw ('Missing required input: '+$inputPath)}
}
if(Test-Path -LiteralPath $OutputDirectory){throw 'Refusing to overwrite existing output directory'}
$noticeRoot=Join-Path $source 'third-party-notices'
$rebuiltPins=Get-Content -LiteralPath (Join-Path $noticeRoot 'rebuilt-pins.json') -Raw|ConvertFrom-Json
$lgplPin='71ac0a64a4e3e0caaf7a8c25c7e73d161ac1b269cca930d207e89e1b23959dfb'
$ffmpegHash=(Get-FileHash -LiteralPath $FFmpegExe -Algorithm SHA256).Hash.ToLowerInvariant()
$isRebuilt=$ffmpegHash -ceq $rebuiltPins.ffmpegSHA256
if($ffmpegHash -notin @($lgplPin,$rebuiltPins.ffmpegSHA256,'57c56e369d5b4873b4d93fc1a1d833cb7cd8bc9325c14b05c34ce60b22842d8a')){
 throw 'FFmpeg is not an explicitly verified private runtime'
}
if($isRebuilt){
 foreach($pin in @(@($NodeExe,$rebuiltPins.nodeSHA256),@($NodeLicense,$rebuiltPins.nodeLicenseSHA256),
  @($FFmpegLicense,$rebuiltPins.ffmpegLicenseSHA256),@($FFmpegReadme,($rebuiltPins.notices|Where-Object {$_.file -ceq 'FFmpeg-README.txt'}).sha256))){
  if((Get-FileHash -LiteralPath $pin[0] -Algorithm SHA256).Hash.ToLowerInvariant() -cne $pin[1]){throw 'Rebuilt preview runtime/licence inputs do not match verified pins'}
 }
}
$recoveryTag=if($isRebuilt){'RECOVERY2.4.5'}else{'RECOVERY2.2'}
$buildId=if($isRebuilt){$rebuiltPins.buildId}else{'recovery2.2-original-runtime'}
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
# Copy only verified manifest entries, never unlisted files beside the payload.
$seen=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
foreach($entry in $preview.files){
 $relative=[string]$entry.path
 if(!$seen.Add($relative)){throw 'Duplicate preview manifest path'}
 $destination=Join-Path $stage $relative.Replace('/','\')
 [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))|Out-Null
 Copy-Item -LiteralPath (Join-Path $from $relative.Replace('/','\')) -Destination $destination -ErrorAction Stop
}
# Compile all three native helpers from checked-in source into an isolated
# evidence folder; verify shipped EXEs differ only by CSC-generated metadata.
# Never execute a helper or replace the working TV's binaries.
$nativeEvidence=Join-Path $out 'native-helper-provenance'
& (Join-Path $source 'verify-native-source.ps1') -TvBundleRoot $stage -OutputDirectory $nativeEvidence
if(!(Test-Path -LiteralPath (Join-Path $nativeEvidence 'native-verification.json'))){
 throw 'Native source/binary correspondence was not verified'
}
Copy-Item -LiteralPath (Join-Path $source 'gui-config-bridge.cjs') -Destination (Join-Path $stage 'gui-config-bridge.cjs') -ErrorAction Stop
Copy-Item -LiteralPath (Join-Path $source 'discover-setup.cjs') -Destination (Join-Path $stage 'discover-setup.cjs') -ErrorAction Stop
# Reuse bounded LAN SSDP/DNS-SD discovery before a TV has been configured.
Copy-Item -LiteralPath (Join-Path $source '..\windows-control-panel\TVFinder.cjs') -Destination (Join-Path $stage 'TVFinder.cjs') -ErrorAction Stop
$rt=Join-Path $stage 'Runtime'
$third=Join-Path $stage 'THIRD_PARTY'
New-Item -ItemType Directory -Path $rt,$third -ErrorAction Stop|Out-Null
Copy-Item -LiteralPath $NodeExe -Destination (Join-Path $rt 'node.exe') -ErrorAction Stop
Copy-Item -LiteralPath $FFmpegExe -Destination (Join-Path $rt 'ffmpeg.exe') -ErrorAction Stop
Copy-Item -LiteralPath $NodeLicense -Destination (Join-Path $third 'Node-LICENSE.txt') -ErrorAction Stop
Copy-Item -LiteralPath $FFmpegLicense -Destination (Join-Path $third 'FFmpeg-LICENSE.txt') -ErrorAction Stop
Copy-Item -LiteralPath $FFmpegReadme -Destination (Join-Path $third 'FFmpeg-README.txt') -ErrorAction Stop
# The separately QA-tested FFmpeg LGPL executable is allowed only by exact SHA.
# Keep the original x264 behaviour for old private owner builds.
if($ffmpegHash -eq $lgplPin -or $isRebuilt){
 $notice=[IO.File]::ReadAllText($FFmpegLicense)
 if($notice -notmatch 'GNU LESSER GENERAL PUBLIC LICENSE'){throw 'Pinned LGPL license notice missing'}
 $noticePins=Get-Content -LiteralPath (Join-Path $noticeRoot 'pins.json') -Raw|ConvertFrom-Json
 if((!$isRebuilt -and $noticePins.ffmpegSHA256 -cne $ffmpegHash) -or
    ($isRebuilt -and $noticePins.ffmpegSHA256 -cne $rebuiltPins.historicalRuntimeSHA256)){
  throw 'Additional licence notices do not match the FFmpeg provenance'
 }
 foreach($entry in $noticePins.notices){
  if($entry.file -notmatch '^[A-Za-z0-9._-]+$'){throw 'Unsafe third-party notice filename'}
  $noticePath=Join-Path $noticeRoot $entry.file
  if((Get-FileHash -LiteralPath $noticePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw ('Third-party material differs from recorded pin: '+$entry.file)}
  Copy-Item -LiteralPath $noticePath -Destination (Join-Path $third $entry.file) -ErrorAction Stop
 }
 if($isRebuilt){
  foreach($entry in $rebuiltPins.notices){
   if($entry.file -notmatch '^[A-Za-z0-9._-]+$' -or $entry.source -notmatch '^[A-Za-z0-9._/-]+$' -or
      $entry.source -match '(^|/)\.\.?(/|$)'){throw 'Unsafe rebuilt-runtime evidence path'}
   $noticePath=[IO.Path]::GetFullPath((Join-Path $source $entry.source))
   if(!$noticePath.StartsWith($source+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){
    throw 'Rebuilt-runtime evidence escapes source directory'
   }
   if((Get-FileHash -LiteralPath $noticePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){
    throw ('Rebuilt-runtime evidence differs from recorded pin: '+$entry.file)
   }
   Copy-Item -LiteralPath $noticePath -Destination (Join-Path $third $entry.file) -ErrorAction Stop
  }
 }
 [IO.File]::WriteAllText((Join-Path $stage 'encoder-profile.txt'),"h264_mf" + [Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
 Write-Output 'Pinned LGPL FFmpeg: Windows Media Foundation H264 selected for HLS; fast MSE unverified, HLS kept.'
}
# Record the actual shipped runtimes AND licence hashes. This inventory is
# integrity evidence only; it never represents source/licence clearance.
$runtimeInventory=[pscustomobject]@{
 schema=1;redistributionApproved=$false;buildId=$buildId
 node=[pscustomobject]@{version=$nodeVersion;sha256=(Get-FileHash -LiteralPath $NodeExe -Algorithm SHA256).Hash.ToLowerInvariant();license='THIRD_PARTY/Node-LICENSE.txt';licenseSHA256=(Get-FileHash -LiteralPath $NodeLicense -Algorithm SHA256).Hash.ToLowerInvariant()}
 ffmpeg=[pscustomobject]@{version=$ffmpegVersion;sha256=$ffmpegHash;license='THIRD_PARTY/FFmpeg-LICENSE.txt';licenseSHA256=(Get-FileHash -LiteralPath $FFmpegLicense -Algorithm SHA256).Hash.ToLowerInvariant();correspondingSourceComplete=$false}
}
[IO.File]::WriteAllText((Join-Path $third 'bundled-runtimes.json'),($runtimeInventory|ConvertTo-Json -Depth 5)+[Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
function Compile-Exe([string]$sourceFile,[string]$outputName,[string[]]$references){
 $argsList=@('/nologo','/target:winexe','/platform:x64',('/out:'+(Join-Path $stage $outputName)))
 if($isRebuilt){$argsList+='/define:REBUILT_FFMPEG_PRIVATE'}
 foreach($ref in $references){$argsList+=('/reference:'+$ref)}
 $argsList+=(Join-Path $source $sourceFile)
 if($sourceFile -in @('ImAccessibilityUninstall.cs','ImAccessibilityApp.cs')){$argsList+=(Join-Path $source 'InstallSafety.cs')}
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
 ('ImAccessibility v0.3.21 '+$recoveryTag+' PRIVATE single-file click installer'),
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
 format=1;product='ImAccessibility';version='v0.3.21-independent-audio-guard-private-preview';buildId=$buildId;files=$inventory
}
$man=Join-Path $stage 'installer-manifest.json'
[IO.File]::WriteAllText($man,($manifest|ConvertTo-Json -Depth 8)+[Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=Join-Path $out 'ImAccessibilityEmbeddedPayload.zip'
[IO.Compression.ZipFile]::CreateFromDirectory($stage,$zip,[IO.Compression.CompressionLevel]::Optimal,$false)
$exe=Join-Path $out ('ImAccessibility-Setup-v0.3.21-'+$recoveryTag+'-PRIVATE-PREVIEW.exe')
$compilerArgs=@('/nologo','/target:winexe','/platform:x64',('/out:'+$exe))
if($isRebuilt){$compilerArgs+='/define:REBUILT_FFMPEG_PRIVATE'}
foreach($ref in @('System.Windows.Forms.dll','System.Drawing.dll','System.Web.Extensions.dll',
 'System.IO.Compression.dll','System.IO.Compression.FileSystem.dll','Microsoft.CSharp.dll')){
 $compilerArgs+=('/reference:'+$ref)
}
$compilerArgs+=('/resource:'+$zip+',ImAccessibilityInstallerPayload')
$compilerArgs+=(Join-Path $source 'ImAccessibilitySetup.cs')
$compilerArgs+=(Join-Path $source 'InstallUpdate.cs')
$compilerArgs+=(Join-Path $source 'InstallSafety.cs')
& $csc @compilerArgs
if($LASTEXITCODE -ne 0){throw 'Windows installer EXE compiler failed'}
# Never mistake a successfully built private EXE for a cleared public release.
& $NodeExe (Join-Path $source 'audit-release.cjs') $stage (Join-Path $out 'release-audit.json') $exe
if($LASTEXITCODE -ne 0){throw 'Release audit detected package corruption or private data'}
$summary=[pscustomobject]@{
 file=$exe;sizeBytes=(Get-Item -LiteralPath $exe).Length
 sha256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant()
 files=$files.Count;nodeVersion=$nodeVersion;ffmpegVersion=$ffmpegVersion;privatePreview=$true;buildId=$buildId
}
$summary|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $out 'build-report.json') -Encoding UTF8
$summary|ConvertTo-Json -Compress
