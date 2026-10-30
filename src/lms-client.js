import {LmsReader} from './lms-reader.js';
import {ReaderBridge} from './reader-bridge.js';
export class LmsClient extends ReaderBridge {
 constructor(options={}){super({kind:'lms',origin:'https://zy-eclass.bit.edu.cn',fallback:new LmsReader(),...options});}
 async courses(force=false){
  if(force)this.badTabs.clear();
  const data=await this.read({kind:'courses',force}),{rows}=data;
  // An already open LMS tab may still run the previous content script after an update.
  if(rows.some(row=>row.term!=null&&(typeof row.term!=='string'||/\[object\s+[^\]]+\]/i.test(row.term)))||(data.termMetadataVersion!==3&&rows.some(row=>!row.term))){
   try{return (await this.readFallback({kind:'courses',force})).rows;}catch{}
  }
  return rows;
 }
 async homeworks(id){const rows=[];for(let page=1;page<=100;page++){const data=await this.read({kind:'homework',id,page});rows.push(...data.rows);if(page>=data.pages)return rows;}throw new Error('作业列表超过 100 页，请在新乐学查看');}
 async materials(id){return (await this.read({kind:'materials',id})).rows;}
 async resources(courseId,id){return (await this.read({kind:'resources',courseId,id})).rows;}
 async task(courseId,id){return this.read({kind:'task',courseId,id});}
}
