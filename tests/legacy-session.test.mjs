import test from 'node:test';
import assert from 'node:assert/strict';
import {LegacyYanheApi} from '../src/watch/legacy-api.js';
import {parseCourse} from '../src/watch/core.js';
import {normalizeCourse} from '../src/catalog-core.js';

// Public metadata checked on 2026-10-27; no login or media URLs are retained.
const sessions={71990:{id:71990,course_id:9397,title:'第9周 星期三 第3小节',course:{id:9397,name_zh:'离散数学Ⅱ'}},281490:{id:281490,course_id:30226,title:'8.3特征工程',course:{id:30226,name_zh:'机器学习实践'}}};
test('legacy session IDs resolve the actual parent course rather than a same-numbered course',async()=>{
 const requests=[];
 const api=new LegacyYanheApi({fetcher:async raw=>{const u=new URL(raw);requests.push(u);return new Response(JSON.stringify({code:0,data:sessions[u.searchParams.get('session_id')]}),{headers:{'content-type':'application/json'}});},hash:()=>''});
 api.profile={id:1};api.authAt=Date.now();
 assert.deepEqual(parseCourse('https://www.yanhekt.cn/course/71990'),{legacy:true,id:'71990'});
 for(const [sessionId,courseId] of [['71990','9397'],['281490','30226']]){
  const ref=await api.resolve(parseCourse('https://www.yanhekt.cn/session/'+sessionId));
  assert.equal(ref.sessionId,sessionId);assert.equal(ref.id,courseId);assert.equal(ref.legacy,true);
 }
 assert.deepEqual(requests.map(u=>u.pathname),['/v1/course/session','/v1/course/session']);
 assert.deepEqual(requests.map(u=>u.searchParams.get('session_id')),['71990','281490']);
});
test('a session URL cannot be silently imported as a course with the same numeric ID',()=>{
 assert.equal(normalizeCourse({id:71990,title:'离散数学Ⅱ',url:'https://www.yanhekt.cn/session/71990'}),null);
 assert.equal(normalizeCourse({id:9397,title:'离散数学Ⅱ',url:'https://www.yanhekt.cn/course/71990'}),null);
 assert.equal(normalizeCourse({id:9397,title:'离散数学Ⅱ',url:'https://www.yanhekt.cn/course/9397'}).id,'9397');
});
