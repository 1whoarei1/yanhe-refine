import test from 'node:test';
import assert from 'node:assert/strict';
import md5 from 'blueimp-md5';
import {AutoSlidesIndex,indexedSession,mergeSessionSelection} from '../src/watch/autoslides-index.js';
import {LegacyYanheApi} from '../src/watch/legacy-api.js';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const snapshot=()=>({format:'yanhekt-session-index/v1',source:{kind:'self-collected'},partial:true,generatedAt:'2026-10-30T00:00:00Z',courses:[{id:'9397',name:'离散数学Ⅱ',term:'2026-2027-1',teachers:['教师'],sessions:['71990','72000']}]});
const snapshotUrl='chrome-extension://fixture/legacy-session-index.json';
test('legacy catalog uses local data only and retains explicit session ownership',async()=>{
 const calls=[],api=new AutoSlidesIndex({snapshotUrl,fetcher:async(raw,options)=>{calls.push(raw);assert.equal(options.credentials,'omit');return json(snapshot());}});
 assert.deepEqual((await api.terms()).terms,['2026-2027-1']);assert.equal((await api.search('离散')).rows[0].id,'9397');assert.deepEqual(await api.sessions('9397'),['71990','72000']);assert.deepEqual(calls,[snapshotUrl]);
});
test('missing catalogs direct users to import and never request an online index',async()=>{
 const api=new AutoSlidesIndex({snapshotUrl:null,fetcher:()=>{throw Error('Unexpected network');}});
 await assert.rejects(api.terms(),/导入旧版课次目录/);await assert.rejects(api.search('离散'),/导入旧版课次目录/);await assert.rejects(api.sessions('9397'),/导入旧版课次目录/);
});
function fixture({blocked=false,wrongCourse=false,videos=[301,302],listDenied=false}={}){
 const paths=[];const api=new LegacyYanheApi({hash:md5,snapshotUrl,fetcher:async(raw,options)=>{
  const u=new URL(raw);paths.push(u.pathname);
  if(raw===snapshotUrl){assert.equal(options.credentials,'omit');return blocked?new Response('',{status:404}):json(snapshot());}
  assert.equal(options.headers.Authorization,'Bearer fixture');assert.ok(!/\.(m3u8|mp4|flv)$/.test(u.pathname));
  assert.ok(!['/v2/course/session/list','/v1/course/session','/v1/video'].includes(u.pathname),'v1 embedded media must not depend on blocked endpoints');
  const data=u.pathname==='/v1/course'?{id:9397,name_zh:'离散数学Ⅱ'}:u.pathname==='/v1/course/session/list'?[{id:71990,course_id:wrongCourse?71990:9397,videos:videos.map(id=>({id,main:'https://cvideo.yanhekt.cn/test.m3u8',duration:5})),title:'集合',started_at:'2026-09-07 08:00:00'}]:{data:[]};
  if(listDenied&&u.pathname==='/v1/course/session/list')return new Response('',{status:403});return json({code:0,data});
 }});api.authenticate=async()=>{api.token='fixture';api.profile={id:730001};};return {api,paths};
}
test('v1 embedded video parts retain session identity while the index fills sessions with no returned recording',async()=>{
 const {api,paths}=fixture();const course=await api.course('9397',undefined,{force:true,indexed:true});assert.deepEqual(course.replays.map(r=>r.id),['71990:301','71990:302','72000:pending']);assert.ok(!paths.includes('/v1/video'));
 const info=await api.lecture('9397','71990:pending');assert.equal(info.selection.id,'71990:301');assert.deepEqual(info.sessionReplays.map(r=>r.id),['71990:301','71990:302']);assert.equal(info.selection.start,Date.parse('2026-09-07T08:00:00+08:00'));
 assert.deepEqual(mergeSessionSelection(course,info).replays.map(r=>r.id),['71990:301','71990:302','72000:pending']);assert.equal(paths.filter(p=>p==='/v1/video').length,0);
 assert.equal(info.sessionReplays[1].id,'71990:302');
});
test('a known session remains usable when the partial index is unavailable',async()=>{
 const {api}=fixture({blocked:true});const course=await api.course('9397',undefined,{force:true,indexed:true,sessionId:'71990'});assert.match(course.indexWarning,/导入旧版课次目录/);assert.deepEqual(course.replays.map(r=>r.id),['71990:301','71990:302']);assert.equal((await api.lecture('9397','71990:pending')).selection.id,'71990:301');
});
test('a denied v1 listing is not cached as an empty course and the next read reaches the server again',async()=>{
 const {api,paths}=fixture({listDenied:true});await assert.rejects(api.course('9397',undefined,{force:true,indexed:true,sessionId:'71990'}),/403/);
 const before=paths.length;await assert.rejects(api.course('9397'),/403/);assert.ok(paths.length>before);
});
test('wrong parent courses, absent recordings and unrelated video IDs never request media metadata',async()=>{
 for(const [settings,target,message]of [[{wrongCourse:true},'71990:pending',/不一致/],[{videos:[]},'71990:pending',/暂未提供/],[{},'71990:999',/不属于/]]){const {api,paths}=fixture(settings);await assert.rejects(api.lecture('9397',target),message);assert.ok(!paths.includes('/v1/video'));}
});
