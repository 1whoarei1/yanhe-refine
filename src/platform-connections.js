import {PLATFORM_ENTRIES,sessionError,bounded,SessionRecovery} from './watch/session-recovery.js';
export {PLATFORM_ENTRIES,sessionError,SessionRecovery} from './watch/session-recovery.js';

export class PlatformConnections{
 constructor({probe,recovery=new SessionRecovery(),timeout=14000,now=()=>Date.now()}={}){Object.assign(this,{probe,recovery,timeout,now});this.flights=new Map();this.results=new Map();this.recovered=new Map();}
 check(source,{force=false,sessionFailure}={}){
  if(!Object.hasOwn(PLATFORM_ENTRIES,source))return Promise.reject(new Error('平台无效'));
  if(this.flights.has(source))return this.flights.get(source);
  const saved=this.results.get(source);if(!force&&saved?.connected&&this.now()-saved.checkedAt<30000)return Promise.resolve(saved);
  const flight=this.perform(source,force,sessionFailure).finally(()=>this.flights.delete(source));this.flights.set(source,flight);return flight;
 }
 async perform(source,force,sessionFailure){
  const probe=()=>bounded(signal=>this.probe(source,signal),this.timeout);
  try{
   try{if(sessionFailure)throw sessionFailure;await probe();}catch(error){
    if(!sessionError(error)||!force&&this.now()-(this.recovered.get(source)??-Infinity)<60000)throw error;
    this.recovered.set(source,this.now());await this.recovery.run(source,probe);
   }
   const result={connected:true,state:'connected',checkedAt:this.now()};this.results.set(source,result);return result;
  }catch(error){
   const state=error?.code==='SESSION_UNAVAILABLE'?'verification':sessionError(error)?'login':'error';
   const result={connected:false,state,checkedAt:this.now(),error:{code:error?.code||'',message:state==='login'?'请登录平台':state==='verification'?'请打开原站验证':error?.code==='CONNECTION_TIMEOUT'?'连接检查超时，请重试':'连接检查失败，请重试'}};
   this.results.set(source,result);return result;
  }
 }
}
