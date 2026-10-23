import {lmsCourses,homeworkRows,materialRows,resourceRows} from './lms-core.js';
export class LmsReader {
 constructor(fetcher=globalThis.fetch.bind(globalThis)){this.fetcher=fetcher;this.owned=null;this.activities=new Set();}
 async get(path){
  const response=await this.fetcher('https://zy-eclass.bit.edu.cn'+path,{credentials:'include',redirect:'error',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`新乐学返回 HTTP ${response.status}`);
  if(!/json/i.test(response.headers.get('content-type')||''))throw new Error('请登录新乐学');
  const data=await response.json();if(data.message==='未找到资源')throw new Error('未找到课程资源');return data;
 }
 async read({kind,id,page=1}){
  if(kind==='courses'){
   const body=await this.get('/api/my-courses');if(!Array.isArray(body.courses||body.data?.courses))throw new Error('请登录新乐学');
   const rows=lmsCourses(body);this.owned=new Set(rows.map(r=>r.id));return {rows};
  }
  if(!/^\d{1,12}$/.test(String(id)))throw new Error('编号无效');
  if(kind==='resources'){
   if(!this.activities.has(String(id)))throw new Error('请先刷新课程资料');
   return {rows:resourceRows(await this.get(`/api/activities/${id}/resources`))};
  }
  if(!this.owned)await this.read({kind:'courses'});
  if(!this.owned.has(String(id)))throw new Error('未找到所学课程');
  if(kind==='homework'){
   const n=Math.max(1,Math.min(100,Number(page)||1));
   const [body,status]=await Promise.all([this.get(`/api/courses/${id}/homework-activities?page=${n}`),this.get(`/api/course/${id}/homework/submission-status`).catch(()=>({}))]);
   const rows=homeworkRows(body,status,id);rows.forEach(r=>this.activities.add(r.id));return {rows,page:Number(body.page)||n,pages:Number(body.pages)||1};
  }
  if(kind==='materials'){
   const rows=materialRows(await this.get(`/api/course/${id}/courseware-activities`),id);rows.forEach(r=>this.activities.add(r.id));return {rows};
  }
  throw new Error('不支持的读取');
 }
}
