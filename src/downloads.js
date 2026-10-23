export function safeFilename(name){let v=String(name||'附件').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').slice(0,150);if(!v||/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(v))v='_'+v;return v;}
export function safeDownloadUrl(value){
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||!(u.hostname.endsWith('.yanhekt.cn')||u.hostname==='yanhekt.cn'||u.hostname.endsWith('.bit.edu.cn')))throw new Error('附件下载地址不受支持');return u.href;
}
export class AttachmentDownloads{
 constructor(api=globalThis.chrome?.downloads,session=globalThis.chrome?.storage?.session){this.api=api;this.session=session;this.owned=new Set();}
 async start(url,name,folder){const id=await this.api.download({url:safeDownloadUrl(url),filename:[folder&&safeFilename(folder),safeFilename(name)].filter(Boolean).join('/'),conflictAction:'uniquify',saveAs:false});this.owned.add(id);await this.session?.set({['desk:download:'+id]:true});return {id};}
 async status(ids){if(!Array.isArray(ids)||ids.length>500)throw new Error('下载编号无效');return Promise.all(ids.map(async id=>{if(!Number.isSafeInteger(id)||(!this.owned.has(id)&&!(await this.session?.get('desk:download:'+id))?.['desk:download:'+id]))throw new Error('不是本次附件下载');const [row]=await this.api.search({id});return {id,state:row?.state||'interrupted',error:row?.error||'',bytesReceived:row?.bytesReceived||0,totalBytes:row?.totalBytes||0};}));}
}
