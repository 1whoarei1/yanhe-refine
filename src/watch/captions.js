// Position captions against the displayed image, including object-fit: contain letterboxing.
export function captionPlacement(box,width,height,dock,controlsVisible){
 if(!(width>0&&height>0&&box.width>0&&box.height>0))return null;
 const scale=Math.min(box.width/width,box.height/height),w=width*scale,h=height*scale;
 const frame={left:box.left+(box.width-w)/2,top:box.top+(box.height-h)/2,width:w,height:h};
 frame.right=frame.left+w;frame.bottom=frame.top+h;
 const font=Math.max(16,Math.min(32,w*.03)),gap=Math.max(8,Math.min(18,h*.035));
 let bottom=frame.bottom-gap;
 if(controlsVisible&&dock&&dock.right>frame.left&&dock.left<frame.right&&dock.bottom>frame.top)bottom=Math.min(bottom,dock.top-8);
 return {frame,font,left:frame.left+w*.06,width:w*.88,bottom,maxHeight:Math.max(0,bottom-frame.top-4)};
}
export function mountVideoCaptions({video,getText,enabled}){
 const stage=video.parentElement,surface=document.getElementById('media-grid'),dock=document.querySelector('.player-control-dock');
 const layer=document.createElement('div'),text=document.createElement('span');layer.id='video-caption';layer.className='video-caption';layer.setAttribute('aria-hidden','true');layer.hidden=true;layer.append(text);stage.append(layer);
 let frame=0,disposed=false;
 function render(){
  frame=0;if(disposed)return;
  const value=enabled()&&document.pictureInPictureElement!==video?getText(video.currentTime):'';
  if(!value){layer.hidden=true;text.textContent='';return;}
  const visible=!surface.classList.contains('controls-idle')||surface.classList.contains('menu-open');
  const placement=captionPlacement(video.getBoundingClientRect(),video.videoWidth,video.videoHeight,dock?.getBoundingClientRect(),visible);
  if(!placement||placement.maxHeight<placement.font*1.5){layer.hidden=true;return;}
  const bounds=stage.getBoundingClientRect();
  if(text.textContent!==value)text.textContent=value;
  layer.style.left=placement.left-bounds.left+'px';layer.style.width=placement.width+'px';layer.style.bottom=bounds.bottom-placement.bottom+'px';layer.style.maxHeight=placement.maxHeight+'px';layer.style.fontSize=placement.font+'px';layer.hidden=false;
 }
 function update(){if(!frame&&!disposed)frame=requestAnimationFrame(render);}
 function clear(){cancelAnimationFrame(frame);frame=0;layer.hidden=true;text.textContent='';}
 for(const event of ['timeupdate','loadedmetadata','loadeddata','resize','seeked','seeking','emptied','enterpictureinpicture','leavepictureinpicture'])video.addEventListener(event,update);
 document.getElementById('show-captions').addEventListener('change',update);
 const resize=new ResizeObserver(update);resize.observe(video);resize.observe(stage);if(dock)resize.observe(dock);
 const controls=new MutationObserver(update);controls.observe(surface,{attributes:true,attributeFilter:['class']});
 document.addEventListener('fullscreenchange',update);window.addEventListener('resize',update);
 window.addEventListener('pagehide',()=>{disposed=true;clear();resize.disconnect();controls.disconnect();});
 return {update,clear};
}
