import {liveEdge} from './live-core.js';

// A second decoder follows the primary controls. It never starts before a user plays.
export class Companion {
 constructor(primary,secondary,{getApi,getInfo,getView,getHls,onError}){
  Object.assign(this,{primary,secondary,getApi,getInfo,getView,getHls,onError});this.epoch=0;this.active=false;
  for(const type of ['play','pause','seeking','seeked','ratechange','timeupdate','volumechange'])primary.addEventListener(type,()=>this.sync(type==='seeking'||type==='seeked'));
  secondary.addEventListener('loadedmetadata',()=>this.sync(true));
  secondary.addEventListener('error',()=>{if(this.active)this.fail('副画面连接失败');});
 }
 stop(){this.epoch++;this.active=false;this.controller?.abort();this.hls?.destroy();this.flv?.destroy();this.hls=null;this.flv=null;this.secondary.pause();this.secondary.removeAttribute('src');this.secondary.load();if(this.previousMuted!=null){this.primary.muted=this.previousMuted;this.previousMuted=null;}}
 fail(message){this.stop();this.onError(message);}
 setAudio(view){this.audio=view;this.primary.muted=view===this.view||view==='muted';this.sync();}
 sync(force=false){
  if(!this.active)return;
  const a=this.primary,b=this.secondary,live=this.getInfo()?.mode==='live';
  if(b.volume!==a.volume)b.volume=a.volume;if(b.muted!==(this.audio!==this.view))b.muted=this.audio!==this.view;if((this.audio===this.view||this.audio==='muted')&&!a.muted)a.muted=true;
  if(b.playbackRate!==a.playbackRate)b.playbackRate=a.playbackRate;
  if(b.readyState){
   let target=a.currentTime;
   if(live){const edgeA=liveEdge(a,this.getHls()),edgeB=liveEdge(b,this.hls);target=edgeA==null||edgeB==null?null:edgeB-(edgeA-a.currentTime);}
   if(target!=null&&Number.isFinite(target)&&(force||Math.abs(b.currentTime-target)>(live?2:0.45))){
    target=Math.max(0,Number.isFinite(b.duration)?Math.min(target,Math.max(0,b.duration-.1)):target);
    if(Math.abs(b.currentTime-target)>.1)b.currentTime=target;
   }
  }
  if(a.paused||a.ended){if(!b.paused)b.pause();}else if(b.paused)void b.play().catch(()=>{});
 }
 async start(view,audio){
  this.stop();const epoch=this.epoch,api=this.getApi(),info=this.getInfo(),live=info?.mode==='live';
  this.previousMuted=this.primary.muted;this.view=view;this.audio=audio;this.controller=new AbortController();const signal=this.controller.signal;
  try{
   const candidates=live?info.candidates?.[view]||[]:[{url:info.streams[view]}];let source;
   for(const candidate of candidates){if(candidate.format==='flv'&&!globalThis.mpegts?.isSupported())continue;const probe=await api.probeMedia(candidate.url,signal);if(probe.ok){source=candidate.url;break;}}
   signal.throwIfAborted();if(epoch!==this.epoch)return;if(!source)throw new Error('副画面暂不可用');
   const url=api.sign(source),video=this.secondary;this.active=true;
   if(/\.mp4$/i.test(new URL(source).pathname)){video.preload='metadata';video.src=url;}
   else if(/\.flv$/i.test(new URL(source).pathname)){
    if(!globalThis.mpegts?.isSupported())throw new Error('浏览器不支持此副画面');
    this.flv=mpegts.createPlayer({type:'flv',isLive:live,url,cors:true,withCredentials:true},{enableWorker:false,enableStashBuffer:false,lazyLoad:false,autoCleanupSourceBuffer:true});
    this.flv.on(mpegts.Events.ERROR,()=>{if(epoch===this.epoch)this.fail('副画面连接失败');});this.flv.attachMediaElement(video);this.flv.load();
   }else if(globalThis.Hls?.isSupported()){
    this.hls=new Hls({enableWorker:false,lowLatencyMode:live,maxBufferLength:12,maxMaxBufferLength:20,backBufferLength:8,maxBufferSize:20*1024*1024,
     async xhrSetup(xhr,raw){await api.prepareMedia?.(signal);signal.throwIfAborted();xhr.open('GET',api.sign(raw),true);xhr.withCredentials=true;}});
    this.hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal&&epoch===this.epoch)this.fail('副画面连接失败');});this.hls.loadSource(url);this.hls.attachMedia(video);
   }else throw new Error('浏览器不支持此副画面');
   this.setAudio(audio);this.sync(true);
  }catch(e){if(epoch===this.epoch&&e.name!=='AbortError')this.fail(e.message);}
 }
}
