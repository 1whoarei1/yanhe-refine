import test from 'node:test';
import assert from 'node:assert/strict';
import {sameCourse,matchingLive,liveTimestamp,cleanLinks,liveCourseCandidates,accountLiveCandidates} from '../src/watch/live-links.js';
import {liveDay,liveStreamIds,matchingLivePeers} from '../src/watch/live-match.js';
import {YanheApi} from '../src/watch/api.js';
import {LegacyYanheApi} from '../src/watch/legacy-api.js';
import {legacyLive} from '../src/watch/legacy-core.js';
test('course correspondence uses title, teacher and term, never equal numeric IDs',()=>{
 const modern={id:'102154',title:'计算机新技术专题',teacher:'黄河燕',term:'2026-2027-1'};
 assert.equal(sameCourse(modern,{id:73687,name:'计算机新技术专题',teachers:['黄河燕'],term:'2026–2027学年第一学期'}),true);
 assert.equal(sameCourse(modern,{id:'102154',name:'另一门课',teachers:['黄河燕'],term:modern.term}),false);
 assert.equal(sameCourse(modern,{name:modern.title,teacher:'另一位教师',term:modern.term}),false);
 assert.equal(sameCourse(modern,{name:modern.title,teacher:modern.teacher,term:'2025-2026-1'}),false);
});

test('live candidates use shared modern/session catalogs in both directions and preserve ambiguous matches',async()=>{
 const course={id:'100',title:'示例课程',teacher:'教师甲',term:'2026-2027-1'},kinds=[];
 const readCatalog=async kind=>{kinds.push(kind);return {courses:[{id:'200',name:'示例课程',teachers:['教师甲'],term:course.term},{id:'201',title:'示例课程',teacher:'教师甲',term:course.term},{id:'100',title:'不相关课程'},{id:'202',title:course.title,teacher:'教师乙',term:course.term}]};};
 const old=await liveCourseCandidates(course,'legacy',{readCatalog}),modern=await liveCourseCandidates(course,'modern',{readCatalog});
 assert.deepEqual(kinds,['sessions','modern']);assert.deepEqual(old.map(r=>r.id),['200','201']);assert.ok(old.every(r=>r.legacy));assert.ok(modern.every(r=>!r.legacy));
});

test('a cancelled catalog lookup cannot supply a candidate for the next lecture',async()=>{
 const controller=new AbortController();let finish;
 const read=liveCourseCandidates({title:'课程'},'legacy',{signal:controller.signal,readCatalog:()=>new Promise(resolve=>finish=resolve)});
 controller.abort();finish({courses:[{id:'200',name:'课程'}]});await assert.rejects(read,{name:'AbortError'});
 assert.deepEqual(await liveCourseCandidates({title:'课程'},'modern',{readCatalog:async()=>null}),[]);
});
test('an explicitly live class is not ended by its timetable while ended status remains authoritative',()=>{
 const row={status:1,schedule_started_at:'2026-10-28 13:20:00',schedule_ended_at:'2026-10-28 14:55:00',target:'https://clive14.yanhekt.cn/live/test.m3u8'},now=Date.parse('2026-10-28T07:30:00Z');
 assert.equal(legacyLive(row,now).mode,'live');assert.equal(legacyLive({...row,status:3},now).mode,'ended');assert.equal(legacyLive({...row,status:2},now).mode,'ended');
});
test('legacy live listing uses source_id and validates the returned course owner',async()=>{
 const api=new LegacyYanheApi({hash:()=> 'fixture-signature',fetcher:async raw=>{const url=new URL(raw);assert.equal(url.pathname,'/v2/live/list');assert.equal(url.searchParams.get('source_id'),'73687');assert.equal(url.searchParams.has('course_id'),false);return new Response(JSON.stringify({code:0,data:{data:[{id:11,source_id:73687,status:1,title:'目标课程'},{id:12,source_id:73688,status:1,title:'另一课程'}]}}),{status:200});}});
 const rows=await api.liveList('73687');assert.deepEqual(rows.map(row=>row.id),['live:11']);
});
test('old clive playback does not request an unrelated recording token',async()=>{
 const api=new LegacyYanheApi({fetcher:async()=>{throw new Error('recording token must not be requested');}});
 await api.prepareMedia(undefined,'https://clive14.yanhekt.cn/legacy-live/test.m3u8');await api.prepareMedia(undefined,'https://live.yanhekt.cn/test.m3u8');
 assert.equal(api.sign('https://clive14.yanhekt.cn/legacy-live/test.m3u8'),'https://clive14.yanhekt.cn/legacy-live/test.m3u8');
});
test('each switch resolves the matching live time and rejects ambiguous or future sessions',()=>{
 const start=liveTimestamp('2026-10-28 13:20:00'),current={id:'live:1',mode:'live',start},next={id:'live:2',mode:'upcoming',start:start+86400000};
 assert.equal(matchingLive([next,current],start/1000).id,'live:1');
 assert.throws(()=>matchingLive([next],start),/没有/);
 assert.throws(()=>matchingLive([current,{...current,id:'live:3'}],start),/多个/);
 assert.throws(()=>matchingLive([current],start+86400000),/没有/);
 assert.deepEqual(cleanLinks([{modern:'102154',legacy:73687,token:'never-save',url:'https://example.invalid'}, {modern:'https://example.invalid',legacy:'12'}]),[{modern:'102154',legacy:'73687'}]);
});

const liveStart=liveTimestamp('2026-11-06 15:15:00'),liveEnd=liveTimestamp('2026-11-06 17:40:00');
const channel='c429042f8aa8be3ff53049224cca17db',otherChannel='4af469d02e7e1fbcef3281092b76c57f';
const liveContext=()=>({course:{id:'102198',title:'强化学习',teacher:'礼欣',term:'2026-2027-1'},lecture:{id:'1673150',start:liveStart},
 info:{mode:'live',start:liveStart/1000,end:liveEnd/1000,streams:{classroom:`https://aita.yanhekt.cn/live/${channel}.m3u8?host=yanhe9&port=83&t=fixture`}}});
const livePeer=()=>({id:'73698',liveId:'799953',legacy:true,title:'强化学习',teacher:'礼欣',term:'2026-2027-1',
 info:{mode:'live',start:liveStart,end:liveEnd,streams:{classroom:`https://clive9.yanhekt.cn//live/${channel}.flv`}}});

test('matching uses the same live channel across gateways, formats and signatures',()=>{
 const context=liveContext(),peer=livePeer();
 assert.deepEqual([...liveStreamIds(peer.info.streams)],[channel]);
 assert.deepEqual(matchingLivePeers(context,[peer]).map(row=>[row.id,row.liveId,row.match]),[['73698','799953','stream']]);
 const wrongChannel={...peer,id:'70001',info:{...peer.info,streams:{classroom:`https://clive9.yanhekt.cn/live/${otherChannel}.m3u8`}}};
 assert.deepEqual(matchingLivePeers(context,[wrongChannel]),[]);
 assert.equal(matchingLivePeers(context,[wrongChannel,peer]).length,1);
 assert.equal(matchingLivePeers(context,[peer,{...peer,id:'73699',liveId:'799954'}]).length,2);
 assert.deepEqual([...liveStreamIds({classroom:`https://example.invalid/live/${channel}.m3u8`,screen:'https://aita.yanhekt.cn/play/'+channel+'.m3u8'})],[]);
});

test('a reused channel still requires matching course metadata and the current lesson time',()=>{
 const context=liveContext(),peer=livePeer();
 for(const changed of [{title:'另一门课'},{teacher:'另一位教师'},{term:'2025-2026-1'},{info:{...peer.info,start:liveStart+86400000}},{info:{...peer.info,mode:'ended'}}]){
  assert.deepEqual(matchingLivePeers(context,[{...peer,...changed}]),[]);
 }
 context.info.start=0;assert.equal(matchingLivePeers(context,[peer]).length,1);
});

test('schedule fallback requires known teachers and time, and uses the Beijing calendar day',()=>{
 const context=liveContext(),peer=livePeer();delete peer.info.streams;
 assert.equal(matchingLivePeers(context,[peer])[0].match,'schedule');
 assert.deepEqual(matchingLivePeers(context,[{...peer,teacher:''}]),[]);
 assert.deepEqual(matchingLivePeers(context,[{...peer,info:{...peer.info,start:0}}]),[]);
 assert.deepEqual(matchingLivePeers(context,[{...peer,info:{...peer.info,end:liveEnd+3600000}}]),[]);
 assert.equal(liveDay('2026-11-05T17:00:00Z'),'2026-11-06');
});

test('modern discovery reads only the authenticated student daily live schedule',async()=>{
 const api=new YanheApi(),params=[];api.authenticate=async()=>{};
 const row={course_id:'102198',sub_id:'1673150',title:'强化学习',realname:'礼欣',term_name:'2026-2027-1',sub_type:'course_live',sub_status:'1',course_begin:String(liveStart/1000),course_over:String(liveEnd/1000)};
 api.json=async(path,query)=>{params.push([path,query]);return {list:{morning:{course:[]},afternoon:{course:[row,row,{...row,sub_id:'2',sub_status:'3'},{...row,sub_id:'3',sub_type:'course_video'},{...row,course_id:'invalid'}]}}};};
 const rows=await api.currentLives('2026-11-06');
 assert.deepEqual(params,[['/courseapi/v2/course-live/get-my-course-day',{day:'2026-11-06'}]]);
 assert.equal(rows.length,1);assert.equal(rows[0].subId,'1673150');assert.equal(rows[0].teacher,'礼欣');
});

test('legacy account discovery preserves live IDs and follows server pagination',async()=>{
 const api=new LegacyYanheApi(),pages=[];api.authenticate=async()=>{};
 api.json=async(path,query)=>{
  assert.equal(path,'/v2/live/list');assert.equal(query.user_relationship_type,1);assert.equal(query.source_id,undefined);pages.push(query.page);
  return {data:{last_page:2,data:[{id:799952+query.page,source_id:73698,status:1,title:'强化学习',course:{name_zh:'强化学习',professors:[{name:'礼欣'}]},
   schedule_started_at:'2026-11-06 15:15:00',schedule_ended_at:'2026-11-06 17:40:00',target:`https://clive9.yanhekt.cn//live/${channel}.m3u8`}]}};
 };
 const rows=await api.currentLives('2026-11-06');assert.deepEqual(pages,[1,2]);assert.deepEqual(rows.map(row=>row.liveId),['799953','799954']);
 assert.equal(rows[0].id,'73698');assert.equal(rows[0].info.end,liveEnd);assert.equal(matchingLivePeers(liveContext(),rows).length,2);
});

test('reverse discovery verifies modern streams and preserves failed candidates as ambiguous',async()=>{
 const old=livePeer(),context={course:old,lecture:{id:'live:'+old.liveId,start:liveStart},info:old.info};
 const modern={...liveContext().course,subId:'1673150',legacy:false,info:{mode:'live',start:liveStart,end:liveEnd}};
 const calls=[],api={currentLives:async day=>{assert.equal(day,'2026-11-06');return [modern,{...modern,id:'102199',subId:'1673151'}];},
  lecture:async(id,subId)=>{calls.push([id,subId]);if(id==='102199')throw new Error('fixture timeout');return liveContext().info;}};
 const rows=await accountLiveCandidates(context,api);assert.equal(rows.length,2);assert.equal(rows[0].match,'stream');assert.equal(rows[1].unverified,true);
 assert.deepEqual(calls,[['102198','1673150'],['102199','1673151']]);
});

test('cancelled discovery cannot return another lesson candidate',async()=>{
 const controller=new AbortController(),api={currentLives:async()=>{controller.abort();return [livePeer()];}};
 await assert.rejects(accountLiveCandidates(liveContext(),api,controller.signal),{name:'AbortError'});
});

test('a mismatched modern detail response cannot supply a live switch target',async()=>{
 const api=new YanheApi();api.authenticate=async()=>{};api.json=async()=>({data:{course_id:'102199',sub_id:'1673150',sub_type:'course_live',sub_status:'1'}});
 await assert.rejects(api.lecture('102198','1673150'),/所属课次不一致/);
});
