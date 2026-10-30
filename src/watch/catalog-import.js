// Import public metadata only. Bulk data lives in IndexedDB, outside storage.local's quota.
const DB='yanhe-imported-catalogs',STORE='datasets',cache=new Map();
const id=value=>/^[1-9]\d{0,11}$/.test(String(value??''));
const label=(value,max=512)=>typeof value==='string'&&value.length<=max?value.trim():null;
const invalid=()=>new Error('目录格式无效，请选择发布包中的新版课程目录或旧版课次目录 JSON。');
export function validateCatalogImport(data){
 if(!data||typeof data!=='object'||!Array.isArray(data.courses)||!data.courses.length||data.courses.length>200000)throw invalid();
 if(data.format==='yanhekt-session-index/v1'){
  if(data.source?.kind!=='self-collected'||typeof data.partial!=='boolean')throw invalid();
  const owners=new Map(),ids=new Set(),courses=[];
  for(const row of data.courses){
   if(!id(row.id)||ids.has(String(row.id))||!label(row.name)||row.term!=null&&!/^\d{4}-\d{4}-[12]$/.test(row.term)||!Array.isArray(row.teachers)||!row.teachers.every(v=>label(v)!==null)||!Array.isArray(row.sessions)||row.sessions.length>10000||!row.sessions.every(id))throw invalid();
   const courseId=String(row.id),sessions=[...new Set(row.sessions.map(String))].sort((a,b)=>Number(a)-Number(b));ids.add(courseId);
   for(const session of sessions){if(owners.has(session)&&owners.get(session)!==courseId)throw invalid();owners.set(session,courseId);}
   courses.push({id:courseId,name:row.name.trim(),number:label(row.number??'',128)??'',term:row.term||null,teachers:row.teachers.map(v=>v.trim()),sessions});
  }
  if(owners.size>2000000)throw invalid();
  return {kind:'sessions',courses:courses.length,sessions:owners.size,data:{format:data.format,generatedAt:typeof data.generatedAt==='string'?data.generatedAt:null,partial:data.partial,source:{kind:'self-collected'},coverage:{courses:courses.length,sessions:owners.size},courses}};
 }
 if(data.schema!==1||data.courses.some(row=>row.platform!=='modern'))throw invalid();
 const ids=new Set(),courses=[];
 for(const row of data.courses){
  const tenant=String(row.tenant||'21'),key=tenant+':'+row.id;
  if(!id(row.id)||!/^\d{1,8}$/.test(tenant)||ids.has(key)||!label(row.title)||['teacher','term','college','code'].some(key=>row[key]!=null&&label(row[key])===null))throw invalid();
  ids.add(key);courses.push({platform:'modern',id:String(row.id),tenant,title:row.title.trim(),teacher:row.teacher||'',term:row.term||'',college:row.college||'',code:row.code||''});
 }
 return {kind:'modern',courses:courses.length,sessions:0,data:{schema:1,snapshot_date:typeof data.snapshot_date==='string'?data.snapshot_date:null,counts:{total:courses.length,modern:courses.length,legacy:0},courses}};
}
async function database(){
 const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
 return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('浏览器未能打开目录存储，请重试。'));});
}
export async function importCatalog(data){
 const checked=validateCatalogImport(data),db=await database();
 try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);let reason;
  const previous=store.get(checked.kind);previous.onsuccess=()=>{
   const date=value=>Date.parse(value?.generatedAt||value?.snapshot_date)||0,before=date(previous.result),after=date(checked.data);
   if(before&&(!after||after<before)){reason=new Error(after?'这份目录比已导入的目录更旧，请选择最新目录。':'目录没有有效更新时间，不能覆盖现有目录。');tx.abort();return;}
   try{store.put(checked.data,checked.kind);}catch{reason=new Error('目录未保存，原目录未更改。');tx.abort();}
  };
  tx.oncomplete=resolve;tx.onerror=()=>reject(new Error('目录未保存，请检查浏览器存储空间。'));tx.onabort=()=>reject(reason||new Error('目录保存已取消，原目录未更改。'));
 });}finally{db.close();}
 cache.clear();try{await globalThis.chrome?.storage?.local?.set({'catalog:importRevision':Date.now()+Math.random()});}catch{}
 return {kind:checked.kind,courses:checked.courses,sessions:checked.sessions};
}
export async function readImportedCatalog(kind){
 if(typeof indexedDB==='undefined'||!globalThis.chrome?.runtime)return null;
 if(!cache.has(kind)){const flight=(async()=>{const db=await database();try{return await new Promise((resolve,reject)=>{const request=db.transaction(STORE).objectStore(STORE).get(kind);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(new Error('已导入目录暂时无法读取。'));});}finally{db.close();}})().catch(error=>{if(cache.get(kind)===flight)cache.delete(kind);throw error;});cache.set(kind,flight);}
 return cache.get(kind);
}
globalThis.chrome?.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes['catalog:importRevision'])cache.clear();});
