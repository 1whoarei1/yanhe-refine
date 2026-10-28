// The same player layout is used on both Yanhekt sites and in the standalone player.
// Fullscreen contains the workspace (including both video elements and controls).
export function mountViewerLayout({storage=globalThis.chrome?.storage?.local,onError=()=>{}}={}){
 const workspace=document.querySelector('.workspace');
 const $=id=>document.getElementById(id);
 let normal={lectures:true,subtitles:true},fullPanels={lectures:false,subtitles:false};
 let browser=false,wasFull=false,changed=false;
 const native=()=>document.fullscreenElement===workspace;
 const isFull=()=>browser||native();
 function notifyParent(){
  if(parent===window)return;
  const origin=location.ancestorOrigins?.[0];
  const extensionOrigin=globalThis.chrome?.runtime?.getURL?new URL(chrome.runtime.getURL('')).origin:'';
  if([extensionOrigin,'https://aita.yanhekt.cn','https://www.yanhekt.cn'].includes(origin))parent.postMessage({type:'REFINE_VIEW_MODE',mode:browser?'browser':'normal'},origin);
 }
 function render(){
  const full=isFull();
  if(full&&!wasFull)fullPanels={lectures:false,subtitles:false};
  wasFull=full;
  const panels=full?fullPanels:normal;
  workspace.classList.toggle('viewer-fullscreen',browser);
  document.body.classList.toggle('viewer-window',browser);
  for(const [key,id,cls,label]of [['lectures','toggle-lectures','hide-lectures','课次'],['subtitles','toggle-subtitles','hide-transcript','字幕']]){
   workspace.classList.toggle(cls,!panels[key]);
   const button=$(id);button.textContent=(panels[key]?'隐藏':'显示')+label;
   button.setAttribute('aria-pressed',String(panels[key]));button.setAttribute('aria-expanded',String(panels[key]));
  }
  actionLabel('browser-fullscreen',browser?'退出网页全屏':'网页全屏');
  $('browser-fullscreen').setAttribute('aria-pressed',String(browser));
  actionLabel('display-fullscreen',native()?'退出屏幕全屏':'屏幕全屏');
  $('display-fullscreen').setAttribute('aria-pressed',String(native()));
  $('display-fullscreen').disabled=!document.fullscreenEnabled||!workspace.requestFullscreen;
  requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
 }
 function actionLabel(id,text){const button=$(id);(button.querySelector('[data-control-label]')||button).textContent=text;button.setAttribute('aria-label',text);button.title=text+'（Esc 退出）';}
 function setBrowser(value){browser=value;render();notifyParent();}
 for(const [key,id]of [['lectures','toggle-lectures'],['subtitles','toggle-subtitles']])$(id).addEventListener('click',()=>{
  changed=true;const panels=isFull()?fullPanels:normal;panels[key]=!panels[key];render();
  if(!isFull())void storage?.set({'player:panels':{...normal}}).catch(()=>{});
 });
 $('browser-fullscreen').addEventListener('click',async()=>{
  try{if(native())await document.exitFullscreen();setBrowser(!browser);}catch{onError('未能切换网页全屏，请重试。');}
 });
 $('display-fullscreen').addEventListener('click',async()=>{
  try{if(native())await document.exitFullscreen();else await workspace.requestFullscreen({navigationUI:'hide'});}catch{onError('浏览器未允许屏幕全屏，请重新点击，或使用网页全屏。');}
 });
 document.addEventListener('fullscreenchange',render);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&browser&&!document.fullscreenElement){event.preventDefault();setBrowser(false);}});
 window.addEventListener('pagehide',()=>{if(browser){browser=false;notifyParent();}});
 render();
 void storage?.get('player:panels').then(saved=>{
  if(changed)return;const value=saved?.['player:panels'];
  if(value&&typeof value.lectures==='boolean'&&typeof value.subtitles==='boolean'){normal={lectures:value.lectures,subtitles:value.subtitles};render();}
 }).catch(()=>{});
 return {exitBrowser:()=>setBrowser(false)};
}
