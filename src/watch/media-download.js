import {mediaUrl} from './core.js';

export const VIEW_NAMES={screen:'屏幕画面',classroom:'教室画面',student:'学生画面'};
export function fileStem(value,max=72){let name=String(value||'视频').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,max).replace(/[. ]+$/g,'');if(!name||/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name))name='_'+name;return name;}
export function replayViews(info){
 if(info?.mode&&info.mode!=='replay')return [];
 return Object.keys(VIEW_NAMES).filter(view=>info?.streams?.[view]);
}
export function downloadRequest(params){
 const courseId=params.get('course'),lectureId=params.get('lecture'),legacy=params.get('platform')==='legacy';
 if(!/^\d{1,12}$/.test(courseId||'')||!(legacy?/^\d{1,12}:\d{1,12}$/:/^\d{1,12}$/).test(lectureId||''))throw new Error('请从回放页面打开下载');
 const view=params.get('view');return {courseId,lectureId,legacy,view:view==='all'||Object.hasOwn(VIEW_NAMES,view)?view:'screen'};
}
const resolveMedia=(value,base)=>mediaUrl(new URL(value,base).href).href;
function attrs(text){const result={};for(const match of text.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g))result[match[1]]=match[2].replace(/^"|"$/g,'');return result;}
function range(value,previous){
 const match=String(value).match(/^(\d+)(?:@(\d+))?$/);if(!match)throw new Error('视频分段范围无效');
 const length=Number(match[1]),start=match[2]===undefined?previous:Number(match[2]);
 if(!Number.isSafeInteger(length)||length<=0||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(start+length))throw new Error('视频分段范围无效');
 return {start,end:start+length-1};
}
export function sequenceIv(sequence){
 let n=BigInt(sequence);if(n<0n||n>=(1n<<128n))throw new Error('视频分段序号无效');
 const bytes=new Uint8Array(16);for(let i=15;i>=0;i--){bytes[i]=Number(n&255n);n>>=8n;}return bytes;
}
function keyInfo(text,base){
 const fields=attrs(text);if(fields.METHOD==='NONE')return null;
 if(fields.METHOD!=='AES-128'||(fields.KEYFORMAT&&fields.KEYFORMAT!=='identity')||!fields.URI)throw new Error('此加密视频格式暂不支持下载');
 let iv;if(fields.IV){const value=fields.IV.replace(/^0x/i,'');if(!/^[a-f\d]{1,32}$/i.test(value))throw new Error('视频密钥参数无效');iv=sequenceIv(BigInt('0x'+value));}
 return {url:resolveMedia(fields.URI,base),iv};
}
export function parsePlaylist(text,base){
 const lines=String(text).replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(s=>s.trim());
 if(lines[0]!=='#EXTM3U')throw new Error('平台未返回有效视频清单');
 const variants=[],audio=[],segments=[];let pending=null,key=null,init=null,byteRange=null,previousRange=null,previousUrl=null,sequence=0n,duration=0,gap=false;
 for(const line of lines.slice(1)){
  if(line.startsWith('#EXT-X-STREAM-INF:')){pending=attrs(line.slice(18));continue;}
  if(line.startsWith('#EXT-X-MEDIA:')){const a=attrs(line.slice(13));if(a.TYPE==='AUDIO'&&a.URI)audio.push(a);continue;}
  if(line.startsWith('#EXT-X-MEDIA-SEQUENCE:')){if(!/^\d+$/.test(line.slice(22)))throw new Error('视频分段序号无效');sequence=BigInt(line.slice(22));continue;}
  if(line.startsWith('#EXT-X-KEY:')){key=keyInfo(line.slice(11),base);continue;}
  if(line.startsWith('#EXT-X-MAP:')){
   const a=attrs(line.slice(11));if(!a.URI)throw new Error('视频初始化段缺失');
   if(key&&!key.iv)throw new Error('视频初始化段缺少密钥参数');
   const value={url:resolveMedia(a.URI,base),range:a.BYTERANGE?range(a.BYTERANGE,0):null,key};
   if(init&&JSON.stringify(init)!==JSON.stringify(value))throw new Error('此视频包含多种初始化格式，暂不支持合并下载');init=value;continue;
  }
  if(line.startsWith('#EXT-X-BYTERANGE:')){byteRange=line.slice(17);continue;}
  if(line==='#EXT-X-GAP')gap=true;
  if(line.startsWith('#EXT-X-SKIP:'))throw new Error('视频清单不完整，请稍后重试');
  if(line.startsWith('#EXTINF:'))duration+=Number.parseFloat(line.slice(8))||0;
  if(!line||line.startsWith('#'))continue;
  const url=resolveMedia(line,base);
  if(pending){variants.push({url,bandwidth:Number(pending.BANDWIDTH)||0,audio:pending.AUDIO});pending=null;continue;}
  const selectedRange=byteRange?range(byteRange,previousUrl===url?previousRange?.end+1:undefined):null;
  segments.push({url,range:selectedRange,key:key?{...key,iv:key.iv||sequenceIv(sequence)}:null});sequence++;previousRange=selectedRange;previousUrl=url;byteRange=null;
 }
 if(variants.length)return {variants:variants.sort((a,b)=>b.bandwidth-a.bandwidth),audio};
 if(!lines.includes('#EXT-X-ENDLIST'))throw new Error('当前是直播流，回放生成后才能下载');
 if(gap||!segments.length||byteRange)throw new Error('视频清单不完整，无法下载完整回放');
 return {segments,init,extension:init?'mp4':'ts',duration};
}

async function readChunk(reader,signal){
 signal?.throwIfAborted();let timer;
 try{return await Promise.race([reader.read(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('下载超时，请重试')),60000);})]);}
 finally{clearTimeout(timer);}
}
async function bytesFrom(response,signal,max){
 const reader=response.body?.getReader();if(!reader)throw new Error('视频响应为空');
 const chunks=[];let total=0;
 try{for(;;){const {value,done}=await readChunk(reader,signal);if(done)break;total+=value.length;if(total>max)throw new Error('视频分段过大，暂不支持此格式');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const result=new Uint8Array(total);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
export class ReplayDownloader{
 constructor(api,{fetcher=globalThis.fetch.bind(globalThis),crypto=globalThis.crypto}={}){this.api=api;this.fetcher=fetcher;this.crypto=crypto;}
 async request(raw,{signal,range:part}={}){
  mediaUrl(raw);
  for(let attempt=0;attempt<2;attempt++){
   signal?.throwIfAborted();await this.api.prepareMedia?.(signal);
   const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),30000);let response;
   try{response=await this.fetcher(this.api.sign(raw),{credentials:'include',redirect:'error',cache:'no-store',headers:part?{Range:`bytes=${part.start}-${part.end}`}:{},signal:signal?AbortSignal.any([signal,timeout.signal]):timeout.signal});}
   finally{clearTimeout(timer);}
   if([401,403].includes(response.status)&&!attempt){await response.body?.cancel();await this.api.authenticate({signal,force:true});continue;}
   if(!response.ok){await response.body?.cancel();throw new Error(`视频源返回 HTTP ${response.status}`);}
   const type=response.headers.get('content-type')||'';
   if(/text\/html|application\/json/i.test(type)){await response.body?.cancel();throw new Error('平台未返回视频文件，请重新登录后重试');}
   if(part&&(response.status!==206||response.headers.get('content-range')?.split('/')[0]!==`bytes ${part.start}-${part.end}`)){await response.body?.cancel();throw new Error('服务器未按视频分段范围返回数据');}
   return response;
  }
 }
 async plan(raw,signal){
  let url=mediaUrl(raw).href;
  if(!/\.m3u8$/i.test(new URL(url).pathname)){
   const extension=new URL(url).pathname.match(/\.(mp4|m4v|flv)$/i)?.[1]?.toLowerCase();
   if(!extension)throw new Error('暂不支持此视频格式');return {url,extension};
  }
  for(let depth=0;depth<4;depth++){
   const response=await this.request(url,{signal}),text=new TextDecoder().decode(await bytesFrom(response,signal,4*1024*1024));
   const list=parsePlaylist(text,url);
   if(!list.variants)return list;
   const selected=list.variants[0];
   if(selected.audio&&list.audio.some(a=>a['GROUP-ID']===selected.audio))throw new Error('此视频使用独立音轨，暂不支持合并下载');
   url=selected.url;
  }
  throw new Error('视频清单嵌套过多');
 }
 async save(plan,writable,{signal,onProgress=()=>{}}={}){
  let received=0,completed=0;const totalSegments=plan.segments?.length||0;const keys=new Map();
  const progress=total=>onProgress({received,total,completed,totalSegments});
  const copy=async(part,total=0)=>{
   if(part.key){
    let key=keys.get(part.key.url);
    if(!key){const response=await this.request(part.key.url,{signal}),raw=await bytesFrom(response,signal,16);if(raw.length!==16)throw new Error('视频密钥无效');key=await this.crypto.subtle.importKey('raw',raw,'AES-CBC',false,['decrypt']);keys.set(part.key.url,key);}
    const response=await this.request(part.url,{signal,range:part.range}),encrypted=await bytesFrom(response,signal,128*1024*1024);signal?.throwIfAborted();
    const plain=await this.crypto.subtle.decrypt({name:'AES-CBC',iv:part.key.iv},key,encrypted);await writable.write(new Uint8Array(plain));received+=encrypted.length;progress(total);return;
   }
   const response=await this.request(part.url,{signal,range:part.range});
   const reader=response.body?.getReader();if(!reader)throw new Error('视频响应为空');
   const expected=part.range?part.range.end-part.range.start+1:Number(response.headers.get('content-length'))||0;let partReceived=0;
   try{for(;;){const {value,done}=await readChunk(reader,signal);if(done)break;signal?.throwIfAborted();await writable.write(value);received+=value.length;partReceived+=value.length;progress(total||(!totalSegments?expected:0));}}
   finally{await reader.cancel().catch(()=>{});}
   if(expected&&partReceived!==expected)throw new Error('视频下载不完整，请重试');
   if(!partReceived)throw new Error('视频分段为空');
  };
  try{
   if(plan.url)await copy({url:plan.url});
   else{if(plan.init)await copy(plan.init);for(const part of plan.segments){await copy(part);completed++;progress(0);}}
   signal?.throwIfAborted();await writable.close();return {bytes:received};
  }catch(error){await writable.abort().catch(()=>{});throw error;}
 }
}
