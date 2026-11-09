'use strict';
// Diagnostic only. A heartbeat cannot grant input permission or change audio.
class PlaybackHealth{
 constructor(tvIp,clock=()=>Date.now()){this.tvIp=tvIp;this.clock=clock;this.last=null;this.progressAt=null;}
 report(address,input){
  if(!this.tvIp||String(address).replace(/^::ffff:/,'')!==this.tvIp)throw Error('Only the selected TV may report playback');
  if(!input||Object.keys(input).sort().join(',')!=='currentTime,ended,error,hidden,paused,readyState'||
     !Number.isFinite(input.currentTime)||input.currentTime<0||input.currentTime>1e9||
     !Number.isInteger(input.readyState)||input.readyState<0||input.readyState>4||
     ['ended','error','hidden','paused'].some(k=>typeof input[k]!=='boolean'))throw Error('Invalid playback report');
  const now=this.clock();
  if(this.last&&now-this.last.at<10000&&input.currentTime>this.last.currentTime+0.05&&
     input.currentTime-this.last.currentTime<Math.max(2,(now-this.last.at)/1000+2))this.progressAt=now;
  if(input.paused||input.ended||input.error||input.hidden||input.readyState<2)this.progressAt=null;
  this.last={...input,at:now};
 }
 state(){
  const now=this.clock(),last=this.last;
  if(!last||now-last.at>10000)return 'unconfirmed';
  if(last.error)return 'error';
  if(last.hidden)return 'hidden';
  if(last.paused||last.ended)return 'paused';
  return this.progressAt!==null&&now-this.progressAt<10000?'playing':'buffering';
 }
}
module.exports={PlaybackHealth};
