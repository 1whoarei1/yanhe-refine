export const PLATFORM_ENTRIES={
 modern:'https://aita.yanhekt.cn/portal/?yh_native=1',
 legacy:'https://www.yanhekt.cn/home?yh_native=1',
 lms:'https://zy-eclass.bit.edu.cn/user/courses#/',
 lexue:'https://lexue.bit.edu.cn/my/'
};
export function sessionError(error){
 if(['AUTH_REQUIRED','SESSION_UNAVAILABLE'].includes(error?.code))return true;
 return /^(?:请(?:先)?(?:在同一浏览器)?登录|未读到当前浏览器的延河登录状态|已找到登录凭据|(?:旧站)?登录已失效|旧乐学登录状态不可用)/.test(String(error?.message||''))&&!String(error?.message).includes('没有访问权限');
}
const timedOut=()=>Object.assign(new Error('连接检查超时，请重试'),{code:'CONNECTION_TIMEOUT'});
export async function bounded(run,timeout,signal){
 const controller=new AbortController();let timer,abort;
 try{return await Promise.race([Promise.resolve().then(()=>run(signal?AbortSignal.any([signal,controller.signal]):controller.signal)),new Promise((_,reject)=>{
  timer=setTimeout(()=>{const error=timedOut();controller.abort(error);reject(error);},timeout);
  if(signal){abort=()=>{controller.abort(signal.reason);reject(signal.reason);};signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();}
 })]);}finally{clearTimeout(timer);if(abort)signal.removeEventListener('abort',abort);}
}

export class SessionRecovery{
 constructor({tabs=globalThis.chrome?.tabs,timeout=15000,entries=PLATFORM_ENTRIES}={}){this.tabs=tabs;this.timeout=timeout;this.entries=entries;}
 async run(source,probe,signal){
  if(!this.tabs?.create)throw Object.assign(new Error('请打开原站验证登录状态'),{code:'SESSION_UNAVAILABLE'});
  const url=this.entries[source];if(!url)throw new Error('平台无效');let tab;
  try{
   tab=await this.tabs.create({url,active:false});
   await bounded(inner=>this.loaded(tab.id,new URL(url).origin,inner),this.timeout,signal);
   return await probe();
  }finally{if(tab?.id!=null)await bounded(()=>this.tabs.remove(tab.id).catch(()=>{}),2000).catch(()=>{});}
 }
 loaded(id,origin,signal){return new Promise((resolve,reject)=>{
  const inspect=tab=>{if(tab?.status!=='complete')return;try{const page=new URL(tab.url);if(page.origin===origin){cleanup();resolve();}else if(page.hostname==='sso.bit.edu.cn'&&/\/login\/?$/.test(page.pathname)){cleanup();reject(Object.assign(new Error('请登录平台'),{code:'AUTH_REQUIRED'}));}}catch{}};
  const updated=(tabId,_change,tab)=>{if(tabId===id)inspect(tab);};
  const removed=tabId=>{if(tabId===id){cleanup();reject(Object.assign(new Error('验证页面已关闭，请重试'),{code:'SESSION_UNAVAILABLE'}));}};
  const aborted=()=>{cleanup();reject(signal.reason);};
  const cleanup=()=>{this.tabs.onUpdated?.removeListener(updated);this.tabs.onRemoved?.removeListener(removed);signal.removeEventListener('abort',aborted);};
  this.tabs.onUpdated?.addListener(updated);this.tabs.onRemoved?.addListener(removed);signal.addEventListener('abort',aborted,{once:true});
  if(signal.aborted){aborted();return;}this.tabs.get(id).then(inspect,error=>{cleanup();reject(error);});
 });}
}
