param(
 [Parameter(Mandatory=$true)][string]$InputDirectory,
 [Parameter(Mandatory=$true)][string]$NewBuildDirectory
)
$ErrorActionPreference='Stop'
# Docker must already be available. Starting Desktop can restart unrelated
# containers, so this script deliberately never starts or stops Desktop itself.
$image='imaccessibility-ffmpeg-original:20261107'
$expected=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'upstream-image-config.json') | ConvertFrom-Json
$inspected=docker image inspect $image
if($LASTEXITCODE -ne 0){throw 'Load the hash-verified original image first.'}
$actual=($inspected | ConvertFrom-Json)[0]
if(($actual.RootFS.Layers -join "`n") -cne ($expected.rootfs.diff_ids -join "`n") -or
   ($actual.Config.Env -join "`n") -cne ($expected.config.Env -join "`n")){
 throw 'The loaded image does not match the pinned filesystem and environment.'
}
$buildPath=[IO.Path]::GetFullPath($NewBuildDirectory)
if(Test-Path -LiteralPath $buildPath){throw 'Use a NEW disposable build directory.'}
$inputPath=(Resolve-Path -LiteralPath $InputDirectory).Path
$pins=@{
 'FFmpeg-d4070a14ce.zip'='1c472b0d819c2c5a94948bd4fabda6d126b1f2126122667e35030d2914a4c7c1'
 'FFmpeg-Builds-c63bb308.zip'='44fe4f6ff1de441e002e68442fd1d4187a3de66d280b523eb720733ec48e4789'
 '45-lcms2_27eacdf84d36c11c81718d5dd6d380178c11eaff50511b1b8526eb3aa4924635.tar.xz'='49708e34c6c02651042f552e17a41a8005c3d1d99c86cf90e50a5be79d9f31c4'
}
foreach($name in $pins.Keys){
 $hash=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $inputPath $name)).Hash
 if($hash -ine $pins[$name]){throw "Source archive differs: $name"}
}
$inputs=New-Item -ItemType Directory -Path (Join-Path $buildPath 'inputs')
$output=New-Item -ItemType Directory -Path (Join-Path $buildPath 'output')
foreach($name in $pins.Keys){Copy-Item -LiteralPath (Join-Path $inputPath $name) -Destination $inputs.FullName}
foreach($name in @('exclude-unused-copyleft.patch','rebuild-in-container.sh')){
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $inputs.FullName
}
$name='imaccessibility-ffmpeg-'+[guid]::NewGuid().ToString('N')
$container=$null
try {
 $container=docker run --detach --name $name --label imaccessibility.task=ffmpeg-private-rebuild `
  --network none --cpus 2 --memory 6g --memory-swap 6g --pids-limit 256 --cap-drop ALL `
  --security-opt no-new-privileges `
  --mount "type=bind,source=$($inputs.FullName),target=/inputs,readonly" `
  --mount "type=bind,source=$($output.FullName),target=/output" `
  --entrypoint bash $actual.Id /inputs/rebuild-in-container.sh
 if($LASTEXITCODE -ne 0 -or $container -notmatch '^[0-9a-f]{64}$'){throw 'Could not start isolated build.'}
 $container=$container.Trim()
 docker inspect $container | Set-Content -LiteralPath (Join-Path $buildPath 'container-start.json')
 Write-Output "Build started. Log: $($output.FullName)\build.log"
 do {
  Start-Sleep -Seconds 5
  $state=docker inspect $container --format '{{json .State}}' | ConvertFrom-Json
  if($LASTEXITCODE -ne 0){throw 'Lost build-container status.'}
 } while($state.Running)
 docker inspect $container | Set-Content -LiteralPath (Join-Path $buildPath 'container-finished.json')
 if($state.ExitCode -ne 0 -or !(Test-Path -LiteralPath (Join-Path $output.FullName 'BUILD_COMPLETE'))){
  throw "Build failed with exit $($state.ExitCode); retained log: $($output.FullName)\build.log"
 }
 Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $output.FullName 'bin\ffmpeg.exe'),(Join-Path $output.FullName 'bin\ffprobe.exe')
} finally {
 if($container -match '^[0-9a-f]{64}$'){
  $owned=docker inspect $container | ConvertFrom-Json
  if($LASTEXITCODE -eq 0 -and $owned[0].Name -ceq ('/'+$name)){
   if($owned[0].State.Running){docker stop --timeout 20 $container | Out-Null}
   docker rm $container | Out-Null
   if($LASTEXITCODE -ne 0){throw 'Could not remove the task-owned build container.'}
  }
 }
}
