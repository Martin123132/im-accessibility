'use strict';
const core=require('./package-core.cjs');
if(require.main===module){
 try{
  const result=core.install(__dirname);
  console.log('I’m-accessibility preview installed: '+result.folder);
  console.log('No services, tasks, firewall settings or TV pairing were started.');
  console.log('Configure %LOCALAPPDATA%\\ImAccessibility\\settings.json before using Start.cmd.');
 }catch(e){
  console.error('INSTALL_REFUSED '+String(e.message).slice(0,320));
  process.exitCode=1;
 }
}
