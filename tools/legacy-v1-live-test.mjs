import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import md5 from 'blueimp-md5';
import {LegacyYanheApi} from '../src/watch/legacy-api.js';
import {AutoSlidesIndex} from '../src/watch/autoslides-index.js';

// A normal project CAS session supplies this value only to the child process.
const token=process.env.YANHE_LEGACY_TEST_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(token||''))throw Error('A verified legacy project login is required');
const root=process.cwd(),out=join(root,'test-results'),requests=[];
await mkdir(out,{recursive:true});
const snapshot=JSON.parse(await readFile(join(root,'local-data/release-session-index.json'),'utf8'));
const index=new AutoSlidesIndex({snapshotUrl:'https://local-fixture.invalid/snapshot',fetcher:async()=>Response.json(snapshot)});
const fetcher=async(raw,options={})=>{
 const url=new URL(raw);assert.ok(['cbiz.yanhekt.cn','cvideo.yanhekt.cn','coss.yanhekt.cn'].includes(url.hostname));
 if(url.hostname==='cbiz.yanhekt.cn'){
  requests.push(url.pathname);assert.ok(!['/v2/course/session/list','/v1/course/session','/v1/video','/v1/course'].includes(url.pathname));
 }
 url.searchParams.set('_yh_probe',crypto.randomUUID());
 return fetch(url,{...options,headers:{...options.headers,Origin:'https://www.yanhekt.cn',Referer:'https://www.yanhekt.cn/','Cache-Control':'no-cache, no-store'}});
};
const api=new LegacyYanheApi({index,hash:md5,fetcher,tabs:{query:async()=>[{id:1}],sendMessage:async()=>({token})}});
const report={mode:'actual plugin adapter; real project CAS account and upstream APIs; no browser profile reads',authenticated:false,wholeLectureSaved:false,courses:[]};
async function media(raw,limit){
 await api.prepareMedia(undefined,raw);const response=await fetcher(api.sign(raw),{signal:AbortSignal.timeout(18000)});
 const reader=response.body.getReader(),parts=[];let size=0;
 try{while(size<limit){const {done,value}=await reader.read();if(done)break;const part=value.subarray(0,limit-size);parts.push(Buffer.from(part));size+=part.length;}}finally{await reader.cancel().catch(()=>{});}
 return {response,bytes:Buffer.concat(parts)};
}
try{
 await api.authenticate();assert.ok(api.profile?.id);report.authenticated=true;
 for(const [courseId,sessionId] of [[48196,645315],[48197,663004],[48198,621093],[48199,658891],[48200,611100],[48201,633637],[48202,640073],[48203,658888]]){
  const row={courseId,sessionId,decoded:false};report.courses.push(row);
  try{
   const ref=await api.resolve({legacy:true,sessionId:String(sessionId)});assert.equal(ref.id,String(courseId));
   const course=await api.course(ref.id,undefined,{force:true,indexed:true,sessionId:ref.sessionId});row.title=course.title;
   row.recordedParts=course.replays.filter(r=>!r.indexed).length;
   const info=await api.lecture(ref.id,sessionId+':pending');assert.equal(info.selection.id.split(':')[0],String(sessionId));row.videoPart=info.selection.id;
   let raw=info.streams.screen||info.streams.classroom;assert.ok(raw);row.responses=[];
   for(let depth=0;depth<4;depth++){
    const {response,bytes}=await media(raw,256*1024);row.responses.push({kind:'playlist',http:response.status});assert.equal(response.status,200);assert.ok(bytes.subarray(0,16).toString().startsWith('#EXTM3U'));
    const lines=bytes.toString('utf8').split(/\r?\n/),refs=lines.filter(l=>l.trim()&&!l.startsWith('#'));assert.ok(refs.length);
    if(lines.some(l=>l.startsWith('#EXT-X-STREAM-INF'))){raw=new URL(refs[0],raw).href;continue;}
    assert.ok(!lines.some(l=>l.startsWith('#EXT-X-KEY')&&!l.includes('METHOD=NONE')));
    const result=await media(new URL(refs[Math.floor(refs.length/2)],raw).href,4*1024*1024);row.responses.push({kind:'middle segment',http:result.response.status,bytesRead:result.bytes.length});assert.equal(result.response.status,200);
    const sample=join(out,'legacy-v1-'+courseId+'.ts');await writeFile(sample,result.bytes);
    const decoded=spawnSync('ffmpeg',['-v','error','-i',sample,'-map','0:v:0','-frames:v','5','-an','-progress','pipe:1','-f','null','-'],{encoding:'utf8',timeout:20000});
    row.framesDecoded=Math.max(0,...decoded.stdout.split(/\r?\n/).filter(l=>l.startsWith('frame=')).map(l=>Number(l.slice(6))));
    assert.equal(decoded.status,0);assert.ok(row.framesDecoded>=5);row.decoded=true;break;
   }
  }catch(error){row.error=String(error.message).replace(/https?:\/\/\S+/g,'[url]').replace(/[a-f0-9]{32}/gi,'[redacted]');process.exitCode=1;}
  console.log(JSON.stringify(row));
 }
 report.requests=requests;report.ok=report.courses.length===8&&report.courses.every(row=>row.decoded);assert.ok(report.ok);
}catch(error){report.ok=false;report.error=String(error.message).replace(/https?:\/\/\S+/g,'[url]').replace(/[a-f0-9]{32}/gi,'[redacted]');process.exitCode=1;}
finally{await writeFile(join(out,'legacy-v1-live-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({authenticated:report.authenticated,courseCount:report.courses.length,decoded:report.courses.filter(r=>r.decoded).length,ok:report.ok}));}
