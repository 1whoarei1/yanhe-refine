async function request(operation,args){const response=await chrome.runtime.sendMessage({type:'REFINE_READ',operation,args});if(!response?.ok)throw new Error(response?.error||'扩展已更新，请刷新网页');return response.value;}
export class RemoteCatalog{
 async call(type,args={}){
  if(args.buffer){if(args.buffer.byteLength>32*1024*1024)throw new Error('目录文件超过 32 MB');const encoded=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(new Blob([args.buffer]));});args={name:args.name,encoded};}
  return request('catalog',{type,args});
 }
 worker={terminate(){}};
}
export class RemoteSources{
 legacy={enrolled:()=>request('legacy',{method:'enrolled'})};
 modern=Object.fromEntries(['enrolled','search','today','otherTeacherCourses','materials'].map(method=>[method,(...args)=>request('modern',{method,args})]));
 resolve=(...args)=>request('resolve',{args});
 detail=(...args)=>request('detail',{args});
 reset(){}
}
export class RemoteLms{
 courses=()=>request('lms',{method:'courses',args:[]});
 homeworks=id=>request('lms',{method:'homeworks',args:[id]});
 materials=id=>request('lms',{method:'materials',args:[id]});
 resources=(courseId,id)=>request('lms',{method:'resources',args:[courseId,id]});
 task=(courseId,id)=>request('lms',{method:'task',args:[courseId,id]});
 upload=(courseId,id,file)=>request('lmsWrite',{method:'upload',args:[courseId,id,file]});
 submit=(courseId,id,payload)=>request('lmsWrite',{method:'submit',args:[courseId,id,payload]});
}
export class RemoteLexue{
 courses=force=>request('lexue',{method:'courses',args:[Boolean(force)]});
 homeworks=id=>request('lexue',{method:'homeworks',args:[id]});
 materials=id=>request('lexue',{method:'materials',args:[id]});
 resources=(courseId,id)=>request('lexue',{method:'resources',args:[courseId,id]});
 material=(courseId,id)=>request('lexue',{method:'material',args:[courseId,id]});
 task=(courseId,id)=>request('lexue',{method:'task',args:[courseId,id]});
}
export const downloadAttachment=args=>request('download',args);
export const downloadStatus=ids=>request('downloadStatus',{ids});
