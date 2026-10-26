import {LMS_ORIGIN,numeric} from './lms-reader.js';

export const MAX_UPLOAD_BYTES=32*1024*1024;
export function storageUploadUrl(info){
 if(typeof info.upload_url!=='string'||!info.upload_url.trim())throw new Error('平台未提供有效上传地址');
 let url;try{url=new URL(info.upload_url,LMS_ORIGIN);}catch{throw new Error('平台未提供有效上传地址');}
 if(url.username||url.password||url.hash||![LMS_ORIGIN,'https://zy-media.bit.edu.cn'].includes(url.origin)||url.origin!==LMS_ORIGIN&&url.pathname!==`/upload/file/${numeric(info.id)}`)throw new Error('此存储服务请使用原站上传');return url;
}
export function validateFile(file){
 if(!file||typeof file.name!=='string'||!file.name.trim()||file.name.length>255||/[\\/\x00-\x1f]/.test(file.name))throw new Error('附件名称无效');
 if(!Number.isSafeInteger(file.size)||file.size<=0||file.size>MAX_UPLOAD_BYTES)throw new Error('附件须为 1 B～32 MB；更大的文件请在原站提交');
 if(typeof file.encoded!=='string'||file.encoded.length>Math.ceil(MAX_UPLOAD_BYTES/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(file.encoded))throw new Error('附件数据无效');
 const raw=atob(file.encoded);if(raw.length!==file.size)throw new Error('附件大小不一致');return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
export const commentHtml=text=>String(text).trim().split('\n').map(line=>`<p>${line.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))||'<br>'}</p>`).join('');

// Explicit operations only: no caller-provided URLs, methods, user IDs or server payloads.
export class LmsWriter{
 constructor(reader,{cookies=globalThis.chrome?.cookies,session=globalThis.chrome?.storage?.session}={}){this.reader=reader;this.cookies=cookies;this.session=session;this.uploads=new Map();this.flights=new Map();}
 async headers(json=true){const c=await this.cookies?.get({url:LMS_ORIGIN,name:'XSRF-TOKEN'});return {Accept:'application/json',...(json?{'Content-Type':'application/json'}:{}),...(c?.value?{'X-XSRF-TOKEN':decodeURIComponent(c.value)}:{})};}
 async post(path,body){
  const response=await this.reader.response(path,{method:'POST',headers:await this.headers(),body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if(response.status===204)return {};
  if(!/json/i.test(response.headers.get('content-type')||''))throw new Error('登录状态或提交响应异常');
  const data=await response.json();if(data.errors||data.success===false){const e=new Error(String(data.message||'平台未接受本次操作'));e.status=400;throw e;}return data;
 }
 async preflight(courseId,id){await this.reader.own(courseId,true);const detail=await this.reader.read({kind:'task',courseId,id});if(!detail.canSubmit)throw new Error(detail.submitReason||'当前作业不可提交');return detail;}
 async upload(courseId,id,file){
  numeric(courseId);numeric(id);const bytes=validateFile(file);await this.preflight(courseId,id);
  const info=await this.post('/api/uploads',{name:file.name,size:file.size,parent_type:null,parent_id:0,is_scorm:false,is_wmpkg:false,source:'',is_marked_attachment:false,embed_material_type:''});
  const uploadId=numeric(info.id),url=storageUploadUrl(info),sameOrigin=url.origin===LMS_ORIGIN;
  if(info.storage_type==='QINIU')throw new Error('此存储服务请使用原站上传');
  const raw=info.storage_type==='S3'&&info.transcoder==='WRPC',blob=new Blob([bytes],{type:'application/octet-stream'}),form=new FormData();form.append('file',blob,file.name);
  const headers=sameOrigin?await this.headers(false):{};delete headers.Accept;if(raw)headers['Content-Type']='application/octet-stream';
  const response=await this.reader.fetcher(url.href,{method:'PUT',credentials:sameOrigin?'include':'omit',redirect:'error',cache:'no-store',headers,body:raw?blob:form,signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error(`附件上传失败（HTTP ${response.status}）`);
  if(raw)await this.post(`/internal-api/upload/callback/${uploadId}`,{file_key:Number(uploadId)});
  const verified=await this.reader.get(`/api/uploads/${uploadId}`);
  if(String(verified.id)!==uploadId||verified.deleted||!['ready','processing'].includes(verified.status))throw new Error('附件尚未上传完成，请在原站核对');
  const userId=await this.reader.userId(courseId);
  const ownership={courseId:String(courseId),activityId:String(id),userId,name:file.name,size:file.size};this.uploads.set(uploadId,ownership);await this.session?.set({['desk:upload:'+uploadId]:ownership});
  return {id:uploadId,name:file.name,size:file.size};
 }
 async submit(courseId,id,payload){
  numeric(courseId);numeric(id);
  const {requestId,comment='',uploads=[]}=payload||{};
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(requestId||''))throw new Error('提交标识无效');
  if(typeof comment!=='string'||comment.length>100000||!Array.isArray(uploads)||uploads.length>30||new Set(uploads).size!==uploads.length)throw new Error('提交内容无效');
  if(!comment.trim()&&!uploads.length)throw new Error('请填写内容或选择附件');
  const key=`desk:submission:${courseId}:${id}:${requestId}`;
  if(this.flights.has(key))return this.flights.get(key);
  const flight=this.submitOnce(courseId,id,{comment,uploads},key);this.flights.set(key,flight);
  try{return await flight;}finally{this.flights.delete(key);}
 }
 async submitOnce(courseId,id,{comment,uploads},key){
  const saved=(await this.session?.get(key))?.[key];if(saved)return saved;
  const before=await this.preflight(courseId,id),userId=await this.reader.userId(courseId);
  for(const value of uploads){const uploadId=numeric(value),owned=this.uploads.get(uploadId)||(await this.session?.get('desk:upload:'+uploadId))?.['desk:upload:'+uploadId];if(!owned||owned.courseId!==String(courseId)||owned.activityId!==String(id)||owned.userId!==userId)throw new Error('附件状态已失效，请重新选择文件');}
  const uncertain={status:'uncertain',message:'提交结果待核对，请刷新提交记录，勿重复提交'};
  // Persist before the write so a worker restart cannot silently replay a POST.
  await this.session?.set({[key]:uncertain});
  let result={};
  try{result=await this.post(`/api/course/activities/${id}/submissions`,{comment:comment.trim()?commentHtml(comment):'',uploads:uploads.map(Number),slides:[],is_draft:false,mode:'normal',other_resources:[],uploads_in_rich_text:[]});}
  catch(e){if(e.status>=400&&e.status<500&&e.status!==408){await this.session?.remove(key);throw e;}}
  const receipt=result.submission?.id||result.submission_id||result.id;
  try{
   const detail=await this.reader.read({kind:'task',courseId,id});
   const previous=new Set(before.submissions.map(r=>r.id)),wanted=uploads.map(String).sort().join(','),html=comment.trim()?commentHtml(comment):'';
   const matches=detail.submissions.filter(r=>!r.draft&&(receipt?r.id===String(receipt):!previous.has(r.id)&&r.attachments.map(f=>f.id).sort().join(',')===wanted&&String(r.comment||'').trim()===html));
   if(matches.length!==1)return uncertain;
   const confirmed={status:'submitted',id:matches[0].id};await this.session?.set({[key]:confirmed});for(const value of uploads){this.uploads.delete(String(value));await this.session?.remove('desk:upload:'+value);}return confirmed;
  }catch{return uncertain;}
 }
}
