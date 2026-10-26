import {LexueReader} from './lexue-reader.js';
export class LexueClient{
 constructor(){this.fallback=new LexueReader();}
 async read(args){const tabs=await chrome.tabs.query({url:['https://lexue.bit.edu.cn/*']});for(const tab of tabs.slice(0,3)){let reply;try{reply=await chrome.tabs.sendMessage(tab.id,{type:'DESK_LEXUE_READ',args},{frameId:0});}catch{continue;}if(reply?.ok)return reply.data;}return this.fallback.read(args);}
 courses=force=>this.read({kind:'courses',force}).then(r=>r.rows);
 homeworks=id=>this.read({kind:'homework',id}).then(r=>r.rows);
 materials=id=>this.read({kind:'materials',id}).then(r=>r.rows);
 resources=(courseId,id)=>this.read({kind:'resources',courseId,id}).then(r=>r.rows);
 material=(courseId,id)=>this.read({kind:'material',courseId,id});
 task=(courseId,id)=>this.read({kind:'task',courseId,id});
}
