import test from 'node:test';
import assert from 'node:assert/strict';
import {sameCourse,matchingLive,liveTimestamp,cleanLinks} from '../src/watch/live-links.js';
import {LegacyYanheApi} from '../src/watch/legacy-api.js';
import {legacyLive} from '../src/watch/legacy-core.js';
test('course correspondence uses title, teacher and term, never equal numeric IDs',()=>{
 const modern={id:'102154',title:'计算机新技术专题',teacher:'黄河燕',term:'2026-2027-1'};
 assert.equal(sameCourse(modern,{id:73687,name:'计算机新技术专题',teachers:['黄河燕'],term:'2026–2027学年第一学期'}),true);
 assert.equal(sameCourse(modern,{id:'102154',name:'另一门课',teachers:['黄河燕'],term:modern.term}),false);
 assert.equal(sameCourse(modern,{name:modern.title,teacher:'另一位教师',term:modern.term}),false);
 assert.equal(sameCourse(modern,{name:modern.title,teacher:modern.teacher,term:'2025-2026-1'}),false);
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
