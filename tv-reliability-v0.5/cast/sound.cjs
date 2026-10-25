'use strict';
// Speaker-only WASAPI loopback is optional; original video-only HLS is the default.
// No microphone endpoint, Python runtime or network dependency.
// The native helper is a small project-owned .NET Framework executable.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const BINARY=path.join(__dirname,'native','LoopbackCapture.exe');
const SUPPORTED_SAMPLES=new Set(['f32le','s16le','s24le','s32le']);
function isAudioOptIn(value){return value==='1'}
function validFormat(f){
 return !!f&&f.ok===true&&f.capture==='default-speaker-output-loopback'&&
 typeof f.deviceIdHash==='string'&&/^[0-9a-f]{64}$/.test(f.deviceIdHash)&&
 SUPPORTED_SAMPLES.has(f.sampleFormat)&&
 Number.isInteger(f.sampleRate)&&f.sampleRate>=8000&&f.sampleRate<=192000&&
 Number.isInteger(f.channels)&&f.channels>=1&&f.channels<=8&&
 Number.isInteger(f.bitsPerSample)&&f.bitsPerSample>=16&&f.bitsPerSample<=32&&
 f.blockAlign===f.channels*(f.bitsPerSample/8);
}
function probe(binary=BINARY,spawnSync=cp.spawnSync){
 if(!fs.existsSync(binary))throw Error('Windows speaker-output helper is missing');
 const p=spawnSync(binary,['--probe'],{encoding:'utf8',windowsHide:true,timeout:3500,maxBuffer:2200});
 if(p.error||p.status!==0)throw Error('Windows speaker-output loopback unavailable');
 let f;try{f=JSON.parse(p.stdout)}catch{throw Error('Invalid audio probe response')}
 if(!validFormat(f))throw Error('Unsupported Windows speaker-output format');
 return Object.freeze({
  sampleFormat:f.sampleFormat,sampleRate:f.sampleRate,channels:f.channels,
  deviceIdHash:f.deviceIdHash
 });
}
function argsFor(streamDir,format=null,startNumber=0){
 if(!Number.isSafeInteger(startNumber)||startNumber<0||startNumber>999999)throw Error('Invalid bounded HLS media start number');
 const args=['-hide_banner','-loglevel','warning','-nostdin','-f','gdigrab','-framerate','15','-draw_mouse','1','-i','desktop'];
 if(format){
  if(!SUPPORTED_SAMPLES.has(format.sampleFormat)||!Number.isInteger(format.sampleRate)||
   format.sampleRate<8000||format.sampleRate>192000||!Number.isInteger(format.channels)||
   format.channels<1||format.channels>8)throw Error('Unverified loopback format');
  args.push('-thread_queue_size','512','-f',format.sampleFormat,
   '-ar',String(format.sampleRate),'-ac',String(format.channels),'-i','pipe:3');
 }
 args.push('-vf','scale=1280:-2','-map','0:v:0');
 if(format)args.push('-map','1:a:0');
 else args.push('-an');
 args.push('-c:v','libx264','-preset','veryfast','-tune','zerolatency',
   '-crf','28','-pix_fmt','yuv420p','-profile:v','main','-level','3.1',
   '-g','15','-keyint_min','15','-sc_threshold','0');
 if(format)args.push('-c:a','aac','-ac','2','-ar','48000','-b:a','128k',
   '-af','aresample=async=1:first_pts=0');
 args.push('-f','hls','-hls_time','1','-hls_list_size','4','-hls_delete_threshold','3',
   '-start_number',String(startNumber),
   '-hls_flags','delete_segments+temp_file+independent_segments',
   '-hls_segment_filename',path.join(streamDir,'segment%06d.ts'),
   path.join(streamDir,'index.m3u8'));
 return args;
}
module.exports={BINARY,isAudioOptIn,validFormat,probe,argsFor};
