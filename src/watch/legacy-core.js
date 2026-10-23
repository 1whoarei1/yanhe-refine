import { mediaUrl } from './core.js';

// Legacy protocol reference: https://github.com/lankerr/BIT_yanhe_download_2026
// See THIRD_PARTY_NOTICES.md and licenses/BIT_yanhe_download.LICENSE.

export const LEGACY_ORIGIN = 'https://www.yanhekt.cn';
export const LEGACY_API = 'https://cbiz.yanhekt.cn';
// These are the legacy web client's public protocol constants, not account secrets.
const CLIENT_KEY = '1138b69dfef641d9d7ba49137d2d4875';

export function legacyHeaders(token,hash,now = Math.floor(Date.now()/1000)) {
  return { 'Xdomain-Client':'web_user','Xclient-Version':'v1','Xclient-Timestamp':String(now),
    'Xclient-Signature':hash(CLIENT_KEY + '_v1_undefined'), ...(token ? {Authorization:`Bearer ${token}`} : {}) };
}
export function legacyToken(value) { return typeof value === 'string' && /^[a-f0-9]{32}$/i.test(value) ? value : null; }
export function legacySignedUrl(raw,token,hash,now = Math.floor(Date.now()/1000)) {
  const url = mediaUrl(raw);
  if (!['cvideo.yanhekt.cn','coss.yanhekt.cn'].includes(url.hostname)) throw new Error('旧站返回了不支持的视频域名。');
  if (!token) throw new Error('旧站播放凭据未准备好。');
  const marker = hash(CLIENT_KEY + '_200');
  const parts = url.pathname.split('/');
  if (parts.at(-2) !== marker) parts.splice(-1,0,marker);
  url.pathname = parts.join('/');
  for (const key of ['Xvideo_Token','Xclient_Timestamp','Xclient_Signature','Xclient_Version','Platform']) url.searchParams.delete(key);
  url.searchParams.set('Xvideo_Token',token); url.searchParams.set('Xclient_Timestamp',String(now));
  url.searchParams.set('Xclient_Signature',hash(CLIENT_KEY + '_v1_' + now));
  url.searchParams.set('Xclient_Version','v1'); url.searchParams.set('Platform','yhkt_user'); return url.href;
}
export function legacyReplays(sessions) {
  const rows = [];
  for (const session of sessions || []) for (const [part,video] of (session.videos || []).entries()) {
    if (!video.main && !video.room && !video.vga) continue;
    const id = `${session.id}:${video.id}`;
    const date = String(session.started_at || '').slice(0,10);
    rows.push({id,title:`${date}${session.title || ''}${session.videos.length > 1 ? `（片段${part+1}）` : ''}`,
      start:Date.parse(String(session.started_at || '').replace(' ','T')) || 0,video});
  }
  return rows.sort((a,b)=>a.start-b.start);
}
export function legacyStreams(video) {
  const streams = {};
  if (video.vga) streams.screen = mediaUrl(video.vga).href;
  if (video.main || video.room) streams.classroom = mediaUrl(video.main || video.room).href;
  return {duration:Number(video.duration) || 0,streams};
}
export function legacyReferrerRule(extensionId) {
  return {id:2,priority:2,action:{type:'modifyHeaders',requestHeaders:[
    {header:'Referer',operation:'set',value:LEGACY_ORIGIN+'/'},
    {header:'Origin',operation:'set',value:LEGACY_ORIGIN}
  ]},condition:{requestDomains:['cbiz.yanhekt.cn','cvideo.yanhekt.cn','coss.yanhekt.cn'],initiatorDomains:[extensionId],resourceTypes:['xmlhttprequest','media','other']}};
}
export function parseLegacyCaptions(text) {
  const rows=[];
  const seconds=value=>{const parts=value.replace(',','.').split(':').map(Number);return parts.reduce((total,part)=>total*60+part,0);};
  for (const block of text.replace(/^\uFEFF/,'').replace(/\r/g,'').split(/\n\s*\n/)) {
    const lines=block.trim().split('\n'),index=lines.findIndex(line=>line.includes('-->'));
    if(index<0)continue;
    const match=lines[index].match(/((?:\d+:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d+:)?\d{2}:\d{2}[.,]\d{3})/);
    if(!match)continue;
    const start=seconds(match[1]),end=seconds(match[2]);
    const content=lines.slice(index+1).join(' ').replace(/<[^>]*>/g,'').trim();
    if(end>start&&content)rows.push({start,end,text:content});
  }
  return rows.sort((a,b)=>a.start-b.start);
}
