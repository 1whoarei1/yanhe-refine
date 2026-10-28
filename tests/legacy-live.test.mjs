import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyLive,legacyLiveSignedUrl} from '../src/watch/legacy-core.js';
import {LegacyYanheApi} from '../src/watch/legacy-api.js';
const now=Date.parse('2026-10-23T08:30:00Z');
const base={id:788579,course_id:71988,status:1,title:'旧版直播',schedule_started_at:'2026-10-23 16:00:00',schedule_ended_at:'2026-10-23 17:00:00',target:'https://live.yanhekt.cn/classroom.m3u8',target_vga:'https://live.yanhekt.cn/screen.flv'};
test('legacy live uses the official target channels and does not sign live CDN URLs with recording credentials',()=>{
 const info=legacyLive(base,now);assert.equal(info.mode,'live');assert.equal(info.candidates.screen[0].format,'flv');assert.equal(info.streams.classroom,base.target);
 assert.equal(legacyLiveSignedUrl(base.target,null,()=>{throw Error('must not sign');}),base.target);
 assert.throws(()=>legacyLiveSignedUrl('https://untrusted.example/live.m3u8',null,()=>''));
 assert.deepEqual(legacyLive({...base,target:'https://evil.example/live.m3u8',target_vga:null},now).streams,{});
});
test('timetable inference applies to scheduled entries while explicit live and ended statuses win',()=>{
 assert.equal(legacyLive({...base,status:2},now-3600000).mode,'upcoming');assert.deepEqual(legacyLive({...base,status:2},now-3600000).streams,{});
 assert.equal(legacyLive({...base,status:2},now).mode,'live');assert.equal(legacyLive({...base,status:3},now).mode,'ended');assert.equal(legacyLive(base,now+3600000).mode,'live');assert.equal(legacyLive({...base,status:2},now+3600000).mode,'ended');
});
test('live references retain the live identity separately from course and recording session IDs',async()=>{
 const api=new LegacyYanheApi();api.authenticate=async()=>{};api.json=async()=>({data:{...base,course:{id:71988,name_zh:'课程'},session_id:920536,session:{id:920536,course_id:71988}}});
 const ref=await api.resolve({legacy:true,liveId:'788579'});assert.equal(ref.id,'71988');assert.equal(ref.liveId,'788579');assert.equal(ref.sessionId,'920536');
 const course=await api.liveCourse(ref);assert.equal(course.lives[0].id,'live:788579');assert.equal(course.replays.length,0);
 await assert.rejects(api.lecture('123','live:788579'),/不一致/);
});
