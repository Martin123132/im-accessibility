'use strict';
const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'tv-reliability-v0.5','runtime','state.json');
function status(){
 if(!fs.existsSync(file))return {state:'not-started',mouseEnabled:false};
 let state;try{state=JSON.parse(fs.readFileSync(file,'utf8'))}catch{throw Error('Cannot read owner session state')}
 const allowed=['runId','state','createdUtc','expectedEndUtc','viewer','stream','lg','updatedUtc'];
 const summary={};
 for(const key of allowed)if(Object.hasOwn(state,key))summary[key]=state[key];
 return summary;
}
if(require.main===module){
 try{console.log(JSON.stringify(status(),null,2));}
 catch(e){console.error('STATUS_ERROR '+String(e.message).slice(0,200));process.exitCode=1}
}
module.exports={status};
