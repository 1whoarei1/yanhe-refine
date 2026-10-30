// Probe tabs without starting a platform request. Only one ready tab does the read.
export class ReaderBridge {
 constructor({kind,origin,fallback,tabTimeout=1500,readTimeout=45000,now=()=>Date.now()}){Object.assign(this,{kind,origin,fallback,tabTimeout,readTimeout,now});this.tab=null;this.badTabs=new Map();this.flights=new Map();}
 async bounded(run,timeout,onTimeout=()=>{}){
  let timer;try{return await Promise.race([Promise.resolve().then(run),new Promise((_,reject)=>{timer=setTimeout(()=>{onTimeout();reject(new Error((this.kind==='lms'?'新乐学':'旧乐学')+'读取超时，请刷新重试'));},timeout);})]);}finally{clearTimeout(timer);}
 }
 read(args){
  const key=JSON.stringify(args);if(this.flights.has(key))return this.flights.get(key);
  const flight=this.perform(args).finally(()=>{if(this.flights.get(key)===flight)this.flights.delete(key);});this.flights.set(key,flight);return flight;
 }
 async readFallback(args){
  const controller=new AbortController();
  return this.bounded(()=>this.fallback.read({...args,signal:controller.signal}),this.timeout(args),()=>controller.abort());
 }
 timeout(args){return args.kind==='homework'?Math.max(this.readTimeout,90000):this.readTimeout;}
 async perform(args){
  const tabs=await chrome.tabs.query({url:[this.origin+'/*']});
  const order=this.tab?[...tabs.filter(t=>t.id===this.tab),...tabs.filter(t=>t.id!==this.tab)]:tabs;
  for(const tab of order.filter(t=>(this.badTabs.get(t.id)||0)<=this.now()).slice(0,3)){
   try{
    const ready=await this.bounded(()=>chrome.tabs.sendMessage(tab.id,{type:'DESK_READER_PING',kind:this.kind},{frameId:0}),this.tabTimeout);
    if(ready?.version!==1||ready.kind!==this.kind)throw new Error('Reader unavailable');
   }catch{this.badTabs.set(tab.id,this.now()+30000);continue;}
   const requestId=crypto.randomUUID();let timedOut=false;
   try{
    const reply=await this.bounded(()=>chrome.tabs.sendMessage(tab.id,{type:this.kind==='lms'?'DESK_LMS_READ':'DESK_LEXUE_READ',requestId,args},{frameId:0}),this.timeout(args),()=>{
     timedOut=true;void chrome.tabs.sendMessage(tab.id,{type:'DESK_READER_CANCEL',requestId},{frameId:0}).catch(()=>{});
    });
    if(reply?.ok){this.tab=tab.id;return reply.data;}
   }catch(error){if(timedOut){this.badTabs.set(tab.id,this.now()+30000);throw error;}}
   // The selected reader has finished or disconnected; do not start the same read in other tabs.
   this.badTabs.set(tab.id,this.now()+30000);break;
  }
  try{return await this.readFallback(args);}catch(error){if(error.name==='TimeoutError')throw new Error((this.kind==='lms'?'新乐学':'旧乐学')+'读取超时，请刷新重试');throw error;}
 }
}
