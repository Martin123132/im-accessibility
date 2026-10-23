'use strict';
// Sanity-check repository packaging without using the network or running Windows actions.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const required=[
  'README.md','docs/SETUP.md','docs/V1_RELEASE_PLAN.md','docs/SECURITY.md',
  'tv-reliability-v0.5/cast/server.cjs','tv-reliability-v0.5/viewer/server.cjs',
  'tv-reliability-v0.5/release-config.cjs',
  'packaging/package-core.cjs','packaging/build-preview.cjs',
  'packaging/install.cjs','packaging/uninstall.cjs',
  'packaging/first-run.cjs','packaging/launch-host.cjs',
  'codex-chat-control-pilot-20261012/desk.cjs',
  'codex-chat-control-pilot-20261012/draft-ledger.cjs'
];
const issues=[];
for(const relative of required){
  if(!fs.existsSync(path.join(root,...relative.split('/'))))issues.push('Required file missing: '+relative);
}
const git=cp.spawnSync('git',['-C',root,'ls-files'],{encoding:'utf8',timeout:8000,windowsHide:true});
if(git.error||git.status!==0){issues.push('Could not inspect Git tracked files');}
else{
  const names=git.stdout.split(/\r?\n/).filter(Boolean);
  for(const name of names){
    if(/(^|\/)(runtime|evidence|node_modules|profiles|_private_tests)(\/|$)/i.test(name) ||
      /(^|\/)\.env(\.|$)/i.test(name) ||
      /\.(?:pem|p12|pfx|key|sqlite|db|jsonl)$/i.test(name))
      issues.push('Disallowed tracked path: '+name);
  }
}
if(issues.length){
  console.error('I’m-accessibility source check failed:\n'+issues.map(i=>' - '+i).join('\n'));
  process.exit(1);
}
console.log('I’m-accessibility source check passed. Required files present; tracked runtime/private paths excluded.');
