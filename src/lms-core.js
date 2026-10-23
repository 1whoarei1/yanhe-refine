import {text,isTrue,termLabel} from './catalog-core.js';
export function schoolEpoch(value) {
 if(typeof value==='number'||/^\d{10,13}$/.test(text(value))){const n=Number(value);return Number.isFinite(n)?(n<1e12?n*1000:n):null;}
 const raw=text(value);if(!raw)return null;
 const zoned=/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(raw)?raw.replace(' ','T')+'+08:00':raw;
 const n=Date.parse(zoned);return Number.isFinite(n)?n:null;
}
export function published(row) {
 const no=value=>value===false||value===0||value==='0';
 return isTrue(row.published)&&![row.is_visible,row.visible,row.available].some(no)&&!isTrue(row.deleted);
}
export function lmsCourses(body) {
 const rows=body.courses||body.data?.courses||[];
 return rows.filter(r=>/^\d{1,12}$/.test(text(r.id))).map(r=>({id:text(r.id),title:text(r.name),code:text(r.course_code),
  term:termLabel([text(r.academic_year),text(r.semester)].filter(Boolean).join('-')),department:typeof r.department==='string'?r.department:text(r.department?.name),url:`https://zy-eclass.bit.edu.cn/course/${r.id}/content#/`}));
}
export function activityUrl(courseId,id) {return `https://zy-eclass.bit.edu.cn/course/${courseId}/learning-activity/full-screen#/${id}`;}
export function homeworkRows(body,statusBody={},courseId) {
 const status=new Map((statusBody.homework_activities||[]).map(r=>[text(r.id),r]));
 return (body.homework_activities||[]).filter(published).map(r=>{
  const id=text(r.id),s=status.get(id),raw=text(s?.status||r.submitted_status).toLowerCase();
  let state='unknown';
  if(isTrue(r.submitted)||['submitted','late_submitted','graded','completed'].includes(raw))state='submitted';
  else if([false,0,'0'].includes(r.submitted)||['absent','unsubmitted','not_submitted'].includes(raw))state='pending';
  return {id,courseId:text(courseId),title:text(r.title||r.name||r.data?.title||r.data?.name)||'作业',state,
   deadline:schoolEpoch(r.deadline||r.end_time||r.data?.deadline),start:schoolEpoch(r.start_time),closed:isTrue(r.is_closed),group:isTrue(r.submit_by_group),
   makeUp:isTrue(r.can_make_up_homework),url:activityUrl(courseId,id)};
 }).filter(r=>/^\d{1,12}$/.test(r.id));
}
export function materialRows(body,courseId) {
 const rows=Array.isArray(body)?body:body.learning_activities||body.courseware_activities||body.activities||[];
 return rows.filter(r=>published(r)&&['material','resource','courseware'].includes(text(r.type))).map(r=>({id:text(r.id),courseId:text(courseId),
  title:text(r.title||r.name)||'课件',type:'material',url:activityUrl(courseId,r.id)})).filter(r=>/^\d{1,12}$/.test(r.id));
}
export function resourceRows(body) {
 return (body.uploads||[]).filter(r=>!isTrue(r.deleted)).map(r=>({name:text(r.name),size:Number(r.size)||0,type:text(r.type),download:isTrue(r.allow_download)}));
}
