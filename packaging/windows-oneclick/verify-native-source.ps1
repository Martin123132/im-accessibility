# Rebuild ONLY the three pinned Windows .NET helpers into a disposable folder.
# Never execute the helpers, alter the shipped binaries or interact with the TV.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$TvBundleRoot,
 [Parameter(Mandatory=$true)][string]$OutputDirectory
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$folder=Split-Path -Parent $MyInvocation.MyCommand.Path
$repo=[IO.Path]::GetFullPath((Join-Path $folder '..\..'))
$pins=Get-Content -LiteralPath (Join-Path $folder 'native-source-pins.json') -Raw|ConvertFrom-Json
$csc=[string]$pins.compiler
if(!(Test-Path -LiteralPath $csc)){throw 'Pinned C# toolchain absent'}
if(Test-Path -LiteralPath $OutputDirectory){throw 'Refusing to overwrite existing output'}
$root=[IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $root -ErrorAction Stop|Out-Null
$reports=@()
foreach($entry in $pins.entries){
 $name=[string]$entry.name
 $src=Join-Path $repo ([string]$entry.source).Replace('/','\')
 $binary=Join-Path $TvBundleRoot ([string]$entry.binary).Replace('/','\')
 $output=Join-Path $root ([string]$entry.compiledAssembly)
 foreach($file in @($src,$binary)){if(!(Test-Path -LiteralPath $file -PathType Leaf)){throw ('Missing '+$name+' input '+$file)}}
 $sourceHash=(Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash.ToLowerInvariant()
 $binaryHash=(Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash.ToLowerInvariant()
 if($sourceHash -ne [string]$entry.sourceSHA256 -or $binaryHash -ne [string]$entry.binarySHA256){
  throw ('Version-pinned source/binary SHA mismatch: '+$name)
 }
 $compilerArgs=@('/nologo','/target:exe','/optimize+','/platform:anycpu')
 $compilerArgs+=('/out:'+$output)
 $compilerArgs+=$src
 & $csc @compilerArgs
 if($LASTEXITCODE -ne 0){throw ('Native source compilation failed: '+$name)}
 $ref=[IO.File]::ReadAllBytes($binary)
 $new=[IO.File]::ReadAllBytes($output)
 if($ref.Length -ne [int]$entry.size -or $new.Length -ne $ref.Length){throw ('PE image size differs: '+$name)}
 $mvidOffset=[int]$entry.moduleGuidOffset
 if($mvidOffset+16 -gt $ref.Length){throw ('Invalid GUID metadata slot: '+$name)}
 $differenceCount=0
 $unexpected=@()
 for($i=0;$i -lt $ref.Length;$i++){
  if($ref[$i] -ne $new[$i]){
   $differenceCount++
   $allowed=($i -ge 136 -and $i -le 139) -or ($i -ge $mvidOffset -and $i -lt $mvidOffset+16)
   if(!$allowed){$unexpected+= $i}
  }
 }
 if($unexpected.Count -or $differenceCount -lt 12 -or $differenceCount -gt 20){
  throw ('Compiled method/metadata mismatch for '+$name+' at '+(($unexpected|Select-Object -First 15) -join ','))
 }
 $reports+= [pscustomobject]@{
  helper=$name
  sourceSHA256=$sourceHash
  shippedExeSHA256=$binaryHash
  rebuiltExeSHA256=(Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()
  assemblyName=[string]$entry.compiledAssembly
  binaryBytes=$ref.Length
  byteDifferences=$differenceCount
  unexpectedByteDifferences=0
  checkedCompilerMetadataSlots=@('PE timestamp [136..139]',('16-byte module GUID ['+$mvidOffset+'..'+($mvidOffset+15)+']'))
  executedHelper=$false
 }
}
$report=Join-Path $root 'native-verification.json'
$doc=[pscustomobject]@{
 atUtc=[DateTime]::UtcNow.ToString('o')
 sourceDirectory=$repo
 baselineDirectory=[IO.Path]::GetFullPath($TvBundleRoot)
 compiler=$csc
 cscFlags=$pins.flags
 pinsHash=(Get-FileHash -LiteralPath (Join-Path $folder 'native-source-pins.json') -Algorithm SHA256).Hash.ToLowerInvariant()
 sourceCorrelatedWithShippedBinaries=$true
 byteExactReproducibility=$false
 reason='Classic CSC emits fresh PE timestamps and CLR module GUIDs; all other bytes match at pinned source+binary versions.'
 helpers=$reports
}
[IO.File]::WriteAllText($report,($doc|ConvertTo-Json -Depth 6)+[Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
[pscustomobject]@{result='PASS';helperCount=$reports.Count;fileHashesPinned=$true;compiledBodyEqualExcludingCompilerMetadata=$true;detail=$report;helpers=$reports}|ConvertTo-Json -Depth 6 -Compress
