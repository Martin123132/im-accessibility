'use strict';
const core=require('./package-core.cjs');
if(require.main===module){
 try{
  const expected=core.destFor(process.env);
  if(require('node:path').resolve(__dirname).toLowerCase()!==expected.toLowerCase())
   throw Error('Uninstaller is not running from its exact per-user installation');
  const result=core.uninstall();
  console.log('I’m-accessibility preview uninstalled: '+result.removedFiles+' known files.');
  console.log('User TV settings were preserved outside the program directory.');
 }catch(e){
  console.error('UNINSTALL_REFUSED '+String(e.message).slice(0,320));
  process.exitCode=1;
 }
}
