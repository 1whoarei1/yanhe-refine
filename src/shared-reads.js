export const readAborted=()=>new DOMException('读取已取消','AbortError');

export function withReadSignal(promise,signal){
 if(!signal)return promise;
 return new Promise((resolve,reject)=>{
  const abort=()=>{cleanup();reject(signal.reason||readAborted());},cleanup=()=>signal.removeEventListener('abort',abort);
  signal.addEventListener('abort',abort,{once:true});
  Promise.resolve(promise).then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
  if(signal.aborted)abort();
 });
}

// A read stops only after every consumer has released it. Another page may still need the same data.
export class SharedReads{
 constructor(){this.flights=new Map();}
 has(key){return this.flights.has(key);}
 read(key,load,{signal}={}){
  if(signal?.aborted)return Promise.reject(signal.reason||readAborted());
  let entry=this.flights.get(key);
  if(!entry){
   entry={controller:new AbortController(),consumers:new Set(),settled:false};this.flights.set(key,entry);
   entry.promise=Promise.resolve().then(()=>{entry.controller.signal.throwIfAborted();return load(entry.controller.signal);}).then(value=>{entry.controller.signal.throwIfAborted();return value;}).finally(()=>{entry.settled=true;if(this.flights.get(key)===entry)this.flights.delete(key);});
  }
  return new Promise((resolve,reject)=>{
   const consumer={},cleanup=()=>{signal?.removeEventListener('abort',abort);entry.consumers.delete(consumer);};
   const abort=()=>{
    cleanup();reject(signal.reason||readAborted());
    if(!entry.settled&&!entry.consumers.size){if(this.flights.get(key)===entry)this.flights.delete(key);entry.controller.abort(readAborted());}
   };
   entry.consumers.add(consumer);signal?.addEventListener('abort',abort,{once:true});
   entry.promise.then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
   if(signal?.aborted)abort();
  });
 }
}
