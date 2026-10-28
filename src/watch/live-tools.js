// Buffered means downloaded, rather than the unbuffered seekable/HLS live window.
export function latestBufferedFrame(video){
 // Keep one frame inside the range: seeking to its end can need the next,
 // not-yet-downloaded packet before a paused decoder presents anything.
 try{const ranges=video.buffered;for(let i=(ranges?.length||0)-1;i>=0;i--){const start=ranges.start(i),end=ranges.end(i);if(Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end>start)return {time:Math.max(start,end-.04),start,end};}}catch{}
 return null;
}

export {chooseAudio as audioView} from './audio-routing.js';

export class LiveFrameFollower{
 constructor(video,{active,onUpdate=()=>{}}){this.video=video;this.active=active;this.onUpdate=onUpdate;this.enabled=false;this.lastTarget=null;this.lastJump=0;this.timer=null;this.frame=null;this.videoFrame=null;this.renderedTime=null;this.generation=0;for(const type of ['progress','loadeddata','canplay','seeked'])video.addEventListener(type,()=>this.request());}
 reset(){this.generation++;clearInterval(this.timer);this.timer=null;if(this.frame!=null)cancelAnimationFrame(this.frame);if(this.videoFrame!=null)this.video.cancelVideoFrameCallback(this.videoFrame);this.frame=null;this.videoFrame=null;this.renderedTime=null;this.lastTarget=null;this.lastJump=0;this.recoveredEnd=null;}
 setEnabled(enabled){this.enabled=Boolean(enabled);this.reset();this.request();}
 request(){
  if(!this.enabled||!this.active())return;
  if(this.timer==null)this.timer=setInterval(()=>this.request(),300);
  if(this.videoFrame==null&&this.video.requestVideoFrameCallback){const generation=this.generation;this.videoFrame=this.video.requestVideoFrameCallback((_,metadata)=>{if(generation!==this.generation)return;this.videoFrame=null;this.renderedTime=metadata.mediaTime;this.request();});}
  if(this.frame==null)this.frame=requestAnimationFrame(()=>{this.frame=null;this.tick();});
 }
 tick(){
  if(!this.enabled||!this.active()){this.reset();return;}
  const latest=latestBufferedFrame(this.video);if(!latest)return;
  // A decoder can keep a seek pending at a growing MSE boundary. Prime it
  // slightly earlier once per new buffer, then retry the final frame.
  if(this.video.seeking&&this.lastTarget!=null&&performance.now()-this.lastJump>600&&this.recoveredEnd!==latest.end&&(this.renderedTime==null||Math.abs(latest.time-this.renderedTime)>.12)){
   const recovery=Math.max(latest.start,latest.time-.12);
   try{this.video.currentTime=recovery;this.lastTarget=recovery;this.lastJump=performance.now();this.recoveredEnd=latest.end;}catch{}
  }
  if(this.video.readyState>=2&&!this.video.seeking&&Math.abs(latest.time-this.video.currentTime)>.08&&(this.lastTarget==null||Math.abs(latest.time-this.lastTarget)>.01)&&performance.now()-this.lastJump>120){
   try{this.video.currentTime=latest.time;this.lastTarget=latest.time;this.lastJump=performance.now();}catch{return;}
  }
  // At the downloaded edge Chromium can wait for a future segment while the
  // last frame is already on screen. Report the frame, not the seek flag.
  const shown=this.renderedTime!=null&&Math.abs(latest.time-this.renderedTime)<.12;
  this.onUpdate({target:latest.time,end:latest.end,latest:shown||(!this.video.seeking&&this.video.readyState>=2&&Math.abs(latest.time-this.video.currentTime)<.08)});
 }
}
