import {SharedReads} from './shared-reads.js';
export class CourseworkCache{
 constructor(rows=new Map(),now=()=>Date.now()){this.rows=rows;this.now=now;this.entries=new Map();this.loads=new SharedReads();}
 invalidate(source){for(const key of this.entries.keys())if(!source||key.startsWith(source+':'))this.entries.delete(key);for(const key of this.rows.keys())if(!source||key.startsWith(source+':'))this.rows.delete(key);}
 async read(course,load,force=false,{signal}={}){
  signal?.throwIfAborted();
  const source=course.source||'lms',id=String(course.id),title=course.title,key=source+':'+id;
  if(!['lms','lexue'].includes(source)||!/^\d{1,12}$/.test(id))throw new Error('资料所属课程无效');
  const cached=this.entries.get(key);if(!force&&cached&&cached.expires>this.now()&&this.rows.has(key))return this.rows.get(key);
  const entry=!force&&cached&&this.loads.has(cached)?cached:{expires:0};this.entries.set(key,entry);
  return this.loads.read(entry,async inner=>{try{const records=await load(inner);inner.throwIfAborted();
   if(!Array.isArray(records)||records.some(r=>String(r.courseId)!==id||(r.source&&r.source!==source)))throw new Error('返回内容与当前课程不一致，请刷新');
   const rows=records.map(r=>({...r,courseTitle:title,source}));
   if(this.entries.get(key)===entry){this.rows.set(key,rows);entry.expires=this.now()+120000;}return rows;
  }catch(error){if(this.entries.get(key)===entry){this.entries.delete(key);this.rows.delete(key);}throw error;}},{signal});
 }
}
