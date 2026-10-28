import {liveEdge} from './live-core.js';
import {observeAudio} from './audio-routing.js';

// Followers own decoding/clocks; AudioRouter exclusively owns audible output.
export class Companion{
 constructor(primary,secondary,{getApi,getInfo,getView,getHls,onError,onReady=()=>{},onAudio=()=>{},onAudioBlocked=()=>{},independent=()=>false}){
  Object.assign(this,{primary,secondary,getApi,getInfo,getView,getHls,onError,onReady,onAudio,onAudioBlocked,independent});this.epoch=0;this.active=false;this.loading=false;
  for(const type of ['play','pause','seeking','seeked','ratechange','timeupdate'])primary.addEventListener(type,()=>this.sync(type==='seeking'||type==='seeked'));
  secondary.addEventListener('loadedmetadata',()=>this.sync(true));secondary.addEventListener('error',()=>{if(this.active)this.fail('直播来源连接失败');});
 }
 stop(){this.epoch++;this.active=false;this.loading=false;this.controller?.abort();this.unobserve?.();this.unobserve=null;this.hls?.destroy();this.flv?.destroy();this.hls=null;this.flv=null;this.secondary.pause();this.secondary.muted=true;this.secondary.removeAttribute('src');this.secondary.load();this.view=null;}
 fail(message){const view=this.view;this.stop();this.onError(message,view);}
 sync(force=false){
  if(!this.active)return;const a=this.primary,b=this.secondary,live=this.getInfo()?.mode==='live';
  if(b.playbackRate!==a.playbackRate)b.playbackRate=a.playbackRate;
  if(b.readyState&&!this.independent()){
   let target=a.currentTime;if(live){const edgeA=liveEdge(a,this.getHls()),edgeB=liveEdge(b,this.hls);target=edgeA==null||edgeB==null?null:edgeB-(edgeA-a.currentTime);}
   if(target!=null&&Number.isFinite(target)&&(force||Math.abs(b.currentTime-target)>(live?2:.45))){target=Math.max(0,Number.isFinite(b.duration)?Math.min(target,Math.max(0,b.duration-.1)):target);if(Math.abs(b.currentTime-target)>.1)b.currentTime=target;}
  }
  if(a.paused||a.ended){if(!b.paused)b.pause();}else if(b.paused){const epoch=this.epoch,audible=!b.muted;void b.play().catch(error=>{if(error.name==='NotAllowedError'&&this.active&&epoch===this.epoch&&audible){this.onAudioBlocked(b);b.muted=true;void b.play().catch(()=>{});}});}
 }
 async start(view){
  this.stop();const epoch=this.epoch,api=this.getApi(),info=this.getInfo(),live=info?.mode==='live';this.view=view;this.loading=true;this.controller=new AbortController();const signal=this.controller.signal;
  try{
   const candidates=live?info.candidates?.[view]||[]:[{url:info.streams[view]}];let source;
   for(const candidate of candidates){if(candidate.format==='flv'&&!globalThis.mpegts?.isSupported())continue;await api.prepareMedia?.(signal,candidate.url);signal.throwIfAborted();const probe=await api.probeMedia(candidate.url,signal);if(probe.ok){source=candidate.url;break;}}
   signal.throwIfAborted();if(epoch!==this.epoch)return;if(!source)throw new Error('所选来源暂不可用');
   const url=api.sign(source),video=this.secondary;this.active=true;this.loading=false;const onAudio=present=>{if(epoch===this.epoch)this.onAudio(view,present);};
   if(/\.mp4$/i.test(new URL(source).pathname)){this.unobserve=observeAudio(video,{onAudio});video.preload='metadata';video.src=url;}
   else if(/\.flv$/i.test(new URL(source).pathname)){
    if(!globalThis.mpegts?.isSupported())throw new Error('浏览器不支持此直播来源');
    this.flv=mpegts.createPlayer({type:'flv',isLive:live,url,cors:true,withCredentials:true},{enableWorker:false,enableStashBuffer:false,lazyLoad:false,autoCleanupSourceBuffer:true});
    this.unobserve=observeAudio(video,{flv:this.flv,onAudio});this.flv.on(mpegts.Events.ERROR,()=>{if(epoch===this.epoch)this.fail('直播来源连接失败');});this.flv.attachMediaElement(video);this.flv.load();
   }else if(globalThis.Hls?.isSupported()){
    this.hls=new Hls({enableWorker:false,lowLatencyMode:live,maxBufferLength:12,maxMaxBufferLength:20,backBufferLength:8,maxBufferSize:20*1024*1024,
     async xhrSetup(xhr,raw){await api.prepareMedia?.(signal,raw);signal.throwIfAborted();xhr.open('GET',api.sign(raw),true);xhr.withCredentials=true;}});
    this.unobserve=observeAudio(video,{hls:this.hls,onAudio});this.hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal&&epoch===this.epoch)this.fail('直播来源连接失败');});this.hls.loadSource(url);this.hls.attachMedia(video);
   }else throw new Error('浏览器不支持此直播来源');
   this.onReady(view,video);this.sync(true);
  }catch(error){if(epoch===this.epoch&&error.name!=='AbortError')this.fail(error.message);}
 }
}
