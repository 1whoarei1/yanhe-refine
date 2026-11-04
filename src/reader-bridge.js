// Probe tabs without starting a platform request. Only one ready tab does the read.
import {SharedReads,withReadSignal} from './shared-reads.js';
export class ReaderBridge {
 constructor({kind,origin,fallback,tabTimeout=1500,readTimeout=45000,now=()=>Date.now()}){Object.assign(this,{kind,origin,fallback,tabTimeout,readTimeout,now});this.tab=null;this.badTabs=new Map();this.flights=new SharedReads();}
 async bounded(run,timeout,onTimeout=()=>{},signal){
  signal?.throwIfAborted();let timer;try{return await withReadSignal(Promise.race([Promise.resolve().then(run),new Promise((_,reject)=>{timer=setTimeout(()=>{onTimeout();reject(new Error((this.kind==='lms'?'新乐学':'旧乐学')+'读取超时，请刷新重试'));},timeout);})]),signal);}finally{clearTimeout(timer);}
 }
 read(args,options){
  return this.flights.read(JSON.stringify(args),signal=>this.perform(args,signal),options);
 }
 async readFallback(args,{signal}={}){
  signal?.throwIfAborted();const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  return this.bounded(()=>this.fallback.read({...args,signal:combined}),this.timeout(args),()=>controller.abort(),signal);
 }
 timeout(args){return args.kind==='homework'?Math.max(this.readTimeout,90000):this.readTimeout;}
 async perform(args,signal){
  const tabs=await withReadSignal(chrome.tabs.query({url:[this.origin+'/*']}),signal);signal?.throwIfAborted();
  const order=this.tab?[...tabs.filter(t=>t.id===this.tab),...tabs.filter(t=>t.id!==this.tab)]:tabs;
  for(const tab of order.filter(t=>(this.badTabs.get(t.id)||0)<=this.now()).slice(0,3)){
   try{
    const ready=await this.bounded(()=>chrome.tabs.sendMessage(tab.id,{type:'DESK_READER_PING',kind:this.kind},{frameId:0}),this.tabTimeout,undefined,signal);
    if(ready?.version!==1||ready.kind!==this.kind)throw new Error('Reader unavailable');
   }catch{signal?.throwIfAborted();this.badTabs.set(tab.id,this.now()+30000);continue;}
   const requestId=crypto.randomUUID();let timedOut=false;
   const cancel=()=>{void chrome.tabs.sendMessage(tab.id,{type:'DESK_READER_CANCEL',requestId},{frameId:0}).catch(()=>{});};
   signal?.addEventListener('abort',cancel,{once:true});
   try{
    const reply=await this.bounded(()=>chrome.tabs.sendMessage(tab.id,{type:this.kind==='lms'?'DESK_LMS_READ':'DESK_LEXUE_READ',requestId,args},{frameId:0}),this.timeout(args),()=>{
     timedOut=true;cancel();
    },signal);
    signal?.throwIfAborted();
    if(reply?.ok){this.tab=tab.id;return reply.data;}
   }catch(error){signal?.throwIfAborted();if(timedOut){this.badTabs.set(tab.id,this.now()+30000);throw error;}}
   finally{signal?.removeEventListener('abort',cancel);}
   // The selected reader has finished or disconnected; do not start the same read in other tabs.
   this.badTabs.set(tab.id,this.now()+30000);break;
  }
  signal?.throwIfAborted();try{return await this.readFallback(args,{signal});}catch(error){signal?.throwIfAborted();if(error.name==='TimeoutError')throw new Error((this.kind==='lms'?'新乐学':'旧乐学')+'读取超时，请刷新重试');throw error;}
 }
}
