'use strict';
// Reproducible payload manifest and source-only portable TV bundle builder.
// Does not create a Windows installer task, start TV services or access accounts.
const fs=require('node:fs'),path=require('node:path');
const core=require('./package-core.cjs');
const repo=path.resolve(__dirname,'..');
const version='v0.3.21-independent-audio-guard-private-preview';
const tv=[
 'lg-pair.cjs','lg-active-view.cjs','release-config.cjs','viewing-policy.cjs','resume.cjs','resume-host.cjs',
 'cast/lan.cjs','cast/lg-launch.cjs','cast/package.json','cast/package-lock.json',
 'cast/server.cjs','cast/sound.cjs','cast/native/LoopbackCapture.cs.txt',
 'cast/native/LoopbackCapture.exe','cast/native/SpeakerEndpoint.cs.txt',
 'cast/native/SpeakerEndpoint.exe','cast/tv-discovery.cjs',
 'cast/web/controller.html','cast/web/controller.js','cast/web/style.css',
 'cast/web/tv.html','cast/web/tv.js',
 'viewer/server.cjs','viewer/snapshot.cjs','viewer/fast-video.cjs','viewer/speaker-routing.cjs',
 'viewer/speaker-route-watch.cjs','viewer/native/TvPointer.cs',
 'viewer/native/TvPointer.exe','viewer/web/style.css','viewer/web/viewer.html',
 'viewer/web/immersive.html','viewer/web/immersive.css','viewer/web/immersive.js',
 'viewer/web/fast-video.js',
 'viewer/web/viewer.js'
];
function textFile(target,source){
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);
}
function launcher(lines){return lines.join('\r\n')+'\r\n'}
function build(out){
 const dest=path.resolve(out||'');
 if(!out||dest===repo||dest.startsWith(repo+path.sep)===false&&process.platform!=='win32')
  throw Error('Explicit output directory is required');
 if(fs.existsSync(dest))throw Error('Bundle destination exists; refusing overwrite');
 fs.mkdirSync(dest,{recursive:true});
 let ok=false;
 try{
  const payload=path.join(dest,'payload');
  fs.mkdirSync(payload);
  const copied=[];
  function copy(source,relative){
   const name=core.rel(relative),to=core.locate(payload,name);
   const bytes=fs.readFileSync(source);
   fs.mkdirSync(path.dirname(to),{recursive:true});
   fs.writeFileSync(to,bytes,{flag:'wx'});
   copied.push({path:name,bytes:bytes.length,sha256:core.sha(bytes)});
  }
  for(const rel of tv)copy(path.join(repo,'tv-reliability-v0.5',...rel.split('/')),'tv-reliability-v0.5/'+rel);
  const mods=['lgtv2','ws'];
  for(const m of mods){
   const source=path.join(repo,'tv-reliability-v0.5','cast','node_modules',m);
   if(!fs.existsSync(path.join(source,'LICENSE')))throw Error('Missing pinned MIT notice: '+m);
   const pkg=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));
   const pinned={lgtv2:'2.0.2',ws:'8.22.0'};
   if(pkg.name!==m||pkg.version!==pinned[m]||pkg.license!=='MIT')
    throw Error('Dependency provenance differs: '+m);
   for(const f of core.files(source))copy(path.join(source,...f.split('/')),
      'tv-reliability-v0.5/cast/node_modules/'+m+'/'+f);
  }
  copy(path.join(repo,'LICENSE'),'LICENSE');
  copy(path.join(repo,'NOTICE.md'),'NOTICE.md');
  copy(path.join(repo,'docs','CONFIGURATION.md'),'CONFIGURATION.md');
  copy(path.join(repo,'docs','LG_AUDIO_CLOCKFIX_2026-10-24.md'),'LG_AUDIO_CLOCKFIX_2026-10-24.md');
  copy(path.join(__dirname,'package-core.cjs'),'package-core.cjs');
  copy(path.join(__dirname,'first-run.cjs'),'first-run.cjs');
  copy(path.join(__dirname,'launch-host.cjs'),'launch-host.cjs');
  copy(path.join(__dirname,'uninstall.cjs'),'Uninstall.cjs');
  copy(path.join(__dirname,'stop-session.cjs'),'stop-session.cjs');
  copy(path.join(__dirname,'status-session.cjs'),'status-session.cjs');
  // Optional on-demand, per-user guardian. Packaging does not register it.
  copy(path.join(__dirname,'windows-oneclick','audio-guard-task.ps1'),'audio-guard-task.ps1');
  function add(name,lines){
   const value=Buffer.from(launcher(lines),'utf8');
   fs.writeFileSync(path.join(payload,name),value,{flag:'wx'});
   copied.push({path:name,bytes:value.length,sha256:core.sha(value)});
  }
  add('Setup.cmd',['@echo off','setlocal','where node.exe >nul 2>&1',
   'if errorlevel 1 (echo Node.js required & pause & exit /b 2)',
   'node.exe "%~dp0first-run.cjs" --wizard',
   'set "EXITCODE=%errorlevel%"','pause','exit /b %EXITCODE%']);
  add('Start.cmd',['@echo off','setlocal','where node.exe >nul 2>&1',
   'if errorlevel 1 (echo Node.js required & exit /b 2)',
   'node.exe "%~dp0launch-host.cjs" --start',
   'set "EXITCODE=%errorlevel%"',
   'if not "%EXITCODE%"=="0" pause',
   'exit /b %EXITCODE%']);
  add('StartSound.cmd',['@echo off','setlocal','where node.exe >nul 2>&1',
   'if errorlevel 1 (echo Node.js required & exit /b 2)',
   'set "IM_ACCESSIBILITY_TV_AUDIO=1"','node.exe "%~dp0launch-host.cjs" --start',
   'set "EXITCODE=%errorlevel%"','if not "%EXITCODE%"=="0" pause',
   'exit /b %EXITCODE%']);
  add('Stop.cmd',['@echo off','setlocal','where node.exe >nul 2>&1',
   'if errorlevel 1 (echo Node.js required & exit /b 2)',
   'node.exe "%~dp0stop-session.cjs"','exit /b %errorlevel%']);
  add('Status.cmd',['@echo off','setlocal','where node.exe >nul 2>&1',
   'if errorlevel 1 (echo Node.js required & exit /b 2)',
   'node.exe "%~dp0status-session.cjs"','exit /b %errorlevel%']);
  add('Uninstall.cmd',['@echo off','setlocal','where node.exe >nul 2>&1',
   'if errorlevel 1 (echo Node.js required & exit /b 2)',
   'node.exe "%~dp0Uninstall.cjs"','exit /b %errorlevel%']);
  copied.sort((a,b)=>a.path.localeCompare(b.path,'en'));
  const manifest={format:1,product:core.PRODUCT,version,files:copied};
  const integrity=core.verify(payload,manifest);
  fs.writeFileSync(path.join(dest,'package-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  textFile(path.join(dest,'install.cjs'),path.join(__dirname,'install.cjs'));
  textFile(path.join(dest,'package-core.cjs'),path.join(__dirname,'package-core.cjs'));
  fs.writeFileSync(path.join(dest,'Install.cmd'),launcher(['@echo off','setlocal',
   'where node.exe >nul 2>&1','if errorlevel 1 (echo Node.js required & exit /b 2)',
   'node.exe "%~dp0install.cjs"','exit /b %errorlevel%']),{flag:'wx'});
  fs.writeFileSync(path.join(dest,'README-FIRST.txt'),[
   'I’m-accessibility TV-first portable PREVIEW, '+version,
   'Double-click Install.cmd or run node install.cjs from this extracted folder.',
   'Requires Node.js 24; FFmpeg stays a separate local prerequisite.',
   'Installation does not launch TV, create Windows tasks or pair any device.',
   'Run Setup.cmd in the installed folder to select your PC adapter, LG TV and tool locations.',
   'Run Start.cmd only after owner-confirmed setup; it checks TV identity and refuses active/uncertain sessions.',
   'Start.cmd keeps speaker audio OFF; StartSound.cmd explicitly opts into Windows speaker-output audio.',
   'v0.3.21: configured TV-only muting requires a separately approved independent Windows audio guardian. Until enabled, attempts to mute laptop sound safely fail.',
   'Optional task setup (owner action only): use audio-guard-task.ps1 -Action Enable -OwnerConsent YES after review. Read-only Status and owner-approved Disable are available.',
   'Installing the application does not register, start or schedule any Windows task. The guardian never opens or controls the TV.',
   'Experimental v0.3.16 rebuild of LoopbackCapture.exe fixes Windows silent-audio PCM pacing (48kHz output), provenance in LG_AUDIO_CLOCKFIX_2026-10-24.md.',
   'Sound starts on TV only and temporarily mutes the selected laptop speaker output. Select Laptop sound ON to use both rooms.',
   'Laptop-only sound returns when TV playback is disabled. End, closing the TV or losing its heartbeat restores the original Windows speaker mute state.',
   'The TV Sound button is enabled only when the HLS source contains audio; video remains muted until the owner presses it.',
   'An encoder-stall watchdog restarts only the video capture; if sound repeatedly stalls, video-only fallback preserves desktop control.',
   'Interactive mode follows the HLS live edge; Cinema mode retains buffer for higher quality and smooth film viewing.',
   'Fullscreen TV controls open under the small top-left menu icon; the bottom-right of Windows is unobstructed.',
   'Cinema 1080p/30fps uses H.264 CRF18, two-second HLS segments and a 36-second playlist window. Switch back to Interactive 720p/15fps from the TV controls; Cinema disarms Windows mouse.',
   'Try faster video opens a separate full-screen MSE-only viewer with the identical controls; original HLS is the default and Return to HLS reopens its own page.',
   'Fast mode uses the same 720p H.264/AAC quality settings, does not grant Windows mouse permission and runs only while selected by the owner.',
   'If LG fast-video decoder frames stop advancing, it seeks toward live, then reconnects a bounded number of times; repeated stalls restore original HLS.',
   'Fast mode now limits hardware decoder seeks and MSE memory pruning, keeping at least eight seconds behind the playhead and twelve seconds near the live edge.',
   'The same private fast-video WebSocket reports decoder frame counts for read-only diagnostics; no Windows control actions or screen data are sent.',
   'Fast-video WebSocket disconnection also revokes Windows mouse access, protecting against clicks on a stale desktop picture.',
   'In an owner-started configured session, video continues until explicit Stop, a critical service exit or Windows shutdown; no four-hour automatic expiry. Historical unconfigured tests remain time-limited.',
   'The optional LG activity guard sends only bounded one-pixel TV pointer movements while the validated LG browser and live video are active.',
   'This does not disable OLED protection; Stop or switching away from the browser ends the signal.',
   'Stop.cmd requests shutdown; Uninstall.cmd removes only unchanged installed files.',
   'PC Bridge and Codex are NOT bundled. Binary provenance and Windows 11 TV acceptance pending.',
   'SHA-256 checksums are recorded in package-manifest.json.'
  ].join('\r\n')+'\r\n',{flag:'wx'});
  ok=true;
  return {out:dest,version,files:integrity.files,totalBytes:integrity.totalBytes,
   manifestSha256:core.sha(fs.readFileSync(path.join(dest,'package-manifest.json')))};
 }finally{if(!ok&&fs.existsSync(dest))fs.rmSync(dest,{recursive:true,force:true})}
}
if(require.main===module){
 try{console.log(JSON.stringify(build(process.argv[2]),null,2));}
 catch(e){console.error('BUNDLE_BUILD_FAILED '+String(e.message).slice(0,320));process.exitCode=1}
}
module.exports={build,version};
