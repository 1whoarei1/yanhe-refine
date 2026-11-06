import {mediaUrl} from './core.js';

const normal=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
const term=value=>normal(value).replace(/[–—/]/g,'-').replace(/学年/g,'').replace(/第一学期/g,'-1').replace(/第二学期/g,'-2').replace(/第三学期/g,'-3').replace(/-+/g,'-');
const teachers=row=>(Array.isArray(row.teachers)?row.teachers:[row.teacher||'']).flatMap(value=>String(value).split(/[、,，;；/]+/)).map(normal).filter(Boolean);

export function sameCourse(a,b){
 if(!normal(a.title||a.name)||normal(a.title||a.name)!==normal(b.title||b.name))return false;
 if(a.term&&b.term&&term(a.term)!==term(b.term))return false;
 const x=teachers(a),y=teachers(b);return !x.length||!y.length||x.some(name=>y.includes(name));
}

export function liveTimestamp(value){
 if(!value)return 0;
 if(Number.isFinite(Number(value))){const number=Number(value);return number<1e12?number*1000:number;}
 const text=String(value).replace(' ','T');
 return Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(text)?text:text+'+08:00')||0;
}

export function liveDay(start){
 return new Date((liveTimestamp(start)||Date.now())+8*60*60*1000).toISOString().slice(0,10);
}

export function sameLiveTime(a,b){
 const start=liveTimestamp(a.start),other=liveTimestamp(b.start);
 return Boolean(start&&other&&Math.abs(start-other)<=15*60*1000);
}

export function liveStreamIds(streams){
 const ids=new Set();
 for(const raw of Object.values(streams||{})){
  try{
   // Both gateways expose the same opaque live channel, with different hosts and signatures.
   const match=mediaUrl(raw).pathname.match(/\/live\/([a-f0-9]{32})\.(?:m3u8|flv)$/i);
   if(match)ids.add(match[1].toLowerCase());
  }catch{ /* A malformed or unsupported URL cannot establish correspondence. */ }
 }
 return ids;
}

export function matchingLivePeers(context,rows){
 const current={...context.lecture,...context.info,start:context.info?.start||context.lecture?.start,end:context.info?.end||context.lecture?.end},channels=liveStreamIds(current.streams);
 const candidates=rows.filter(row=>row.info?.mode==='live'&&sameCourse(context.course,row)&&sameLiveTime(current,row.info));
 const exact=candidates.filter(row=>[...liveStreamIds(row.info.streams)].some(id=>channels.has(id)));
 if(exact.length)return exact.map(row=>({...row,match:'stream'}));
 return candidates.filter(row=>{
  // Known, different channels must never be rescued by a coincidentally matching title.
  if(channels.size&&liveStreamIds(row.info.streams).size)return false;
  const x=teachers(context.course),y=teachers(row);
  if(!x.length||!y.length||!x.some(name=>y.includes(name)))return false;
  const end=liveTimestamp(current.end),otherEnd=liveTimestamp(row.info.end);
  return !end||!otherEnd||Math.abs(end-otherEnd)<=15*60*1000;
 }).map(row=>({...row,match:'schedule'}));
}
