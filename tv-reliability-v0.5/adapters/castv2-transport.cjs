'use strict';
// Experimental CastV2 Default Media Receiver sender transport.
// Deliberately not wired into GUI, Start TV or the public installer.
// Requires externally approved castv2-client library; production device
// authentication, dependency provenance and physical HLS playback still pending.
const {EventEmitter}=require('node:events');

function createTransport({library,timeoutMs=16000,stopTimeoutMs=3500}={}){
  if(!library||typeof library.Client!=='function'||!library.DefaultMediaReceiver)
    throw Error('Approved CastV2 client library required');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>25000||
     !Number.isSafeInteger(stopTimeoutMs)||stopTimeoutMs<500||stopTimeoutMs>8000)
    throw Error('Unsafe CastV2 timeout');
  let owned=null;
  function state(){
    return Object.freeze({connected:!!owned,receiver:'Google Cast',
      playerState:owned?.playerState||'not-connected'});
  }
  async function load({host,port,media}={}){
    if(owned)throw Error('A Cast media session is already owned by this adapter');
    if(typeof host!=='string'||port!==8009||!media||
       media.streamType!=='LIVE'||media.contentType!=='application/x-mpegurl')
      throw Error('Invalid guarded Cast media request');
    const client=new library.Client();
    if(!(client instanceof EventEmitter)&&typeof client.on!=='function')
      throw Error('CastV2 client must support error events');
    return new Promise((resolve,reject)=>{
      let player=null,ended=false;
      const finish=(error,status)=>{
        if(ended)return;ended=true;
        clearTimeout(timer);
        if(error){
          try{client.close();}catch{}
          return reject(Error('Cast receiver load failed'));
        }
        if(!status||status.playerState==='IDLE'){
          try{client.close();}catch{}
          return reject(Error('Cast receiver declined media playback'));
        }
        owned={client,player,playerState:['PLAYING','BUFFERING','PAUSED'].includes(status.playerState)?status.playerState:'unconfirmed'};
        resolve({acknowledged:true,playerState:owned.playerState});
      };
      const timer=setTimeout(()=>finish(Error('Cast receiver did not acknowledge request')),timeoutMs);
      client.on('error',error=>{if(ended&&owned?.client===client){owned=null;try{client.close()}catch{}}else finish(error);});
      try{
        client.connect(host,()=>{
          if(ended)return;
          client.launch(library.DefaultMediaReceiver,(error,launched)=>{
            if(ended)return;
            if(error||!launched||typeof launched.load!=='function')
              return finish(error||Error('Default Media Receiver unavailable'));
            player=launched;
            try{
              player.load(media,{autoplay:true},(error,status)=>{
                if(ended)return;
                finish(error,status);
              });
            }catch(e){finish(e)}
          });
        });
      }catch(e){finish(e)}
    });
  }
  async function stop(){
    if(!owned)return {stopped:false,reason:'no-owned-cast-session'};
    const {client,player}=owned;
    owned=null;
    // STOP only the media session this sender created; do not alter any other
    // receiver app, TV controls or Windows speaker routing.
    return new Promise(resolve=>{
      let done=false;
      const finish=(error)=>{
        if(done)return;done=true;
        clearTimeout(timer);
        try{client.close();}catch{}
        resolve({stopped:!error,reason:error?'receiver-did-not-acknowledge-stop':'owner-session-ended'});
      };
      const timer=setTimeout(()=>finish(Error('stop timeout')),stopTimeoutMs);
      try{
        if(!player||typeof player.stop!=='function')return finish(Error('stop unsupported'));
        player.stop(error=>finish(error));
      }catch(e){finish(e)}
    });
  }
  return Object.freeze({load,stop,state});
}

module.exports={createTransport};
