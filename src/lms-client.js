import {LmsReader} from './lms-reader.js';
export class LmsClient {
 constructor(){this.fallback=new LmsReader();this.tab=null;}
 async read(args){
  const tabs=await chrome.tabs.query({url:['https://zy-eclass.bit.edu.cn/*']});
  const order=this.tab?[...tabs.filter(t=>t.id===this.tab),...tabs.filter(t=>t.id!==this.tab)]:tabs;
  for(const tab of order.slice(0,3)){
   let reply;
   try{reply=await chrome.tabs.sendMessage(tab.id,{type:'DESK_LMS_READ',args},{frameId:0});}
   catch(e){if(/Receiving end|establish connection|message port/i.test(e.message))continue;throw e;}
   if(reply?.ok){this.tab=tab.id;return reply.data;}
   if(reply?.error)throw new Error(reply.error);
  }
  return this.fallback.read(args);
 }
 async courses(){return (await this.read({kind:'courses'})).rows;}
 async homeworks(id){const rows=[];for(let page=1;page<=100;page++){const data=await this.read({kind:'homework',id,page});rows.push(...data.rows);if(page>=data.pages)return rows;}throw new Error('作业列表超过 100 页，请在新乐学查看');}
 async materials(id){return (await this.read({kind:'materials',id})).rows;}
 async resources(courseId,id){return (await this.read({kind:'resources',courseId,id})).rows;}
 async task(courseId,id){return this.read({kind:'task',courseId,id});}
}
