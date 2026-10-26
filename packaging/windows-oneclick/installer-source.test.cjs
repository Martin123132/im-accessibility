'use strict';
// Source-contract checks only. No TV, Windows installer, network or account access.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('the click installer is graphical, embeds a checksum manifest and refuses install overwrite',()=>{
 const source=read('ImAccessibilitySetup.cs');
 assert.match(source,/Application\.Run\(new InstallerWindow\(\)\)/);
 assert.match(source,/GetManifestResourceStream\(PayloadResource\)/);
 assert.match(source,/ZipArchive\(stream,ZipArchiveMode\.Read/);
 assert.match(source,/Hash\(dest\)!=wanted/);
 assert.match(source,/if\(Directory\.Exists\(root\)\|\|File\.Exists\(root\)\)/);
 assert.match(source,/Directory\.Move\(stage,root\)/);
 assert.match(source,/Stop TV|TV streaming will NOT start|TV never starts/i);
 assert.doesNotMatch(source,/Application\.Run\(new MainWindow\(\)\)/);
});

test('installed app asks before starting or stopping TV and uses a local, narrow bridge',()=>{
 const ui=read('ImAccessibilityApp.cs');
 const bridge=read('gui-config-bridge.cjs');
 assert.match(ui,/MessageBox\.Show\(this,s,"Confirm TV start"/);
 assert.match(ui,/MessageBox\.Show\(this,"Stop this TV stream only\?"/);
 assert.match(ui,/Engine\.Run\("start",null,sound\.Checked\)/);
 assert.match(ui,/Engine\.Run\("stop",null,false\)/);
 assert.match(bridge,/Only the installed verified runtimes are permitted/);
 assert.match(bridge,/first\.saveSettings\(v\)/);
 assert.match(bridge,/launch\.main\(\['--start'\]\)/);
 assert.match(bridge,/stop\.stop\(\)/);
 assert.doesNotMatch(bridge,/eval\(|execSync\(|child_process/);
});

test('uninstaller keeps settings, checks every installed file hash and refuses active sessions',()=>{
 const src=read('ImAccessibilityUninstall.cs');
 assert.match(src,/SHA256\.Create\(\)/);
 assert.match(src,/digest.*sha256/);
 assert.match(src,/if\(mode!="stopped"\)/);
 assert.match(src,/Unrecognised installation receipt/);
 assert.match(src,/unrecognised file is present/i);
 assert.match(src,/settings are kept/i);
 assert.match(src,/Directory\.Delete\(root,true\)/);
});

test('accessibility annotations provide named roles, keyboard tab sequence and explicit selftests',()=>{
 const ui=read('ImAccessibilityApp.cs'),setup=read('ImAccessibilitySetup.cs');
 for(const name of ['PC network connection','LG television IPv4 address',
  'Start Windows desktop streaming to LG TV','Stop this application',
  'TV application activity and status messages']){
  assert.ok(ui.includes(name),'Missing screen-reader name: '+name);
 }
 for(let i=0;i<=9;i++)assert.match(ui,new RegExp('\\.TabIndex='+i+';'));
 assert.match(ui,/AccessibilityReport\(\)/);
 assert.match(ui,/--accessibility-selftest/);
 assert.match(ui,/KeyCode==Keys\.F5/);
 assert.match(setup,/install\.AccessibleName=/);
 assert.match(setup,/open\.AccessibleName=/);
 assert.match(setup,/output\.AccessibleName=/);
 assert.match(setup,/--accessibility-selftest/);
});

test('uninstall confirmation defaults No, remains keyboard accessible and has non-destructive GUI test',()=>{
 const code=read('ImAccessibilityUninstall.cs');
 assert.match(code,/MessageBoxDefaultButton\.Button2/);
 assert.match(code,/if\(ConfirmUninstall\(\)!=DialogResult\.Yes\)return;/);
 assert.match(code,/--dialog-selftest/);
 assert.match(code,/UseShellExecute=false/);
 assert.match(code,/GUI test is limited to the disposable test area/);
});

test('offline Windows builder takes explicit third-party licences and creates no public release',()=>{
 const script=read('build-oneclick.ps1');
 assert.match(script,/\$NodeLicense/);
 assert.match(script,/\$FFmpegLicense/);
 assert.match(script,/Refusing to overwrite existing output directory/);
 assert.match(script,/checksum mismatch/i);
 assert.match(script,/CreateFromDirectory/);
 assert.match(script,/PRIVATE/);
 assert.doesNotMatch(script,/Invoke-WebRequest|New-LocalUser|git push|gh release create/);
 for(const name of ['ImAccessibilityApp.cs','ImAccessibilityUninstall.cs','ImAccessibilitySetup.cs']){
  assert.match(script,new RegExp(name.replace('.','\\.')));
 }
});
