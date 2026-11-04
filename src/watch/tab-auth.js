export async function readAuthTabs(tabs,origin,message,{signal,timeout=1500}={}){
 if(!tabs)return [];
 signal?.throwIfAborted();const pages=await tabs.query({url:[origin+'/*']});
 const selected=[...pages].sort((a,b)=>Number(b.active)-Number(a.active)||(b.lastAccessed||0)-(a.lastAccessed||0)).slice(0,8);
 const results=await Promise.allSettled(selected.map(async page=>{
  let timer,abort;try{return await Promise.race([
   Promise.resolve().then(()=>tabs.sendMessage(page.id,message,{frameId:0})),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('登录页暂未响应')),timeout);if(signal){abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();}})
  ]);}finally{clearTimeout(timer);if(abort)signal.removeEventListener('abort',abort);}
 }));signal?.throwIfAborted();return results.filter(result=>result.status==='fulfilled').map(result=>result.value);
}
