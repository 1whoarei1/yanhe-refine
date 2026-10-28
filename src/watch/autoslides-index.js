// Independent client for bit-admin/Yanhekt-AutoSlides' published, partial index API.
// Protocol: share/docs/api.md at 746cd87ccc4da59cb838adc023200531aa379a85.
import {SessionIndex} from './session-index.js';
export const INDEX_ORIGIN='https://share.ruc.edu.kg';
const id=value=>/^[1-9]\d{0,11}$/.test(String(value??''));
const term=value=>/^\d{4}-\d{4}-[12]$/.test(String(value??''));
const invalid=()=>new Error('旧版课程索引返回格式已变化，请稍后重试。');
export class AutoSlidesIndex {
 constructor(options={}){this.fetcher=options.fetcher||globalThis.fetch.bind(globalThis);this.cache=new Map();this.snapshot=new SessionIndex({...options,fetcher:this.fetcher});}
 async read(path,params={},signal,force=false){
  const url=new URL(path,INDEX_ORIGIN);for(const [key,value]of Object.entries(params))if(value!=='')url.searchParams.set(key,String(value));
  const saved=this.cache.get(url.href);if(!force&&saved&&Date.now()-saved.at<300000){signal?.throwIfAborted();return structuredClone(saved.value);}
  const response=await this.fetcher(url.href,{method:'GET',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',headers:{Accept:'application/json'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(18000)]):AbortSignal.timeout(18000)});
  if(response.status===403)throw new Error('旧版课程索引访问受限（HTTP 403）。可在校园网重试，或打开索引站查看；这不代表没有课程或课次。');
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('旧版课程索引暂不可用，返回了非 JSON 页面；可打开索引站查看。');
  const body=await response.json();
  if(!response.ok){const hints={'term-required':'请先选择一个学期，再搜索课程名或教师。','term-not-indexed':'此学期尚未被索引，请换一个学期。','query-too-short':'请至少输入两个字或字符。','not-found':'索引尚未收录这门课程，不代表原站没有回放。','bad-param':'搜索条件无效；session 链接请在播放器直接打开。'};throw new Error(hints[body?.error]||`旧版课程索引暂不可用（HTTP ${response.status}），请稍后重试。`);}
  this.cache.set(url.href,{at:Date.now(),value:body});if(this.cache.size>40)this.cache.delete(this.cache.keys().next().value);return structuredClone(body);
 }
 async terms(signal){const local=await this.snapshot.terms(signal);if(local)return local;const data=await this.read('/api/terms',{},signal);if(!Array.isArray(data.terms)||!data.terms.every(term)||data.terms.length>100)throw invalid();return {terms:[...new Set(data.terms)],updatedAt:Number.isFinite(data.updatedAt)?data.updatedAt:null};}
 async search(query='',{page=1,term:semester='',signal}={}){
  const local=await this.snapshot.search(query,{page,term:semester,signal});if(local)return local;
  const q=String(query).trim();if(!q)return {rows:[],total:0,reportedTotal:0,page:1,pageSize:40};
  if(q.length<2||q.length>64||q.split(/\s+/).length>6)throw new Error('旧版索引搜索需 2–64 个字符，最多 6 个关键词。');
  if(semester&&!term(semester)||!Number.isSafeInteger(page)||page<1||page>5)throw new Error('索引筛选条件无效。');
  const data=await this.read('/api/search',{q,term:semester},signal);
  if(!Array.isArray(data.results)||data.results.length>200||!Number.isSafeInteger(data.total)||data.total<0)throw invalid();
  const rows=data.results.map(row=>{if(!id(row.id)||typeof row.name!=='string'||!row.name.trim()||!Array.isArray(row.teachers)||!row.teachers.every(t=>typeof t==='string')||row.term!=null&&!term(row.term))throw invalid();return {id:String(row.id),platform:'legacy',legacy:true,indexSource:'autoslides',title:row.name,teacher:row.teachers.join('、'),term:row.term||'',code:typeof row.number==='string'?row.number:'',college:'',indexSessionCount:Number.isSafeInteger(row.sessionCount)&&row.sessionCount>=0?row.sessionCount:undefined};});
  return {rows:rows.slice((page-1)*40,page*40),total:rows.length,reportedTotal:data.total,truncated:data.truncated===true,page,pageSize:40};
 }
 async sessions(courseId,signal,{force=false}={}){
  const local=await this.snapshot.sessions(courseId,signal);if(local)return local;
  if(!id(courseId))throw new Error('索引课程编号无效。');
  const data=await this.read(`/api/courses/${courseId}/sessions`,{},signal,force);
  if(String(data.course)!==String(courseId)||!Array.isArray(data.sessions)||data.sessions.length>10000||!data.sessions.every(id))throw invalid();
  return [...new Set(data.sessions.map(String))].sort((a,b)=>Number(a)-Number(b));
 }
}

// A pending row is a session, never a guessed video ID. Media is resolved only on selection.
export function indexedSession(sessionId){return {id:`${sessionId}:pending`,title:`课次 ${sessionId}`,start:0,indexed:true};}
export function mergeSessionSelection(course,info){
 if(!info.sessionReplays)return course;
 const prefix=info.selection.id.split(':')[0]+':';let inserted=false;
 const replays=course.replays.flatMap(row=>{if(!row.id.startsWith(prefix))return [row];if(inserted)return [];inserted=true;return info.sessionReplays;});
 if(!inserted)replays.push(...info.sessionReplays);return {...course,replays};
}
