import {text,isTrue,termLabel,metadataLabel} from './catalog-core.js';
export function academicTerm(year,semester){
 const yearName=metadataLabel(year).normalize('NFKC').replace(/[–—－/]/g,'-'),semesterName=metadataLabel(semester).normalize('NFKC');
 const full=termLabel(semesterName);if(/^\d{4}-\d{4}-(?:[123]|小学期|暑期)$/.test(full))return full;
 const years=yearName.match(/(\d{4})\s*-\s*(\d{4})/)||[null,metadataLabel(year?.start_year),metadataLabel(year?.end_year)];
 if(!/^\d{4}$/.test(years[1]||'')||Number(years[2])!==Number(years[1])+1)return '';
 const label=semesterName.trim().replace(/^[-\s]+/,'');
 let part='';if(/^(?:1|一|上)$|第一学期|第1学期|上学期|秋/.test(label))part='1';
 else if(/^(?:2|二|下)$|第二学期|第2学期|下学期|春/.test(label))part='2';
 else if(/^(?:3|三)$|第三学期|第3学期/.test(label))part='3';
 else if(/小学期|暑期|夏季学期/.test(label))part='暑期';
 if(!part){const suffix=termLabel(yearName).match(/^\d{4}-\d{4}-([123])$/);if(!label&&suffix)part=suffix[1];}
 return part?`${years[1]}-${years[2]}-${part}`:'';
}
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
 return rows.filter(r=>/^\d{1,12}$/.test(text(r.id))).map(r=>({id:text(r.id),title:metadataLabel(r.name),code:metadataLabel(r.course_code),
  term:academicTerm(r.academic_year,r.semester),department:metadataLabel(r.department),url:`https://zy-eclass.bit.edu.cn/course/${r.id}/content#/`}));
}
export function activityUrl(courseId,id) {return `https://zy-eclass.bit.edu.cn/course/${courseId}/learning-activity/full-screen#/${id}`;}
export function homeworkRows(body,statusBody={},courseId) {
 if((body.homework_activities||[]).some(r=>r.course_id!=null&&String(r.course_id)!==String(courseId)))throw new Error('作业列表与当前课程不一致');
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
 if(rows.some(r=>r.course_id!=null&&String(r.course_id)!==String(courseId)))throw new Error('资料列表与当前课程不一致');
 return rows.filter(r=>published(r)&&['material','resource','courseware'].includes(text(r.type))).map(r=>({id:text(r.id),courseId:text(courseId),
  title:text(r.title||r.name)||'课件',type:'material',url:activityUrl(courseId,r.id)})).filter(r=>/^\d{1,12}$/.test(r.id));
}
export function resourceRows(body) {
 return (body.uploads||[]).filter(r=>!isTrue(r.deleted)).map(r=>({id:text(r.id),referenceId:text(r.reference_id),name:text(r.name),size:Number(r.size)||0,type:text(r.type),download:isTrue(r.allow_download)}));
}
export function homeworkDetail(row,courseId) {
 const data=row.data||{},base=homeworkRows({homework_activities:[row]}, {},courseId)[0];
 if(!base||String(row.course_id)!==String(courseId)||row.type!=='homework')throw new Error('作业不属于当前课程或尚未发布');
 const unlimited=isTrue(row.non_submit_times??data.non_submit_times),limit=Number(row.submit_times??data.submit_times),used=Number(row.user_submit_count)||0;
 const supported=data.homework_type==='file_upload'&&(!data.mode||data.mode==='normal');
 return {...base,description:text(data.description),attachments:resourceRows(row),groupSetId:text(row.group_set_id),
  mode:data.mode||'normal',supported,used,limit:unlimited?null:limit,
  canSubmit:supported&&isTrue(row.is_in_progress)&&!base.closed&&(unlimited||limit>used),
  submitReason:!supported?'此类作业请在原站完成':!isTrue(row.is_in_progress)||base.closed?'当前不在提交时间内':!unlimited&&used>=limit?'已达到提交次数上限':''};
}
export function submissionRows(body) {
 if(!Array.isArray(body.list))throw new Error('未能读取提交记录');
 return body.list.map(r=>({id:text(r.id),comment:text(r.comment),createdAt:schoolEpoch(r.created_at),draft:isTrue(r.is_draft),redo:isTrue(r.is_redo),
  attachments:resourceRows({uploads:r.uploads||[]})}));
}
export function attachmentUrl(file){
 if(file.download&&file.type==='folder'&&/^\d{1,12}$/.test(file.id))return `https://zy-eclass.bit.edu.cn/zip/uploads?timezone=-480&upload_ids=${file.id}`;
 if(!file.download)throw new Error('该附件未开放下载');
 const ref=String(file.referenceId||''),id=String(file.id||'');
 if(/^\d{1,12}$/.test(ref))return `https://zy-eclass.bit.edu.cn/api/uploads/reference/${ref}/blob`;
 if(/^\d{1,12}$/.test(id))return `https://zy-eclass.bit.edu.cn/api/uploads/${id}/blob`;
 throw new Error('该附件未开放下载');
}
