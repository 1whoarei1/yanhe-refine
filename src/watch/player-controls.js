// One control bar for all visible views; decoder mute/volume remain owned by multiview.
const paths={
 play:'M9 5l11 7-11 7z',pause:'M8 5v14M16 5v14',
 volume:'M11 4L6 8H2v8h4l5 4z M16 8a6 6 0 010 8 M19 5a10 10 0 010 14',
 muted:'M11 4L6 8H2v8h4l5 4z M17 9l5 6M22 9l-5 6',
 settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M15.5 12a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0',
 triple:'M3 4h18v16H3z M15 4v16M15 12h6',dual:'M3 4h18v16H3z M12 4v16',
 pip:'M3 4h18v16H3z M12 12h7v6h-7z',
 browser:'M8 5H3v14h5M16 5h5v14h-5M8 12h8',
 display:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5'
};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]);svg.append(path);return svg;}
export function mountPlayerControls({video,getContext,onPlay,onSound,onStatus}){
 const $=id=>document.getElementById(id),surface=$('media-grid'),bar=$('player-controls');
 let active=null,timer=0,dragging=false,previousSource='auto',destroyed=false,volumeTimer=0,volumeDragging=false;
 const menus=['speed','volume','settings'];
 function glyph(id,name){const button=$(id),old=button.querySelector('svg');if(old?.dataset.icon===name)return;old?.remove();const svg=icon(name);svg.dataset.icon=name;button.prepend(svg);}
 for(const [id,name]of [['control-play','play'],['control-volume','volume'],['triple','triple'],['dual','dual'],['control-settings','settings'],['browser-fullscreen','browser'],['display-fullscreen','display']])glyph(id,name);
 const clock=value=>{const seconds=Math.max(0,Math.floor(value||0)),hours=Math.floor(seconds/3600);return (hours?hours+':':'')+(hours?String(Math.floor(seconds/60)%60).padStart(2,'0'):Math.floor(seconds/60))+':'+String(seconds%60).padStart(2,'0');};
 function setMenu(name){
  clearTimeout(volumeTimer);
  active=name;for(const key of menus){$('menu-'+key).hidden=key!==name;const trigger=$('control-'+key);if(trigger)trigger.setAttribute('aria-expanded',String(key===name));}
  surface.classList.toggle('menu-open',!!name);show();
 }
 function show(){surface.classList.remove('controls-idle');clearTimeout(timer);if(!destroyed)timer=setTimeout(hide,2400);}
 function hide(){if(video.paused||active||dragging||surface.matches(':focus-within')&&document.activeElement?.matches(':focus-visible'))return;surface.classList.add('controls-idle');}
 function seekWindow(){const live=getContext().live;if(live){const ranges=video.seekable.length?video.seekable:video.buffered;if(ranges.length)return [ranges.start(0),ranges.end(ranges.length-1)];return [0,0];}return [0,Number.isFinite(video.duration)?video.duration:Number(getContext().duration)||0];}
 function update(){
  const context=getContext(),live=context.live,playing=!video.paused&&!video.ended;
  glyph('control-play',playing?'pause':'play');$('control-play').setAttribute('aria-label',playing?'暂停':'播放');$('control-play').title=playing?'暂停（空格）':'播放（空格）';
  $('control-play').disabled=!context.attached&&$('play').disabled;
  const [start,end]=seekWindow(),span=end-start,current=Math.max(start,Math.min(end,video.currentTime||start));
  if(!dragging)$('control-seek').value=String(span>0?(current-start)/span*1000:0);
  $('control-seek').disabled=!context.attached||span<=0||!!context.signIn;
  $('control-seek').setAttribute('aria-valuetext',clock(current-start)+' / '+clock(span));
  let buffered=start;for(let i=0;i<video.buffered.length;i++)if(video.buffered.start(i)<=current+.1)buffered=Math.max(buffered,video.buffered.end(i));
  $('control-progress').style.setProperty('--played',span>0?(current-start)/span*100+'%':'0%');$('control-progress').style.setProperty('--buffered',span>0?Math.min(100,(buffered-start)/span*100)+'%':'0%');
  $('control-time').textContent=live?clock(current-start):clock(current)+' / '+clock(end);
  $('control-speed').hidden=live;$('control-speed').textContent=$('speed').value==='1'?'倍速':$('speed').value+'×';
  if(live&&active==='speed')setMenu(null);
  const preference=$('audio-source').value;if(preference!=='muted')previousSource=preference;
  const muted=preference==='muted'||Number($('audio-volume').value)===0||$('control-volume').hasAttribute('data-audio-blocked');glyph('control-volume',muted?'muted':'volume');$('control-volume').setAttribute('aria-label',muted?'开启声音':'静音');$('control-volume').title=muted?'开启声音（M）':'静音（M）';$('control-volume').setAttribute('aria-pressed',String(muted));
  $('control-captions').hidden=live;$('control-captions').disabled=$('show-captions').disabled;$('control-captions').setAttribute('aria-pressed',String($('show-captions').checked));$('control-captions').title=$('show-captions').disabled?'本课次暂无平台字幕':$('show-captions').checked?'关闭视频字幕':'显示视频字幕';
  $('picture-in-picture').hidden=!document.pictureInPictureEnabled;$('picture-in-picture').disabled=!context.attached||!video.videoWidth;
  const pip=document.pictureInPictureElement===video;$('picture-in-picture').setAttribute('aria-label',pip?'退出画中画':'画中画（主画面）');$('picture-in-picture').title=pip?'退出画中画':'画中画（主画面）';$('picture-in-picture').textContent=pip?'退出画中画':'画中画（主画面）';
  $('control-sign-in').hidden=!live||!context.signIn;
  if(video.paused)show();
 }
 async function togglePlay(){if(!getContext().attached){await onPlay();return;}if(video.paused){try{await video.play();}catch{onStatus('请重新点击播放。',true);}}else video.pause();}
 function toggleSound(){if($('audio-source').value==='muted'||Number($('audio-volume').value)===0||$('control-volume').hasAttribute('data-audio-blocked')){if($('audio-source').value==='muted'){$('audio-source').value=previousSource;$('audio-source').dispatchEvent(new Event('change',{bubbles:true}));}onSound();}else{$('audio-source').value='muted';$('audio-source').dispatchEvent(new Event('change',{bubbles:true}));}update();show();}
 for(const name of ['speed','settings'])$('control-'+name).addEventListener('click',()=>setMenu(active===name?null:name));
 function closeVolumeSoon(){clearTimeout(volumeTimer);volumeTimer=setTimeout(()=>{if(active==='volume'&&!volumeDragging&&!$('volume-area').matches(':hover')&&!($('volume-area').contains(document.activeElement)&&document.activeElement.matches(':focus-visible')))setMenu(null);},180);}
 $('volume-area').addEventListener('pointerenter',event=>{clearTimeout(volumeTimer);if(event.pointerType!=='touch'&&!active)setMenu('volume');});
 $('volume-area').addEventListener('pointerleave',event=>{if(event.pointerType!=='touch')closeVolumeSoon();});
 $('volume-area').addEventListener('focusin',event=>{if(event.target.matches(':focus-visible')&&!active)setMenu('volume');});
 $('volume-area').addEventListener('focusout',closeVolumeSoon);
 $('audio-volume').addEventListener('pointerdown',()=>{volumeDragging=true;clearTimeout(volumeTimer);});
 window.addEventListener('pointerup',()=>{if(volumeDragging){volumeDragging=false;closeVolumeSoon();}});
 window.addEventListener('pointercancel',()=>{volumeDragging=false;closeVolumeSoon();});
 $('control-volume').addEventListener('click',event=>{if(event.pointerType==='touch'&&active!=='volume'){setMenu('volume');return;}toggleSound();if(active&&active!=='volume')setMenu(null);});
 $('control-play').addEventListener('click',()=>void togglePlay());
 $('control-captions').addEventListener('click',()=>{$('show-captions').checked=!$('show-captions').checked;$('show-captions').dispatchEvent(new Event('change',{bubbles:true}));update();});
 const seek=$('control-seek');seek.addEventListener('pointerdown',()=>{dragging=true;show();});
 function commitSeek(){dragging=false;const [start,end]=seekWindow();if(!seek.disabled&&end>start)video.currentTime=start+Number(seek.value)/1000*(end-start);update();show();}
 seek.addEventListener('input',()=>{dragging=true;const [start,end]=seekWindow();$('control-time').textContent=clock(start+Number(seek.value)/1000*(end-start))+' / '+clock(end);$('control-progress').style.setProperty('--played',Number(seek.value)/10+'%');});
 // Native range change fires after pointerup. Committing on both can seek twice:
 // the first pending media seek may temporarily report the previous time.
 seek.addEventListener('change',commitSeek);seek.addEventListener('blur',()=>{if(dragging)commitSeek();});seek.addEventListener('pointercancel',()=>{dragging=false;update();show();});
 $('speed').addEventListener('change',()=>{update();setMenu(null);$('control-speed').focus();});
 $('picture-in-picture').addEventListener('click',async()=>{try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else await video.requestPictureInPicture();}catch{onStatus('浏览器未允许画中画，请播放视频后重试。',true);}update();});
 surface.addEventListener('pointermove',show);surface.addEventListener('pointerdown',show);surface.addEventListener('pointerleave',()=>{clearTimeout(timer);timer=setTimeout(hide,600);});
 surface.addEventListener('focusin',show);
 for(const media of surface.querySelectorAll('.stage video')){media.addEventListener('click',event=>{if(event.pointerType==='touch'||event.sourceCapabilities?.firesTouchEvents){show();return;}void togglePlay();});media.addEventListener('dblclick',()=>$('display-fullscreen').click());}
 document.addEventListener('pointerdown',event=>{if(active&&!event.target.closest('.control-menu,.player-control-row'))setMenu(null);});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&active){event.preventDefault();event.stopImmediatePropagation();const trigger=$('control-'+active);setMenu(null);trigger?.focus();return;}
  if(!surface.contains(event.target)||event.target.closest('input,select,textarea,[contenteditable=true]')||event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.key===' '&&event.target.closest('button'))return;
  if(event.key===' '||event.key.toLowerCase()==='k'){event.preventDefault();void togglePlay();}
  else if(event.key.toLowerCase()==='m'){event.preventDefault();toggleSound();}
  else if(event.key.toLowerCase()==='f'){event.preventDefault();$('display-fullscreen').click();}
  else if(['ArrowLeft','ArrowRight'].includes(event.key)&&!$('control-seek').disabled){event.preventDefault();const [start,end]=seekWindow();video.currentTime=Math.max(start,Math.min(end,video.currentTime+(event.key==='ArrowRight'?5:-5)));}
  show();
 },true);
 for(const name of ['play','pause','ended','loadedmetadata','durationchange','timeupdate','progress','emptied','ratechange','enterpictureinpicture','leavepictureinpicture'])video.addEventListener(name,update);
 for(const id of ['screen','classroom','student','dual','triple','timely-mode','audio-source','audio-volume'])$(id).addEventListener(id==='audio-volume'?'input':id==='audio-source'?'change':'click',()=>{update();show();});
 for(const id of ['browser-fullscreen','display-fullscreen'])$(id).addEventListener('click',()=>setMenu(null));
 const observer=new MutationObserver(update);
 for(const id of ['stage-empty','play','audio-status','go-live','speed','timely-mode','show-captions'])observer.observe($(id),{attributes:true,attributeFilter:['class','hidden','disabled','aria-pressed'],childList:true,subtree:true});
 observer.observe($('control-volume'),{attributes:true,attributeFilter:['data-audio-blocked']});
 const resize=new ResizeObserver(()=>{$('menu-volume').style.height=Math.min(155,Math.max(80,surface.clientHeight-62))+'px';});resize.observe(surface);
 update();window.addEventListener('pagehide',()=>{destroyed=true;clearTimeout(timer);clearTimeout(volumeTimer);observer.disconnect();resize.disconnect();});
 return {close:()=>setMenu(null)};
}
