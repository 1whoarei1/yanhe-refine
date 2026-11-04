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
 let frame=0,disposed=false,layoutDirty=true,placement=null,lastVisible;
 const hide=()=>{if(!layer.hidden)layer.hidden=true;};
 const style=(name,value)=>{if(layer.style[name]!==value)layer.style[name]=value;};
 function render(){
  frame=0;if(disposed)return;
  const value=enabled()&&document.pictureInPictureElement!==video?getText(video.currentTime):'';
  if(!value){hide();if(text.textContent)text.textContent='';return;}
  const visible=!surface.classList.contains('controls-idle')||surface.classList.contains('menu-open');
  if(layoutDirty||lastVisible!==visible){
   placement=captionPlacement(video.getBoundingClientRect(),video.videoWidth,video.videoHeight,dock?.getBoundingClientRect(),visible);lastVisible=visible;
   if(placement){
    const bounds=stage.getBoundingClientRect();
    style('left',placement.left-bounds.left+'px');style('width',placement.width+'px');style('bottom',bounds.bottom-placement.bottom+'px');style('maxHeight',placement.maxHeight+'px');style('fontSize',placement.font+'px');
    layoutDirty=false;
   }
  }
  if(!placement||placement.maxHeight<placement.font*1.5){hide();return;}
  if(text.textContent!==value)text.textContent=value;
  if(layer.hidden)layer.hidden=false;
 }
 function update(){if(!frame&&!disposed)frame=requestAnimationFrame(render);}
 function geometry(){layoutDirty=true;update();}
 function clear(){cancelAnimationFrame(frame);frame=0;hide();if(text.textContent)text.textContent='';layoutDirty=true;placement=null;}
 for(const event of ['timeupdate','seeked','seeking'])video.addEventListener(event,update);
 for(const event of ['loadedmetadata','loadeddata','resize','emptied','enterpictureinpicture','leavepictureinpicture'])video.addEventListener(event,geometry);
 document.getElementById('show-captions').addEventListener('change',geometry);
 const resize=new ResizeObserver(geometry);resize.observe(video);resize.observe(stage);if(dock)resize.observe(dock);
 let className=surface.className;
 const controls=new MutationObserver(()=>{if(className!==surface.className){className=surface.className;geometry();}});controls.observe(surface,{attributes:true,attributeFilter:['class']});
 document.addEventListener('fullscreenchange',geometry);window.addEventListener('resize',geometry);
 window.addEventListener('pagehide',()=>{disposed=true;clear();resize.disconnect();controls.disconnect();});
 return {update,clear};
}
