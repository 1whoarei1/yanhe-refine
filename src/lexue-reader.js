import {SharedReads} from './shared-reads.js';
import {LEXUE,numericId,lexueUrl,moodleSession,lexueCourses,courseActivities,courseSections,lexueFile,fileUrl,materialContent,assignmentContent} from './lexue-core.js';

const loginError=()=>new Error('请先在同一浏览器登录旧乐学');
export class LexueReader{
 constructor({fetch:fetcher=globalThis.fetch.bind(globalThis),now=()=>Date.now()}={}){this.fetch=fetcher;this.now=now;this.courseCache=null;this.activities=new Map();this.activityFlights=new SharedReads();this.courseReads=new SharedReads();this.generation=0;}
 reset(){this.courseCache=null;this.activities.clear();this.activityFlights=new SharedReads();this.courseReads=new SharedReads();this.generation++;}
 async response(path,options={},signal){signal?.throwIfAborted();const target=lexueUrl(path);if(!target)throw new Error('旧乐学地址无效');let r;try{r=await this.fetch(target.href,{credentials:'include',...(target.pathname==='/my/'?{redirect:'manual'}:{}),...options,signal:signal?AbortSignal.any([signal,options.signal||AbortSignal.timeout(20000)]):options.signal||AbortSignal.timeout(20000)});}catch{signal?.throwIfAborted();throw new Error('旧乐学连接失败，请检查登录和网络');}if(r.type==='opaqueredirect'||r.status===401||!lexueUrl(r.url)||/\/login\//.test(new URL(r.url).pathname)){await r.body?.cancel();throw loginError();}if(!r.ok){await r.body?.cancel();throw new Error(`旧乐学请求失败（${r.status}）`);}return r;}
 async html(path,signal){const r=await this.response(path,{},signal);if(!/text\/html/i.test(r.headers.get('content-type')||'')){await r.body?.cancel();throw new Error('旧乐学页面格式异常');}const html=await r.text();if(html.length>8*1024*1024)throw new Error('旧乐学页面过大，请在原站查看');return html;}
 async courses(signal){signal?.throwIfAborted();if(this.courseCache&&this.now()-this.courseCache.time<120000)return this.courseCache.rows;const generation=this.generation;return this.courseReads.read('courses',async signal=>{const sesskey=moodleSession(await this.html('/my/',signal)),rows=[];let offset=0;for(let page=0;page<100;page++){const r=await this.response('/lib/ajax/service.php?'+new URLSearchParams({sesskey,info:'core_course_get_enrolled_courses_by_timeline_classification'}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify([{index:0,methodname:'core_course_get_enrolled_courses_by_timeline_classification',args:{classification:'all',limit:100,offset,sort:'fullname'}}])},signal);let body;try{body=await r.json();}catch{throw loginError();}const result=body?.[0];if(result?.error){const code=String(result.exception?.errorcode||result.errorcode||'');if(/^(?:invalidsesskey|requireloginerror|notloggedin)$/.test(code))throw loginError();throw new Error('旧乐学课程接口读取失败'+(/^[a-zA-Z0-9_]{1,80}$/.test(code)?'（'+code+'）':'')+'，请刷新旧乐学后重试');}if(!Array.isArray(result?.data?.courses))throw new Error('旧乐学课程接口返回格式异常，请刷新后重试');rows.push(...result.data.courses);const next=Number(result.data.nextoffset);if(result.data.courses.length<100){signal?.throwIfAborted();const normalized=lexueCourses(rows);const unique=[...new Map(normalized.map(c=>[c.id,c])).values()];if(generation===this.generation)this.courseCache={time:this.now(),rows:unique};return unique;}if(!Number.isInteger(next)||next<=offset)throw new Error('旧乐学课程分页异常');offset=next;}throw new Error('旧乐学课程过多，请在原站查看');},{signal});}
 async connection(signal){
  const sesskey=moodleSession(await this.html('/my/',signal));
  const r=await this.response('/lib/ajax/service.php?'+new URLSearchParams({sesskey,info:'core_course_get_enrolled_courses_by_timeline_classification'}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify([{index:0,methodname:'core_course_get_enrolled_courses_by_timeline_classification',args:{classification:'all',limit:1,offset:0,sort:'fullname'}}])},signal);
  const body=await r.json(),result=body?.[0];if(result?.error){const code=result.exception?.errorcode||result.errorcode;if(/^(invalidsesskey|requireloginerror|notloggedin)$/.test(code))throw loginError();throw new Error('旧乐学连接检查失败，请刷新重试');}
  if(!Array.isArray(result?.data?.courses))throw new Error('旧乐学连接响应格式异常');return {connected:true};
 }
 async course(id,signal){
  signal?.throwIfAborted();if(!numericId(id)||!(await this.courses(signal)).some(c=>c.id===String(id)))throw new Error('只能读取本人旧乐学课程');
  const key=String(id),cached=this.activities.get(key);if(cached&&this.now()-cached.time<30000)return cached.rows;const flights=this.activityFlights;
  return flights.read(key,async signal=>{
   const html=await this.html('/course/view.php?id='+id,signal),sections=courseSections(html,id),output=[courseActivities(html,id)];let next=0;
   // Some Moodle courses show only weekly summaries on the main page. Read those actual section links too.
   await Promise.all(Array.from({length:Math.min(2,sections.length)},async()=>{while(next<sections.length){signal?.throwIfAborted();const index=next++;output[index+1]=courseActivities(await this.html(sections[index],signal),id);}}));
   signal?.throwIfAborted();const rows=[...new Map(output.flat().map(row=>[row.id,row])).values()];
   if(this.activityFlights===flights)this.activities.set(key,{time:this.now(),rows});return rows;
  },{signal});
 }
 async activity(courseId,id,signal){if(!numericId(id))throw new Error('活动编号无效');const row=(await this.course(courseId,signal)).find(r=>r.id===String(id));if(!row)throw new Error('活动不属于当前旧乐学课程或尚未开放');return row;}
 async material(courseId,id,signal){
  const activity=await this.activity(courseId,id,signal);if(activity.type!=='material')throw new Error('活动不是课程资料');
  if(activity.module==='url')return {description:'',attachments:[]};
  if(activity.module!=='resource')return materialContent(await this.html(activity.url,signal),activity.module);
  let r=await this.response(activity.url,{headers:{Range:'bytes=0-0'}},signal);
  const disposition=r.headers.get('content-disposition')||'';
  if(fileUrl(r.url)||/\battachment\b/i.test(disposition)||!/text\/html/i.test(r.headers.get('content-type')||'')){
   await r.body?.cancel();
   let filename=disposition.match(/filename\s*=\s*"([^"]+)"/i)?.[1]||disposition.match(/filename\s*=\s*([^;\s]+)/i)?.[1];
   const encoded=disposition.match(/filename\*\s*=\s*"?UTF-8'[^']*'([^;"\s]+)/i)?.[1];if(encoded)try{filename=decodeURIComponent(encoded);}catch{}
   const total=r.headers.get('content-range')?.match(/\/(\d+)$/)?.[1]||r.headers.get('content-length'),file=lexueFile(r.url,filename,Number(total));
   if(!file)throw new Error('旧乐学未返回可下载文件，请在原站打开');return {description:'',attachments:[file]};
  }
  if(r.status===206){await r.body?.cancel();r=await this.response(activity.url,{},signal);}
  const html=await r.text();if(html.length>8*1024*1024)throw new Error('旧乐学页面过大，请在原站查看');return materialContent(html,activity.module);
 }
 async task(courseId,id,signal){const activity=await this.activity(courseId,id,signal);if(activity.type!=='task')throw new Error('活动不是作业');return assignmentContent(await this.html(activity.url,signal),activity);}
 async homeworks(id,signal){const modules=(await this.course(id,signal)).filter(r=>r.type==='task'),output=[];let next=0;await Promise.all(Array.from({length:Math.min(2,modules.length)},async()=>{while(next<modules.length){signal?.throwIfAborted();const index=next++;try{output[index]=await this.task(id,modules[index].id,signal);}catch{signal?.throwIfAborted();output[index]={...modules[index],detailError:true};}}}));return output;}
 async read({kind,id,courseId,force=false,signal}={}){signal?.throwIfAborted();if(force)this.reset();if(kind==='connection')return this.connection(signal);if(kind==='courses')return {rows:await this.courses(signal)};if(kind==='homework')return {rows:await this.homeworks(id,signal)};if(kind==='materials')return {rows:(await this.course(id,signal)).filter(r=>r.type==='material')};if(kind==='resources'){const activity=await this.activity(courseId,id,signal);return {rows:(activity.type==='task'?await this.task(courseId,id,signal):await this.material(courseId,id,signal)).attachments};}if(kind==='material')return this.material(courseId,id,signal);if(kind==='task')return this.task(courseId,id,signal);throw new Error('不支持的旧乐学读取');}
}
