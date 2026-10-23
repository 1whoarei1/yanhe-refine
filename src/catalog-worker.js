import {unzipSync,strFromU8} from 'fflate';
import {SaxesParser} from 'saxes';
import {normalizeCourse,searchCourses,relatedCourses} from './catalog-core.js';
let rows=[],db,index=new Map(),statsCache;
const request=idb=>new Promise((resolve,reject)=>{idb.onsuccess=()=>resolve(idb.result);idb.onerror=()=>reject(idb.error);});
async function database(){if(db)return db;const op=indexedDB.open('yanhe-desk',1);op.onupgradeneeded=()=>{op.result.createObjectStore('courses',{keyPath:'key'});op.result.createObjectStore('meta');};db=await request(op);return db;}
async function transaction(mode,write){const d=await database(),tx=d.transaction(['courses','meta'],mode);return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('保存失败'));try{write(tx);}catch(e){tx.abort();reject(e);}});}
async function load(){const d=await database();rows=await request(d.transaction('courses').objectStore('courses').getAll());index=new Map(rows.map(r=>[r.key,r]));statsCache=null;return stats();}
function stats(){return statsCache ||= {count:rows.length,legacy:rows.filter(r=>r.platform==='legacy').length,modern:rows.filter(r=>r.platform==='modern').length,
 terms:[...new Set(rows.map(r=>r.term).filter(Boolean))].sort().reverse(),colleges:[...new Set(rows.map(r=>r.college).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'))};}
function xml(raw,onOpen,onText,onClose){const parser=new SaxesParser({xmlns:false});parser.on('opentag',onOpen||(()=>{}));parser.on('text',onText||(()=>{}));parser.on('closetag',tag=>onClose?.(tag.name));parser.write(raw).close();}
export function readXlsx(buffer,progress=()=>{}) {
 const bytes=new Uint8Array(buffer);if(bytes.byteLength>50*1024*1024)throw new Error('课程表超过 50 MB');
 const allowed=new Set(['xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/sharedStrings.xml']);
 const meta=unzipSync(bytes,{filter:e=>{if(!allowed.has(e.name))return false;if(e.originalSize>80*1024*1024)throw new Error('课程表内容过大');return true;}});
 let sheetId;xml(strFromU8(meta['xl/workbook.xml']),tag=>{if(tag.name==='sheet'&&(!sheetId||tag.attributes.name==='全部课程'))sheetId=tag.attributes['r:id'];});
 let sheet;xml(strFromU8(meta['xl/_rels/workbook.xml.rels']),tag=>{if(tag.name==='Relationship'&&tag.attributes.Id===sheetId){let target=tag.attributes.Target.replace(/^\//,'');sheet=target.startsWith('xl/')?target:'xl/'+target;}});
 if(!sheet||sheet.includes('..'))throw new Error('未找到课程工作表');
 const shared=[];let current='',inText=false;
 if(meta['xl/sharedStrings.xml'])xml(strFromU8(meta['xl/sharedStrings.xml']),tag=>{if(tag.name==='si')current='';if(tag.name==='t')inText=true;},value=>{if(inText)current+=value;},name=>{if(name==='t')inText=false;if(name==='si')shared.push(current);});
 const selected=unzipSync(bytes,{filter:e=>{if(e.name!==sheet)return false;if(e.originalSize>160*1024*1024)throw new Error('工作表内容过大');return true;}});
 if(!selected[sheet])throw new Error('未找到课程工作表');
 const result=[];let header=null,cells={},cellRef='',cellType='',value='',collect=false;
 xml(strFromU8(selected[sheet]),tag=>{
  if(tag.name==='row')cells={};
  if(tag.name==='c'){cellRef=tag.attributes.r?.replace(/\d/g,'')||'';cellType=tag.attributes.t;value='';}
  if(tag.name==='v'||tag.name==='t')collect=true;
 },chunk=>{if(collect)value+=chunk;},name=>{
  if(name==='v'||name==='t')collect=false;
  if(name==='c')cells[cellRef]=cellType==='s'?(shared[Number(value)]||''):value;
  if(name==='row'){
   if(!header){if(Object.values(cells).includes('课程ID')&&Object.values(cells).includes('课程名称'))header={...cells};return;}
   const record={};for(const [col,label]of Object.entries(header))record[label]=cells[col]||'';
   const course=normalizeCourse(record,'legacy');if(course)result.push(course);
   if(result.length%5000===0)progress(result.length);
  }
 });
 if(!header)throw new Error('需要包含“课程ID”和“课程名称”的课程表');return result;
}
async function saveRecords(records,replace=false){
 const mapped=new Map((replace?[]:rows).map(r=>[r.key,r]));for(const r of records){const previous=mapped.get(r.key);mapped.set(r.key,normalizeCourse({...previous,...r,teacher:r.teacher||previous?.teacher,term:r.term||previous?.term,college:r.college||previous?.college,code:r.code||previous?.code,lmsId:r.lmsId||previous?.lmsId}));}
 await transaction('readwrite',tx=>{const store=tx.objectStore('courses');if(replace)store.clear();for(const r of records)store.put(mapped.get(r.key));tx.objectStore('meta').put(Date.now(),'updatedAt');});
 rows=[...mapped.values()];index=mapped;statsCache=null;return stats();
}
export async function perform(type,args={},progress=()=>{}){
 if(type==='init')return load();
 if(type==='stats')return stats();
 if(type==='search')return searchCourses(rows,args);
 if(type==='related')return relatedCourses(args.platform?rows.filter(r=>r.platform===args.platform):rows,args.course,args.kind,args.limit);
 if(type==='get')return index.get(args.key)||null;
 if(type==='upsert')return saveRecords(args.rows.map(r=>normalizeCourse(r)).filter(Boolean));
 if(type==='import'){
  let records;
  if(args.name.toLowerCase().endsWith('.xlsx'))records=readXlsx(args.buffer,progress);
  else {const data=JSON.parse(new TextDecoder().decode(args.buffer));const list=Array.isArray(data)?data:data.courses||data.rows;if(!Array.isArray(list))throw new Error('没有找到课程列表');records=list.map(r=>normalizeCourse(r)).filter(Boolean);}
  if(!records.length)throw new Error('没有可导入的课程');return {...await saveRecords(records),imported:new Set(records.map(r=>r.key)).size};
 }
 throw new Error('未知操作');
}
let queue=Promise.resolve();
export function catalogOperation(type,args={}){const next=queue.then(()=>perform(type,args));queue=next.catch(()=>{});return next;}
if(typeof WorkerGlobalScope!=='undefined'&&self instanceof WorkerGlobalScope&&typeof ServiceWorkerGlobalScope==='undefined')self.onmessage=({data})=>{queue=queue.then(async()=>{const {id,type,args={}}=data;try{const result=await perform(type,args,count=>self.postMessage({id,progress:count}));self.postMessage({id,result});}catch(e){self.postMessage({id,error:e.message||'操作失败'});}});};
