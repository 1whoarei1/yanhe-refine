import {lmsCourses,homeworkRows,materialRows,resourceRows,homeworkDetail,submissionRows,published} from './lms-core.js';
export const LMS_ORIGIN='https://zy-eclass.bit.edu.cn';
export function numeric(value){if(!/^\d{1,12}$/.test(String(value)))throw new Error('编号无效');return String(value);}
export class LmsReader {
 constructor(fetcher=globalThis.fetch.bind(globalThis)){this.fetcher=fetcher;this.owned=null;this.activities=new Map();this.termCache=null;this.termFlight=null;}
 async termCatalog(yearIds=[],signal){
  if(this.termCache&&Date.now()-this.termCache.at<300000)return this.termCache.data;
  if(this.termFlight)return this.termFlight;
  this.termFlight=(async()=>{
   const results=await Promise.allSettled([this.get('/api/my-academic-years?fields=id,name,sort,is_active',5000,signal),this.get('/api/my-semesters-all',5000,signal)]);signal?.throwIfAborted();
   const list=(result,key)=>{if(result.status!=='fulfilled')return [];const body=result.value,rows=Array.isArray(body)?body:body?.[key]||body?.data?.[key]||body?.data;return Array.isArray(rows)?rows.filter(row=>row&&/^\d{1,12}$/.test(String(row.id))):[];};
   const data={academicYears:list(results[0],'academic_years'),semesters:list(results[1],'semesters')};
   const ids=[...new Set([...yearIds,...data.academicYears.map(row=>String(row.id))])].filter(id=>/^\d{1,12}$/.test(id));
   if(!data.semesters.length&&ids.length){try{const body=await this.get('/api/my-semesters?'+ids.map(id=>'academic_year_ids='+id).join('&'),5000,signal);data.semesters=list({status:'fulfilled',value:body},'semesters');}catch{signal?.throwIfAborted();}}
   if(data.academicYears.length&&data.semesters.length)this.termCache={at:Date.now(),data};return data;
  })().finally(()=>this.termFlight=null);return this.termFlight;
 }
 async response(path,options={}){
  const response=await this.fetcher(LMS_ORIGIN+path,{credentials:'include',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000),...options});
  if(!response.ok){const e=new Error(`新乐学返回 HTTP ${response.status}`);e.status=response.status;throw e;}return response;
 }
 async get(path,timeout=12000,signal){
  signal?.throwIfAborted();const response=await this.response(path,{headers:{Accept:'application/json'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout)});
  if(!/json/i.test(response.headers.get('content-type')||''))throw new Error('请登录新乐学');
  const data=await response.json();if(data.message==='未找到资源')throw new Error('未找到课程资源');return data;
 }
 async own(courseId,force=false,signal){numeric(courseId);if(!this.owned||force)await this.read({kind:'courses',signal});signal?.throwIfAborted();if(!this.owned.has(String(courseId)))throw new Error('未找到所学课程');}
 async activity(courseId,id,signal){
  numeric(id);await this.own(courseId,false,signal);
  // Revalidate the course/activity relationship; never depend on a particular content-script tab.
  const body=await this.get(`/api/course/${courseId}/courseware-activities`,12000,signal),rows=Array.isArray(body)?body:body.learning_activities||body.courseware_activities||body.activities||[];
  const entry=rows.find(r=>String(r.id)===String(id)&&published(r));
  if(!entry)throw new Error('当前课程中未找到已发布的活动');
  this.activities.set(String(id),String(courseId));return entry;
 }
 async userId(courseId,signal){
  signal?.throwIfAborted();const html=await (await this.response(`/course/${numeric(courseId)}/content`,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)})).text();
  const tag=html.match(/<[^>]+\bid=["']userId["'][^>]*>/i)?.[0],id=tag?.match(/\bdata-id=["'](\d+)["']/i)?.[1];
  if(!id)throw new Error('请在同一浏览器登录新乐学');return numeric(id);
 }
 async submissions(courseId,id,detail,signal){
  if(detail.group){
   const {group}=await this.get(`/api/group-sets/${numeric(detail.groupSetId)}/group`,12000,signal);
   if(!group?.id)return {rows:[],groupName:'',inGroup:false};
   const body=await this.get(`/api/activities/${id}/groups/${numeric(group.id)}/submission_list`,12000,signal);
   return {rows:submissionRows(body),groupName:String(group.name||'我的小组'),inGroup:true};
  }
  const userId=await this.userId(courseId,signal),body=await this.get(`/api/activities/${id}/students/${userId}/submission_list`,12000,signal);
  return {rows:submissionRows(body),groupName:'',inGroup:true};
 }
 async read({kind,id,courseId,page=1,force=false,signal}){
  signal?.throwIfAborted();
  if(kind==='courses'){
   const body=await this.get('/api/my-courses',12000,signal);if(!Array.isArray(body.courses||body.data?.courses))throw new Error('请登录新乐学');
   if(force)this.termCache=null;
   let rows=lmsCourses(body);if(rows.some(row=>!row.term)){
    const yearIds=(body.courses||body.data.courses).map(row=>String(row.academic_year?.id??row.academic_year_id??(typeof row.academic_year!=='object'?row.academic_year:'')));
    rows=lmsCourses(body,await this.termCatalog(yearIds,signal));
   }
   signal?.throwIfAborted();this.owned=new Set(rows.map(r=>r.id));return {rows,termMetadataVersion:3,unresolvedTerms:rows.filter(row=>!row.term).length};
  }
  numeric(id);
  if(['resources','task'].includes(kind)){
   courseId=courseId||this.activities.get(String(id));if(!courseId)throw new Error('请先刷新课程资料');
   const entry=await this.activity(courseId,id,signal);
   if(kind==='resources')return {rows:resourceRows(await this.get(`/api/activities/${id}/resources`,12000,signal))};
   if(entry.type!=='homework')throw new Error('不是作业活动');
   const detail=homeworkDetail(await this.get(`/api/activities/${id}`,12000,signal),courseId);
   let history;try{history=await this.submissions(courseId,id,detail,signal);}
   catch{signal?.throwIfAborted();return {...detail,submissions:[],historyError:'提交记录暂未读取，请刷新后再提交',canSubmit:false,submitReason:'提交记录暂未读取，请刷新后再提交'};}
   return {...detail,submissions:history.rows,groupName:history.groupName,canSubmit:detail.canSubmit&&history.inGroup,
    submitReason:history.inGroup?detail.submitReason:'尚未加入作业小组'};
  }
  await this.own(id,false,signal);
  if(kind==='homework'){
   const n=Math.max(1,Math.min(100,Number(page)||1));
   const [body,status]=await Promise.all([this.get(`/api/courses/${id}/homework-activities?page=${n}`,12000,signal),this.get(`/api/course/${id}/homework/submission-status`,4000,signal).catch(()=>({}))]);signal?.throwIfAborted();
   const rows=homeworkRows(body,status,id);rows.forEach(r=>this.activities.set(r.id,String(id)));return {rows,page:Number(body.page)||n,pages:Number(body.pages)||1};
  }
  if(kind==='materials'){
   const rows=materialRows(await this.get(`/api/course/${id}/courseware-activities`,12000,signal),id);rows.forEach(r=>this.activities.set(r.id,String(id)));return {rows};
  }
  throw new Error('不支持的读取');
 }
}
