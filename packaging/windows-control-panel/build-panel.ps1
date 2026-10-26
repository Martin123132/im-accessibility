# Build only the source preview TV status panel, with no installation or OS changes.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework/v4.0.30319/csc.exe'
if(!(Test-Path -LiteralPath $compiler -PathType Leaf)){throw 'Windows .NET Framework C# compiler required'}
foreach($file in @('TVControls.cs','TVFinderDialog.cs','TVFinder.cjs',
 'Owner-TV-Control.ps1','Run-Owner-TV.ps1','README.md')){
 if(!(Test-Path -LiteralPath (Join-Path $root $file) -PathType Leaf)){throw ('Source file missing: '+$file)}
}
$output=[IO.Path]::GetFullPath($OutputDirectory)
if(Test-Path -LiteralPath $output){throw 'Refusing to overwrite existing output directory'}
New-Item -ItemType Directory -Path $output -ErrorAction Stop|Out-Null
$exe=Join-Path $output 'ImAccessibility-TV-Controls.exe'
& $compiler /nologo /target:winexe /platform:anycpu /optimize+ ("/out:"+$exe) /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:Microsoft.CSharp.dll (Join-Path $root 'TVControls.cs') (Join-Path $root 'TVFinderDialog.cs')
if($LASTEXITCODE -ne 0){throw 'Windows TV control GUI compilation failed'}
foreach($file in @('TVFinder.cjs','Owner-TV-Control.ps1','Run-Owner-TV.ps1','README.md')){
 Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $output $file) -ErrorAction Stop
}
Write-Output ('SOURCE_PREVIEW_COMPILED '+$exe)
Write-Output ('SHA256='+(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant())
Write-Output 'NO_WINDOWS_TASK_OR_TV_STREAM_CREATED'
