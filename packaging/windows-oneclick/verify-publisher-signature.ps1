# Inspect, but never sign, the exact private Windows installer.
# No certificate material, signing secret or personal data is exported.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$Installer,
 [Parameter(Mandatory=$true)][string]$ReportPath
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if(!(Test-Path -LiteralPath $Installer -PathType Leaf)){throw 'Installer file does not exist'}
if(Test-Path -LiteralPath $ReportPath){throw 'Report already exists; refusing overwrite'}
if([IO.Path]::GetExtension($Installer) -ne '.exe'){throw 'Expected a Windows executable'}
$exe=[IO.Path]::GetFullPath($Installer)
$sha=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant()
$auth=Get-AuthenticodeSignature -LiteralPath $exe
$certs=@(Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue|
 Where-Object { $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) -and $_.NotBefore -le (Get-Date) })
$signTool=@(Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin' -Filter signtool.exe -Recurse -File -ErrorAction SilentlyContinue |
 Where-Object { $_.FullName -match '\\x64\\' }|Sort-Object FullName -Descending|Select-Object -First 1 -ExpandProperty FullName)
$toolStatus='NotRun'
if($signTool.Count -eq 1){
 if($auth.Status.ToString() -eq 'NotSigned'){$toolStatus='NotSigned'}
 else {
  # Verification failure is a reportable status, not a build-script crash.
  try{
   & $signTool[0] verify /pa /v $exe 2>$null | Out-Null
   $toolStatus=if($LASTEXITCODE -eq 0){'Valid'}else{'NotVerified'}
  }catch{$toolStatus='NotVerified'}
 }
}
$trusted=($auth.Status.ToString() -eq 'Valid' -and $toolStatus -eq 'Valid')
$report=[pscustomobject]@{
 product='ImAccessibility'
 at=(Get-Date).ToUniversalTime().ToString('o')
 binaryName=[IO.Path]::GetFileName($exe)
 sha256=$sha
 authStatus=$auth.Status.ToString()
 signtoolStatus=$toolStatus
 signtoolPresent=$signTool.Count -eq 1
 currentUserEligibleSigningCertificates=$certs.Count
 trustedSignatureVerified=$trusted
 signedOrModifiedByThisScript=$false
 publisherCertificateIssuedByThisScript=$false
 publicReleaseApprovedByThisScript=$false
 blockers=@(if(!$trusted){'Not signed with a validated publicly trusted publisher identity'}
  if($certs.Count -eq 0){'No usable code-signing certificate for this Windows user'}
  'Owner-approved certificate route, licence and release distribution permission still required')
}
$folder=Split-Path -Parent $ReportPath
if(!(Test-Path -LiteralPath $folder -PathType Container)){throw 'Report destination directory does not exist'}
[IO.File]::WriteAllText([IO.Path]::GetFullPath($ReportPath),($report|ConvertTo-Json -Depth 5)+[Environment]::NewLine,
 (New-Object System.Text.UTF8Encoding($false)))
[pscustomobject]@{
 file=$report.binaryName
 sha256=$report.sha256
 authStatus=$report.authStatus
 signtoolStatus=$report.signtoolStatus
 eligibleCertificateCount=$report.currentUserEligibleSigningCertificates
 publicTrusted=$report.trustedSignatureVerified
 report=[IO.Path]::GetFullPath($ReportPath)
}|ConvertTo-Json -Compress
