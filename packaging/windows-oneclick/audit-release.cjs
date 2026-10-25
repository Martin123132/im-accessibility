'use strict';
// Read-only software distribution audit: never signs, publishes, pairs or streams.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const TEMPLATE_SHA='2159d4e54dc38e3626a95f496a2e6c2f071b541bd07e2e0657c8acbbcdd9d9e8';
const REQUIRED=['THIRD_PARTY/Node-LICENSE.txt','THIRD_PARTY/FFmpeg-LICENSE.txt',
 'THIRD_PARTY/FFmpeg-README.txt','tv-reliability-v0.5/cast/node_modules/lgtv2/LICENSE',
 'tv-reliability-v0.5/cast/node_modules/ws/LICENSE'];
const PRIVATE=/(^|\/)(?:\.env(?:\..*)?|settings\.json|session\.json|private-access\.json|client-key(?:\..*)?|credentials?(?:\.json)?|secrets?(?:\.json)?|[^/]+\.pfx|[^/]+\.pem|[^/]+\.sqlite|[^/]+\.jsonl)$/i;
function hash(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
function safe(p){return typeof p==='string'&&/^[A-Za-z0-9._/-]+$/.test(p)&&!p.startsWith('/')&&!p.includes('\\')&&!p.split('/').some(x=>x==='.'||x==='..'||!x)}
function privateFile(e){if(e.path==='tv-reliability-v0.5/cast/node_modules/lgtv2/pairing.json')return e.sha256!==TEMPLATE_SHA;return PRIVATE.test(e.path)}
function flags(v){return new Set(v.match(/--enable-[A-Za-z0-9_-]+/g)||[])}
function execute(program,args){const r=spawnSync(program,args,{encoding:'utf8',windowsHide:true,timeout:6000,maxBuffer:3000000});if(r.error||r.status!==0)throw Error('Metadata command failed: '+path.basename(program));return (r.stdout||'')+'\n'+(r.stderr||'')}
function sign(exe){
 if(!exe||!fs.existsSync(exe))return 'not-provided';
 if(process.platform!=='win32')return 'unverified-nonwindows';
 try{return execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',"(Get-AuthenticodeSignature -LiteralPath '"+exe.replace(/'/g,"''")+"').Status.ToString()"]).trim()}catch{return 'unverified'}
}
function audit(stage,installer){
 const meta=JSON.parse(fs.readFileSync(path.join(stage,'installer-manifest.json'),'utf8'));
 if(meta.product!=='ImAccessibility'||!Array.isArray(meta.files)||meta.files.length<80||meta.files.length>200)throw Error('Unrecognised product/manifest');
 const set=new Set(),byPath=new Map(),failures=[],privatePaths=[];
 for(const e of meta.files){
  if(!safe(e.path)||set.has(e.path.toLowerCase()))throw Error('Unsafe or duplicate manifest path');
  set.add(e.path.toLowerCase());byPath.set(e.path,e);
  const full=path.resolve(stage,...e.path.split('/'));
  if(!full.startsWith(path.resolve(stage)+path.sep))throw Error('Manifest path escapes release directory');
  if(!fs.existsSync(full)||!fs.statSync(full).isFile()||fs.statSync(full).size!==e.bytes||hash(full)!==e.sha256){failures.push(e.path);continue}
  if(privateFile(e))privatePaths.push(e.path);
 }
 const missingNotices=REQUIRED.filter(p=>!byPath.has(p));
 const nativeSourceGaps=[];
 for(const e of meta.files.filter(x=>/\/native\/[^/]+\.exe$/i.test(x.path))){
  const base=e.path.replace(/\.exe$/i,'');
  if(!['.cs','.cs.txt','.c','.cpp'].some(ext=>byPath.has(base+ext)))nativeSourceGaps.push(e.path);
 }
 const node=path.join(stage,'Runtime','node.exe'),ffmpeg=path.join(stage,'Runtime','ffmpeg.exe');
 const nodeVersion=execute(node,['-p','process.version']).trim();
 const ff=execute(ffmpeg,['-hide_banner','-buildconf']);
 const fswitches=flags(ff);
 const ffmpegVersion=ff.split(/\r?\n/).find(s=>s.startsWith('ffmpeg version '))||'unknown';
 const packages={};
 for(const name of ['ws','lgtv2']){
  const rel='tv-reliability-v0.5/cast/node_modules/'+name+'/package.json';
  if(!byPath.has(rel)){packages[name]={missing:true};continue}
  const d=JSON.parse(fs.readFileSync(path.join(stage,...rel.split('/')),'utf8'));
  packages[name]={version:d.version,license:d.license,licenseIncluded:byPath.has('tv-reliability-v0.5/cast/node_modules/'+name+'/LICENSE')};
 }
 const blockers=[];
 if(failures.length)blockers.push('Package payload hash/size failure');
 if(privatePaths.length)blockers.push('Proposed package contains private/session paths');
 if(missingNotices.length)blockers.push('Missing bundled third-party licence notices');
 if(nativeSourceGaps.length)blockers.push('Native helper needs verified build provenance');
 if(fswitches.has('--enable-nonfree'))blockers.push('FFmpeg --enable-nonfree redistribution prohibited');
 if(fswitches.has('--enable-gpl'))blockers.push('GPL-enabled FFmpeg exact corresponding sources, build recipes and codec components not evidenced');
 else blockers.push('LGPL-mode FFmpeg source and notices still need review');
 const signature=sign(installer);
 if(signature!=='Valid')blockers.push('Trusted publisher signing not established');
 blockers.push('Native helper build provenance and third-party redistribution rights still need owner review');
 blockers.push('Noncommercial repository licence and intended customer distribution rights need owner approval');
 blockers.push('Owner release/licence approval outstanding');
 blockers.push('Human Narrator/NVDA speech and Windows 11 compatibility not accepted');
 return {schema:1,product:'ImAccessibility',version:meta.version,createdUtc:new Date().toISOString(),
  files:meta.files.length,integrity:{failures,passed:meta.files.length-failures.length},
  privacy:{flaggedPaths:privatePaths,upstreamPairingTemplate:byPath.get('tv-reliability-v0.5/cast/node_modules/lgtv2/pairing.json')?.sha256===TEMPLATE_SHA},
  runtimes:{nodeVersion,nodeSha256:hash(node),ffmpegVersion,ffmpegSha256:hash(ffmpeg),
   ffmpegFlags:{gpl:fswitches.has('--enable-gpl'),version3:fswitches.has('--enable-version3'),
    nonfree:fswitches.has('--enable-nonfree'),x264:fswitches.has('--enable-libx264'),x265:fswitches.has('--enable-libx265')}},
  packages,missingNotices,nativeSourceGaps,installerSignature:signature,
  readyForPublicDistribution:false,blockers};
}
function main(args){
 if(args.length<2||args.length>3)throw Error('Usage: node audit-release.cjs STAGE_DIR NEW_REPORT_FILE [SETUP_EXE]');
 const [stage,report,exe]=args;if(fs.existsSync(report))throw Error('Audit report exists; refusing overwrite');
 const r=audit(path.resolve(stage),exe&&path.resolve(exe));
 fs.writeFileSync(report,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({payloadPassed:r.integrity.passed,integrityFailures:r.integrity.failures.length,
  privacyFlags:r.privacy.flaggedPaths.length,gpl:r.runtimes.ffmpegFlags.gpl,
  installerSignature:r.installerSignature,blockers:r.blockers,report}));
 if(r.integrity.failures.length||r.privacy.flaggedPaths.length)process.exitCode=3;
}
if(require.main===module)try{main(process.argv.slice(2))}catch(e){console.error('RELEASE_AUDIT_ERROR '+e.message);process.exitCode=1}
module.exports={audit,safe,privateFile,flags,TEMPLATE_SHA};
