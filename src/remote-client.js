import {withReadSignal} from './shared-reads.js';
async function request(operation,args,{signal}={}){
 signal?.throwIfAborted();const requestId=signal?crypto.randomUUID():undefined;
 const cancel=()=>{void chrome.runtime.sendMessage({type:'REFINE_CANCEL',requestId}).catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 try{const response=await withReadSignal(chrome.runtime.sendMessage({type:'REFINE_READ',operation,args,...(requestId?{requestId}:{})}),signal);if(!response?.ok)throw Object.assign(new Error(response?.error||'扩展已更新，请刷新网页'),{name:response?.name||'Error'});return response.value;}
 finally{signal?.removeEventListener('abort',cancel);}
}
export class RemoteCatalog{
 async call(type,args={}){
  if(args.buffer){if(args.buffer.byteLength>32*1024*1024)throw new Error('目录文件超过 32 MB');const encoded=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(new Blob([args.buffer]));});args={name:args.name,encoded};}
  return request('catalog',{type,args});
 }
 worker={terminate(){}};
}
export class RemoteSources{
 index=Object.fromEntries(['terms','search'].map(method=>[method,(...args)=>request('legacyIndex',{method,args})]));
 legacy={enrolled:()=>request('legacy',{method:'enrolled'})};
 modern=Object.fromEntries(['enrolled','search','today','otherTeacherCourses','materials'].map(method=>[method,(...args)=>request('modern',{method,args})]));
 constructor(){this.modern.materials=(id,options)=>request('modern',{method:'materials',args:[id]},options);}
 resolve=(...args)=>request('resolve',{args});
 detail=(...args)=>request('detail',{args});
 reset(){}
}
export class RemoteLms{
 courses=force=>request('lms',{method:'courses',args:[Boolean(force)]});
 homeworks=(id,options)=>request('lms',{method:'homeworks',args:[id]},options);
 materials=(id,options)=>request('lms',{method:'materials',args:[id]},options);
 resources=(courseId,id)=>request('lms',{method:'resources',args:[courseId,id]});
 task=(courseId,id)=>request('lms',{method:'task',args:[courseId,id]});
 upload=(courseId,id,file)=>request('lmsWrite',{method:'upload',args:[courseId,id,file]});
 submit=(courseId,id,payload)=>request('lmsWrite',{method:'submit',args:[courseId,id,payload]});
}
export class RemoteLexue{
 courses=force=>request('lexue',{method:'courses',args:[Boolean(force)]});
 homeworks=(id,options)=>request('lexue',{method:'homeworks',args:[id]},options);
 materials=(id,options)=>request('lexue',{method:'materials',args:[id]},options);
 resources=(courseId,id)=>request('lexue',{method:'resources',args:[courseId,id]});
 material=(courseId,id)=>request('lexue',{method:'material',args:[courseId,id]});
 task=(courseId,id)=>request('lexue',{method:'task',args:[courseId,id]});
}
export const downloadAttachment=args=>request('download',args);
export const downloadStatus=ids=>request('downloadStatus',{ids});
export const cancelDownload=id=>request('cancelDownload',{id});
export const checkPluginUpdate=()=>request('checkUpdate',{});
export const checkPlatformConnection=(source,force=false)=>request('connection',{source,force});
