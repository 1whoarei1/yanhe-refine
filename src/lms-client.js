import {LmsReader} from './lms-reader.js';
export class LmsClient {
 constructor({tabTimeout=1500,now=()=>Date.now()}={}){this.fallback=new LmsReader();this.tab=null;this.tabTimeout=tabTimeout;this.now=now;this.badTabs=new Map();}
 async tabRead(id,args){let timer;try{return await Promise.race([chrome.tabs.sendMessage(id,{type:'DESK_LMS_READ',args},{frameId:0}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('新乐学页面响应超时')),this.tabTimeout);})]);}finally{clearTimeout(timer);}}
 async read(args){
  const tabs=await chrome.tabs.query({url:['https://zy-eclass.bit.edu.cn/*']});
  const order=this.tab?[...tabs.filter(t=>t.id===this.tab),...tabs.filter(t=>t.id!==this.tab)]:tabs;
  for(const tab of order.filter(t=>(this.badTabs.get(t.id)||0)<=this.now()).slice(0,3)){
   let reply;
   try{reply=await this.tabRead(tab.id,args);}
   catch{this.badTabs.set(tab.id,this.now()+30000);continue;}
   if(reply?.ok){this.tab=tab.id;this.badTabs.delete(tab.id);return reply.data;}
   this.badTabs.set(tab.id,this.now()+30000);
  }
  try{return await this.fallback.read(args);}catch(error){if(error.name==='TimeoutError')throw new Error('新乐学读取超时，请刷新重试');throw error;}
 }
 async courses(force=false){
  if(force)this.badTabs.clear();
  const data=await this.read({kind:'courses',force}),{rows}=data;
  // An already open LMS tab may still run the previous content script after an update.
  if(rows.some(row=>row.term!=null&&(typeof row.term!=='string'||/\[object\s+[^\]]+\]/i.test(row.term)))||(data.termMetadataVersion!==3&&rows.some(row=>!row.term))){
   try{return (await this.fallback.read({kind:'courses',force})).rows;}catch{}
  }
  return rows;
 }
 async homeworks(id){const rows=[];for(let page=1;page<=100;page++){const data=await this.read({kind:'homework',id,page});rows.push(...data.rows);if(page>=data.pages)return rows;}throw new Error('作业列表超过 100 页，请在新乐学查看');}
 async materials(id){return (await this.read({kind:'materials',id})).rows;}
 async resources(courseId,id){return (await this.read({kind:'resources',courseId,id})).rows;}
 async task(courseId,id){return this.read({kind:'task',courseId,id});}
}
