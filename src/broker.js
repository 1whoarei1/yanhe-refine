import md5 from 'blueimp-md5';
import {CourseSources} from './platform-api.js';
import {LmsClient} from './lms-client.js';
import {catalogOperation} from './catalog-worker.js';
import {isPlatformPage} from './site-routes.js';

const sources=new CourseSources({hash:md5}),lms=new LmsClient();let ready;
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
 if(operation==='lms'){if(!['courses','homeworks','materials','resources'].includes(args.method)||!Array.isArray(args.args))throw new Error('不支持的新乐学读取');if(args.method!=='courses')numeric(args.args[0]);return lms[args.method](...args.args);}
 throw new Error('不支持的操作');
}
