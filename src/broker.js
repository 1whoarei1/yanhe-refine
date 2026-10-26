import md5 from 'blueimp-md5';
import {CourseSources} from './platform-api.js';
import {LmsClient} from './lms-client.js';
import {LexueClient} from './lexue-client.js';
import {fileUrl} from './lexue-core.js';
import {catalogOperation} from './catalog-worker.js';
import {isPlatformPage} from './site-routes.js';
import {LmsWriter} from './lms-writer.js';
import {attachmentUrl} from './lms-core.js';
import {AttachmentDownloads} from './downloads.js';

const sources=new CourseSources({hash:md5}),lms=new LmsClient(),lexue=new LexueClient();let ready;
const writer=new LmsWriter(lms.fallback),downloads=new AttachmentDownloads();
async function catalogReady(){
 if(!ready)ready=(async()=>{let stats=await catalogOperation('init');const info=await fetch(chrome.runtime.getURL('build-info.json')).then(r=>r.json());const saved=await chrome.storage.local.get('desk:seed');
  if(info.catalog&&(saved['desk:seed']!==info.catalog.sha256||!stats.count)){const response=await fetch(chrome.runtime.getURL('private-catalog.json'));if(response.ok){stats=await catalogOperation('import',{name:'catalog.json',buffer:await response.arrayBuffer()});await chrome.storage.local.set({'desk:seed':info.catalog.sha256});}}
  return stats;
 })().catch(e=>{ready=null;throw e;});
 await ready;
}
const numeric=value=>{if(!/^\d{1,12}$/.test(String(value)))throw new Error('编号无效');};
export function trustedReader(sender){return sender.id===chrome.runtime.id&&(sender.url?.startsWith(chrome.runtime.getURL(''))||Boolean(sender.tab&&isPlatformPage(sender.url)));}
export async function readOperation(operation,args={}){
 if(operation==='catalog'){
  const {type}=args;if(!['init','stats','get','search','related','upsert','import'].includes(type))throw new Error('不支持的目录操作');
  await catalogReady();if(type==='init')return catalogOperation('stats');
  const data=args.args||{};
  if(type==='import'){if(typeof data.encoded!=='string'||data.encoded.length>45000000)throw new Error('目录文件过大');const raw=atob(data.encoded),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return catalogOperation(type,{name:String(data.name),buffer:bytes.buffer});}
  return catalogOperation(type,data);
 }
 if(operation==='legacy'&&args.method==='enrolled')return sources.enrolledLegacy();
 if(operation==='modern'){
  const methods=['enrolled','search','today','otherTeacherCourses','materials'];if(!methods.includes(args.method)||!Array.isArray(args.args))throw new Error('不支持的课堂读取');
  if(['otherTeacherCourses','materials'].includes(args.method))numeric(args.args[0]);
  if(args.method==='search'&&String(args.args[0]||'').length>512)throw new Error('搜索内容过长');
  return sources.modern[args.method](...args.args);
 }
 if(operation==='detail'){if(!['modern','legacy'].includes(args.args?.[0]))throw new Error('平台无效');numeric(args.args[1]);return sources.detail(...args.args);}
 if(operation==='resolve'){if(String(args.args?.[0]).length>4096)throw new Error('地址过长');return sources.resolve(...args.args);}
 if(operation==='lms'){if(!['courses','homeworks','materials','resources','task'].includes(args.method)||!Array.isArray(args.args))throw new Error('不支持的新乐学读取');if(args.method!=='courses')numeric(args.args[0]);if(['resources','task'].includes(args.method))numeric(args.args[1]);return lms[args.method](...args.args);}
 if(operation==='lexue'){if(!['courses','homeworks','materials','resources','material','task'].includes(args.method)||!Array.isArray(args.args))throw new Error('不支持的旧乐学读取');if(args.method!=='courses')numeric(args.args[0]);if(['resources','material','task'].includes(args.method))numeric(args.args[1]);return lexue[args.method](...args.args);}
 if(operation==='lmsWrite'){if(!['upload','submit'].includes(args.method)||!Array.isArray(args.args))throw new Error('不支持的作业操作');numeric(args.args[0]);numeric(args.args[1]);return writer[args.method](...args.args);}
 if(operation==='download'){
  numeric(args.courseId);numeric(args.id);
  if(args.source==='modern'){const file=await sources.modern.materialDownload(args.courseId,args.id);return downloads.start(file.url,file.name,args.folder);}
  if(args.source==='lexue'){
   const data=await lexue.read({kind:args.submissionId?'task':'resources',courseId:args.courseId,id:args.id,force:true});
   const files=args.submissionId?data.submissions.find(s=>s.id===String(args.submissionId))?.attachments:data.rows;
   // Assignment instructions use their own attachment list rather than course resources.
   const candidates=files||[];const file=candidates.find(f=>f.id===String(args.fileId)&&f.referenceId===String(args.referenceId));
   if(!file||!fileUrl(file.url))throw new Error('未找到该活动的附件');
   return downloads.start(fileUrl(file.url),file.name,args.folder);
  }
  if(args.source!=='lms')throw new Error('资料来源无效');
  const files=args.submissionId?(await lms.task(args.courseId,args.id)).submissions.find(s=>s.id===String(args.submissionId))?.attachments:await lms.resources(args.courseId,args.id);
  const file=files?.find(f=>f.id===String(args.fileId)&&f.referenceId===String(args.referenceId||''));if(!file)throw new Error('未找到该活动的附件');
  return downloads.start(attachmentUrl(file),file.name+(file.type==='folder'?'.zip':''),args.folder);
 }
 if(operation==='downloadStatus')return downloads.status(args.ids);
 throw new Error('不支持的操作');
}
