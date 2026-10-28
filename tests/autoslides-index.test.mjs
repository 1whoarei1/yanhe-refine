import test from 'node:test';
import assert from 'node:assert/strict';
import md5 from 'blueimp-md5';
import {AutoSlidesIndex,indexedSession,mergeSessionSelection} from '../src/watch/autoslides-index.js';
import {LegacyYanheApi} from '../src/watch/legacy-api.js';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
test('index search is anonymous, bounded to returned results, and locally paged without claiming complete coverage',async()=>{
 const requests=[],api=new AutoSlidesIndex({fetcher:async(raw,options)=>{const u=new URL(raw);requests.push(u);assert.equal(u.origin,'https://share.ruc.edu.kg');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.deepEqual(options.headers,{Accept:'application/json'});return json({total:6000,truncated:true,results:Array.from({length:200},(_,i)=>({id:100+i,name:'旧课程',term:'2026-2027-1',number:null,teachers:['教师'],sessionCount:3}))});}});
 const result=await api.search('旧课程',{term:'2026-2027-1',page:5});assert.equal(result.rows.length,40);assert.equal(result.total,200);assert.equal(result.reportedTotal,6000);assert.equal(result.truncated,true);assert.equal(result.rows[0].id,'260');assert.equal(result.rows[0].indexSessionCount,3);assert.equal(result.rows[0].replayCount,undefined);
 await api.search('旧课程',{term:'2026-2027-1',page:1});assert.equal(requests.length,1);assert.equal(requests[0].searchParams.has('page'),false);assert.equal(requests[0].searchParams.get('term'),'2026-2027-1');
});
test('403 HTML, unknown courses and malformed IDs are errors rather than empty results',async()=>{
 await assert.rejects(new AutoSlidesIndex({fetcher:async()=>new Response('<html>challenge</html>',{status:403})}).terms(),/403/);
 await assert.rejects(new AutoSlidesIndex({fetcher:async()=>json({error:'not-found'},404)}).sessions('9397'),/尚未收录/);
 await assert.rejects(new AutoSlidesIndex({fetcher:async()=>json({course:71990,sessions:[71990]})}).sessions('9397'),/格式/);
 await assert.rejects(new AutoSlidesIndex({fetcher:async()=>json({course:9397,sessions:['71990','https://evil.invalid/']})}).sessions('9397'),/格式/);
});
test('terms are discovered from the deployment; session IDs stay independent of course IDs',async()=>{
 const api=new AutoSlidesIndex({fetcher:async raw=>new URL(raw).pathname==='/api/terms'?json({updatedAt:1793000000000,terms:['2026-2027-1','2025-2026-2']}):json({course:9397,sessions:[72000,71990,71990]})});
 assert.deepEqual((await api.terms()).terms,['2026-2027-1','2025-2026-2']);assert.deepEqual(await api.sessions('9397'),['71990','72000']);
});
function fixture({blocked=false,wrongCourse=false,videos=[301,302],listDenied=false}={}){
 const paths=[];const api=new LegacyYanheApi({hash:md5,fetcher:async(raw,options)=>{
  const u=new URL(raw);paths.push(u.pathname);
  if(u.origin==='https://share.ruc.edu.kg'){assert.equal(options.headers.Authorization,undefined);assert.equal(options.credentials,'omit');return blocked?new Response('challenge',{status:403}):json({course:9397,sessions:[71990,72000]});}
  assert.equal(options.headers.Authorization,'Bearer fixture');assert.ok(!/\.(m3u8|mp4|flv)$/.test(u.pathname));
  const data=u.pathname==='/v1/course'?{id:9397,name_zh:'离散数学Ⅱ'}:u.pathname==='/v2/course/session/list'?[]:u.pathname==='/v1/course/session'?{id:Number(u.searchParams.get('session_id')),course_id:wrongCourse?71990:9397,video_ids:videos,title:'集合',started_at:'2026-09-07 08:00:00'}:{id:Number(u.searchParams.get('id')),course_id:0,session_id:0,main:'https://cvideo.yanhekt.cn/test.m3u8',duration:5};
  if(listDenied&&u.pathname==='/v2/course/session/list')return new Response('',{status:403});return json({code:0,data});
 }});api.authenticate=async()=>{api.token='fixture';api.profile={id:730001};};return {api,paths};
}
test('index fills missing sessions, then only the selected session and video are resolved; parts retain session identity',async()=>{
 const {api,paths}=fixture();const course=await api.course('9397',undefined,{force:true,indexed:true});assert.deepEqual(course.replays.map(r=>r.id),['71990:pending','72000:pending']);assert.ok(!paths.includes('/v1/video'));
 const info=await api.lecture('9397','71990:pending');assert.equal(info.selection.id,'71990:301');assert.deepEqual(info.sessionReplays.map(r=>r.id),['71990:301','71990:302']);assert.equal(info.selection.start,Date.parse('2026-09-07T08:00:00+08:00'));
 assert.deepEqual(mergeSessionSelection(course,info).replays.map(r=>r.id),['71990:301','71990:302','72000:pending']);assert.equal(paths.filter(p=>p==='/v1/video').length,1);
 assert.equal(info.sessionReplays[1].id,'71990:302');
});
test('a known session remains usable when the partial index is unavailable',async()=>{
 const {api}=fixture({blocked:true});const course=await api.course('9397',undefined,{force:true,indexed:true,sessionId:'71990'});assert.match(course.indexWarning,/403/);assert.deepEqual(course.replays,[indexedSession('71990')]);assert.equal((await api.lecture('9397','71990:pending')).selection.id,'71990:301');
});
test('a denied v2 listing is not cached as empty; the explicit session uses its authoritative metadata',async()=>{
 const {api,paths}=fixture({listDenied:true});const course=await api.course('9397',undefined,{force:true,indexed:true,sessionId:'71990'});assert.equal(course.replays[0].id,'71990:pending');assert.equal((await api.lecture('9397','71990:302')).selection.id,'71990:302');
 const before=paths.length;await assert.rejects(api.course('9397'),/403/);assert.ok(paths.length>before);
});
test('wrong parent courses, absent recordings and unrelated video IDs never request media metadata',async()=>{
 for(const [settings,target,message]of [[{wrongCourse:true},'71990:pending',/不一致/],[{videos:[]},'71990:pending',/暂未提供回放/],[{},'71990:999',/不属于/]]){const {api,paths}=fixture(settings);await assert.rejects(api.lecture('9397',target),message);assert.ok(!paths.includes('/v1/video'));}
});
