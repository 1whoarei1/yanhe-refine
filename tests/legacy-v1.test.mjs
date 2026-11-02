import test from 'node:test';
import assert from 'node:assert/strict';
import md5 from 'blueimp-md5';
import {LegacyYanheApi} from '../src/watch/legacy-api.js';

const json=(data,code=0)=>new Response(JSON.stringify({code,data}),{headers:{'content-type':'application/json'}});
const part=(id=301)=>({id,main:`https://cvideo.yanhekt.cn/${id}/main.m3u8`,vga:`https://cvideo.yanhekt.cn/${id}/screen.m3u8`,duration:600});
const session=(id=71990,videos=[part()])=>({id,course_id:9397,number:'20202021210007100203',title:'集合',started_at:'2026-09-07 08:00:00',videos});
let user=800000;
function fixture({list=()=>[session()],local=true,metadataStatus=12121028}={}){
 const state={user:++user},calls=[];
 const index={course:async id=>local?{id,name:'离散数学Ⅱ',teachers:['教师'],term:'2020-2021-2',number:'20202021210007100203'}:null,owner:async sid=>local&&['71990','72000'].includes(String(sid))?{id:'9397'}:null,sessions:async()=>['71990','72000']};
 const api=new LegacyYanheApi({hash:md5,index,fetcher:async(raw,options)=>{
  const url=new URL(raw);calls.push(url);
  assert.equal(options.cache,'no-store');
  if(url.pathname==='/v1/course/session/list')return list(Number(url.searchParams.get('page')),url);
  if(url.pathname==='/v1/course')return json({id:9397,name_zh:'官方课程'},metadataStatus);
  if(url.pathname==='/v2/live/list')return json({data:[]});
  throw new Error('Blocked endpoint must not be used: '+url.pathname);
 }});
 const response=api.fetcher;api.fetcher=async(...args)=>{const result=await response(...args);return result instanceof Response?result:json(result);};
 api.authenticate=async()=>{api.profile={id:state.user};api.token='fixture';};
 return {api,calls,state};
}

test('expired metadata is unnecessary: v1 pages, embedded parts and local session ownership provide the recording',async()=>{
 const batch=Array.from({length:100},(_,i)=>session(71990+i,i===0?[part(301),part(302)]:[part(400+i)]));
 const {api,calls}=fixture({list:page=>({data:page===1?batch:[session(73000,[part(900)])],last_page:2,total:101})});
 const resolved=await api.resolve({legacy:true,sessionId:'71990'});assert.equal(resolved.id,'9397');assert.equal(calls.length,0);
 const course=await api.course('9397',undefined,{force:true});assert.equal(course.title,'离散数学Ⅱ');assert.equal(course.replays.length,102);
 const info=await api.lecture('9397','71990:302');assert.equal(info.selection.id,'71990:302');assert.equal(info.streams.screen,part(302).vga);assert.equal(info.selection.start,Date.parse('2026-09-07T08:00:00+08:00'));
 assert.deepEqual(info.sessionReplays.map(r=>r.id),['71990:301','71990:302']);assert.ok(!JSON.stringify(course).includes('cvideo'));
 assert.deepEqual(calls.filter(u=>u.pathname.includes('/session/list')).map(u=>u.searchParams.get('page')),['1','2']);
 assert.ok(!calls.some(u=>['/v1/course','/v2/course/session/list','/v1/course/session','/v1/video'].includes(u.pathname)));
});

test('a course URL can play without an imported catalog when optional course metadata is expired',async()=>{
 const {api}=fixture({local:false});const course=await api.course('9397',undefined,{force:true});
 assert.equal(course.title,'旧版课程 9397');assert.equal(course.term,'2020-2021-2');assert.equal((await api.lecture('9397','71990:pending')).selection.id,'71990:301');
});

test('a failed later page is never committed as a partial or empty course and retries start with page one',async()=>{
 let fail=true;const batch=Array.from({length:100},(_,i)=>session(71990+i,[part(400+i)]));
 const {api,calls}=fixture({list:page=>page===1?batch:fail?new Response('',{status:503}):[session(73000)]});
 await assert.rejects(api.course('9397',undefined,{force:true}),/503/);assert.equal(api.sessionLists.size,0);
 fail=false;const result=await api.course('9397');assert.equal(result.replays.length,101);
 assert.deepEqual(calls.filter(u=>u.pathname.endsWith('/session/list')).map(u=>u.searchParams.get('page')),['1','2','1','2']);
});

test('wrong parent courses and repeated pagination do not produce playable rows',async()=>{
 const wrong=fixture({list:()=>[{...session(),course_id:71990}]});await assert.rejects(wrong.api.course('9397',undefined,{force:true}),/不一致/);
 const batch=Array.from({length:100},(_,i)=>session(71990+i,[part(400+i)]));
 const repeated=fixture({list:()=>batch});await assert.rejects(repeated.api.course('9397',undefined,{force:true}),/分页重复/);assert.equal(repeated.api.sessionLists.size,0);
});

test('forced refresh and account changes refresh embedded URLs and cannot resurrect removed video parts',async()=>{
 let video=301;const {api,calls,state}=fixture({list:()=>[session(71990,[part(video)])]});
 await api.course('9397',undefined,{force:true});assert.equal((await api.lecture('9397','71990:301')).selection.id,'71990:301');
 video=302;await api.course('9397',undefined,{force:true});await assert.rejects(api.lecture('9397','71990:301'),/不属于/);assert.equal((await api.lecture('9397','71990:pending')).selection.id,'71990:302');
 const before=calls.length;state.user++;await api.lecture('9397','71990:302');assert.ok(calls.length>before);
});

test('missing embedded recordings stay unavailable rather than falling back to blocked video lookups',async()=>{
 const {api,calls}=fixture({list:()=>[{...session(71990,[]),video_ids:[301]}]});
 const course=await api.course('9397',undefined,{force:true,indexed:true});assert.deepEqual(course.replays.map(r=>r.id),['71990:pending','72000:pending']);
 await assert.rejects(api.lecture('9397','71990:pending'),/暂未提供/);assert.ok(!calls.some(u=>u.pathname==='/v1/video'));
});

test('old v2 replay caches cannot mask the new v1 list',async()=>{
 const {api}=fixture();await api.authenticate();await api.replayCache.read('legacy','9397',String(api.profile.id),async()=>({id:'9397',title:'旧缓存',replays:[]}),{force:true});
 const course=await api.course('9397');assert.equal(course.title,'离散数学Ⅱ');assert.equal(course.replays[0].id,'71990:301');
});
