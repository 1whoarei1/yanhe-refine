import {termLabel} from './catalog-core.js';
const platforms=['lms','lexue'];

// Keep failures separate from successful course lists so login recovery can refresh one site.
export class TeachingCourses{
 constructor({lms,lexue,now=()=>Date.now(),timeout=50000}){this.clients={lms,lexue};this.now=now;this.timeout=timeout;this.slots=new Map(platforms.map(source=>[source,{rows:[],loaded:false,at:0,error:null,flight:null}]));}
 snapshot(){return {rows:platforms.flatMap(source=>this.slots.get(source).rows),status:platforms.map(source=>{const s=this.slots.get(source);return s.loaded?!s.error:null;}),loading:platforms.map(source=>Boolean(this.slots.get(source).flight)),errors:platforms.map(source=>this.slots.get(source).error)};}
 async one(source,force){
  const slot=this.slots.get(source);if(slot.flight){if(!force||slot.forced)return slot.flight;await slot.flight;return this.one(source,true);}
  if(!force&&slot.loaded&&this.now()-slot.at<(slot.error?5000:120000))return;
  slot.forced=Boolean(force);slot.flight=Promise.resolve().then(async()=>{
   let timer;try{const rows=await Promise.race([this.clients[source].courses(force),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error((source==='lms'?'新乐学':'旧乐学')+'课程读取超时，请刷新重试')),this.timeout);})]);if(!Array.isArray(rows))throw new Error('课程列表格式异常');slot.rows=rows.map(row=>({...row,term:termLabel(row.term),source}));slot.error=null;}
   catch(error){slot.rows=[];slot.error=error;}
   finally{clearTimeout(timer);slot.loaded=true;slot.at=this.now();}
  }).finally(()=>slot.flight=null);return slot.flight;
 }
 async load({force=false,source,onUpdate}={}){if(source&&!platforms.includes(source))throw new Error('乐学来源无效');const jobs=(source?[source]:platforms).map(id=>this.one(id,force).then(()=>onUpdate?.(this.snapshot())));onUpdate?.(this.snapshot());await Promise.all(jobs);return this.snapshot();}
}
