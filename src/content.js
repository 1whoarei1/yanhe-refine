import {LmsReader} from './lms-reader.js';
import {LexueReader} from './lexue-reader.js';
import {siteRoute,siteHref} from './site-routes.js';
import {mountSite} from './site-entry.js';
if(window.top===window){
 const own=chrome.runtime.getURL(''),reader=location.origin==='https://zy-eclass.bit.edu.cn'?new LmsReader():null;
 const oldReader=location.origin==='https://lexue.bit.edu.cn'?new LexueReader():null;
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id||!(sender.url?.startsWith(own)||(!sender.url&&!sender.tab)))return;
  if(message.type==='READ_LEGACY_AUTH'&&location.origin==='https://www.yanhekt.cn'){
   let token=null;try{const a=JSON.parse(localStorage.getItem('auth')||'{}');if(/^[a-f0-9]{32}$/i.test(a.token||''))token=a.token;}catch{}respond({token});return;
  }
  if(message.type==='READ_AUTH_COOKIE'&&location.origin==='https://aita.yanhekt.cn'){
   const values=document.cookie.split(';').map(x=>x.trim()).filter(x=>x.startsWith('_token=')).map(x=>x.slice(7));const token=new URL(location.href).searchParams.get('token');if(token)values.push(token);respond({values});return;
  }
  if(message.type==='DESK_LMS_READ'&&reader){reader.read(message.args||{}).then(data=>respond({ok:true,data}),e=>respond({ok:false,error:e.message}));return true;}
  if(message.type==='DESK_LEXUE_READ'&&oldReader){oldReader.read(message.args||{}).then(data=>respond({ok:true,data}),e=>respond({ok:false,error:e.message}));return true;}
 });
 if(siteRoute(location.href)){
  // Replace only the explicit student routes; native/login pages retain their application.
  try{mountSite();}catch(error){console.warn('[yanhe-refine] '+error.message);const u=new URL(location.href);u.searchParams.set('yh_native','1');location.replace(u.href);}
 }else if(['https://aita.yanhekt.cn','https://www.yanhekt.cn'].includes(location.origin)){
  const add=()=>{if(document.getElementById('yanhe-refine-return'))return;const a=document.createElement('a');a.id='yanhe-refine-return';a.textContent='返回焕新版';const current=new URL(location.href);current.searchParams.delete('yh_native');a.href=siteRoute(current.href)?current.href:siteHref('#/courses');a.setAttribute('aria-label','返回延河课堂焕新版');document.body.append(a);};
  if(document.body)add();else document.addEventListener('DOMContentLoaded',add,{once:true});
 }
}
