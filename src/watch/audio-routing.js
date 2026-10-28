export const streamViews=['screen','classroom','student'];
export function viewPlan(streams,current,count=1,second){
 const available=streamViews.filter(view=>streams?.[view]),main=available.includes(current)?current:available[0];if(!main)return [];
 const alternate=available.includes(second)&&second!==main?second:available.find(view=>view!==main);
 return [main,alternate,...available.filter(view=>view!==main&&view!==alternate)].filter(Boolean).slice(0,Math.min(Math.max(1,count),available.length));
}
export function chooseAudio(streams={},current,preference='auto',tracks={}){
 if(preference==='muted')return null;if(preference==='current'&&streams[current])return current;if(streamViews.includes(preference)&&streams[preference])return preference;
 const available=['classroom','student','screen'].filter(view=>streams[view]);return available.find(view=>tracks[view]===true)||available.find(view=>tracks[view]!==false)||null;
}
// Only this owner writes mute and volume across the complete decoder group.
export class AudioRouter{
 constructor(media){this.media=media;this.volume=1;this.blocked=new WeakSet();this.carrier=null;this.apply(null);}
 apply(carrier=this.carrier){this.carrier=carrier;for(const media of this.media){if(media!==carrier&&!media.muted)media.muted=true;if(media.volume!==this.volume)media.volume=this.volume;}if(carrier){const muted=this.blocked.has(carrier);if(carrier.muted!==muted)carrier.muted=muted;}}
 setVolume(value){this.volume=Math.min(1,Math.max(0,Number(value)||0));this.apply();}
 block(media){this.blocked.add(media);this.apply();}
 unlock(){this.blocked=new WeakSet();this.apply();}
 reset(){this.blocked=new WeakSet();this.apply(null);}
}
export function observeAudio(media,{hls,flv,onAudio}){
 let last,hasAudio=false,hasVideo=false,alternate=false;
 const report=value=>{if(value!==last){last=value;onAudio(value);}};
 const native=()=>{if(media.webkitAudioDecodedByteCount>0||media.audioTracks?.length>0)report(true);};
 media.addEventListener('timeupdate',native);media.addEventListener('loadeddata',native);
 if(hls){
  hls.on(Hls.Events.MANIFEST_PARSED,(_,data)=>{alternate=Boolean(data.audioTracks?.length);});
  hls.on(Hls.Events.BUFFER_CODECS,(_,tracks)=>{hasAudio||=Boolean(tracks.audio||tracks.audiovideo);hasVideo||=Boolean(tracks.video);if(hasAudio)report(true);});
  hls.on(Hls.Events.FRAG_BUFFERED,()=>{if(hasAudio)report(true);else if(hasVideo&&!alternate)report(false);});
 }
 if(flv)flv.on(mpegts.Events.MEDIA_INFO,info=>{if(typeof info.hasAudio==='boolean')report(info.hasAudio);});
 return ()=>{media.removeEventListener('timeupdate',native);media.removeEventListener('loadeddata',native);};
}
