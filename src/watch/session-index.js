// Our server's plaintext snapshot. Course ownership comes from explicit session lists.
import {readImportedCatalog} from './catalog-import.js';
const validId=value=>/^[1-9]\d{0,11}$/.test(String(value??''));
const validTerm=value=>/^\d{4}-\d{4}-[12]$/.test(String(value??''));
const invalid=()=>new Error('旧版课次目录格式无效，请重新导入发布包中的目录。');

export class SessionIndex {
 constructor({fetcher=globalThis.fetch.bind(globalThis),snapshotUrl=globalThis.chrome?.runtime?.getURL?.('legacy-session-index.json')}={}){this.fetcher=fetcher;this.url=snapshotUrl;this.flight=null;}
 async load(signal){
  signal?.throwIfAborted();const imported=await readImportedCatalog('sessions');if(imported!==this.imported){this.imported=imported;this.flight=null;}if(!this.url&&!imported)return null;
  if(!this.flight)this.flight=(async()=>{
   let data=imported;
   if(!data){let response;try{response=await this.fetcher(this.url,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(18000)});}catch(error){if(error.name==='TypeError')return null;throw error;}
    if(response.status===404)return null;if(!response.ok)throw invalid();try{data=await response.json();}catch{throw invalid();}}
   if(data?.format!=='yanhekt-session-index/v1'||data.source?.kind!=='self-collected'||typeof data.partial!=='boolean'||!Array.isArray(data.courses)||data.courses.length>200000)throw invalid();
   const courses=new Map(),owners=new Map();
   for(const row of data.courses){
    if(!validId(row.id)||courses.has(String(row.id))||typeof row.name!=='string'||row.term!=null&&!validTerm(row.term)||!Array.isArray(row.teachers)||!row.teachers.every(v=>typeof v==='string')||!Array.isArray(row.sessions)||row.sessions.length>10000||!row.sessions.every(validId))throw invalid();
    const sessions=[...new Set(row.sessions.map(String))].sort((a,b)=>Number(a)-Number(b)),id=String(row.id);
    for(const sid of sessions){if(owners.has(sid)&&owners.get(sid)!==id)throw invalid();owners.set(sid,id);}
    courses.set(id,{id,name:row.name.trim()||`旧版课程 ${id}`,number:row.number==null?'':String(row.number),term:row.term||'',teachers:[...row.teachers],sessions});
   }
   return {courses,partial:data.partial,updatedAt:Date.parse(data.generatedAt)||null,sessionCount:owners.size};
  })();
  const data=await this.flight;signal?.throwIfAborted();return data;
 }
 async terms(signal){const data=await this.load(signal);if(!data)return null;return {terms:[...new Set([...data.courses.values()].map(c=>c.term).filter(Boolean))].sort().reverse(),updatedAt:data.updatedAt,dataset:'self-collected',partial:data.partial,courseCount:data.courses.size,sessionCount:data.sessionCount};}
 async search(query='',{page=1,term='',signal}={}){
  const data=await this.load(signal);if(!data)return null;
  const q=String(query).trim().toLocaleLowerCase(),words=q.split(/\s+/).filter(Boolean);
  if(q.length>64||words.length>6||term&&!validTerm(term)||!Number.isSafeInteger(page)||page<1||page>100000)throw new Error('旧版目录搜索条件无效。');
  const found=[...data.courses.values()].filter(c=>(!term||c.term===term)&&words.every(word=>[c.id,c.name,c.number,...c.teachers].join(' ').toLocaleLowerCase().includes(word)));
  found.sort((a,b)=>(b.id===q)-(a.id===q)||b.term.localeCompare(a.term)||Number(a.id)-Number(b.id));
  const rows=found.slice((page-1)*40,page*40).map(c=>({id:c.id,platform:'legacy',legacy:true,
   // Keep the original typed routing marker for compatibility with saved links.
   // The actual dataset provenance is explicit and never claims an upstream download.
   indexSource:'autoslides',indexDataset:'self-collected',title:c.name,teacher:c.teachers.join('、'),term:c.term,code:c.number,college:'',indexSessionCount:c.sessions.length}));
  return {rows,total:found.length,reportedTotal:found.length,truncated:false,page,pageSize:40,dataset:'self-collected',partial:data.partial};
 }
 async sessions(courseId,signal){const data=await this.load(signal);if(!data)return null;if(!validId(courseId))throw new Error('索引课程编号无效。');const course=data.courses.get(String(courseId));if(!course)throw new Error('自建旧版目录尚未收录这门课程，不代表原站没有回放。');return [...course.sessions];}
}
