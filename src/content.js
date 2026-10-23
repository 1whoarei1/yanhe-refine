import {LmsReader} from './lms-reader.js';
if(window.top===window){
 const own=new URL(chrome.runtime.getURL('desk.html')).origin;
 const reader=location.origin==='https://zy-eclass.bit.edu.cn'?new LmsReader():null;
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  let url;try{url=new URL(sender.url);}catch{return;}
  if(sender.id!==chrome.runtime.id||url.origin!==own||!['/desk.html','/player.html','/watch/player.html'].includes(url.pathname))return;
  if(message.type==='READ_LEGACY_AUTH'&&location.origin==='https://www.yanhekt.cn'){
   let token=null;try{const a=JSON.parse(localStorage.getItem('auth')||'{}');if(/^[a-f0-9]{32}$/i.test(a.token||''))token=a.token;}catch{}respond({token});return;
  }
  if(message.type==='READ_AUTH_COOKIE'&&location.origin==='https://aita.yanhekt.cn'){
   const values=document.cookie.split(';').map(x=>x.trim()).filter(x=>x.startsWith('_token=')).map(x=>x.slice(7));const token=new URL(location.href).searchParams.get('token');if(token)values.push(token);respond({values});return;
  }
  if(message.type==='DESK_LMS_READ'&&reader){reader.read(message.args||{}).then(data=>respond({ok:true,data}),e=>respond({ok:false,error:e.message}));return true;}
 });
 if(['https://aita.yanhekt.cn','https://www.yanhekt.cn'].includes(location.origin)&&!document.getElementById('yanhe-desk-open')){
  const button=document.createElement('button');button.id='yanhe-desk-open';button.textContent='延河学习台';button.type='button';
  button.addEventListener('click',async()=>{try{await chrome.runtime.sendMessage({type:'OPEN_DESK',url:location.href});}catch{button.textContent='刷新网页';}});
  document.documentElement.append(button);
 }
}
