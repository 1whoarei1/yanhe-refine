import test from 'node:test';
import assert from 'node:assert/strict';
import {readPool} from '../src/read-pool.js';
import {SharedReads} from '../src/shared-reads.js';
import {CourseworkCache} from '../src/coursework-cache.js';
import {ReadRequests,cancellableRead} from '../src/read-requests.js';
import {LmsClient} from '../src/lms-client.js';
import {RemoteLms} from '../src/remote-client.js';
import {LexueReader} from '../src/lexue-reader.js';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(r=>setTimeout(r,0));

test('cancelling a scan aborts its active courses and never starts the rest of the queue',async()=>{
 const controller=new AbortController(),started=[],aborted=[];let progress=0;
 const read=readPool([1,2,3,4,5],2,id=>new Promise((resolve,reject)=>{
  started.push(id);controller.signal.addEventListener('abort',()=>{aborted.push(id);reject(controller.signal.reason);},{once:true});
 }),{signal:controller.signal,onDone:()=>progress++});
 controller.abort();await assert.rejects(read,{name:'AbortError'});assert.deepEqual(started,[1,2]);assert.deepEqual(aborted,[1,2]);assert.equal(progress,0);
});

test('one cancelled consumer cannot stop a read still needed by another page',async()=>{
 const reads=new SharedReads(),a=new AbortController(),b=new AbortController(),done=deferred();let signal,calls=0;
 const load=inner=>{calls++;signal=inner;return done.promise;};
 const first=reads.read('course',load,{signal:a.signal}),second=reads.read('course',load,{signal:b.signal});await tick();
 a.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(signal.aborted,false);done.resolve('shared result');assert.equal(await second,'shared result');assert.equal(calls,1);
});

test('a cancelled result cannot enter the coursework cache, and a later scan can restart immediately',async()=>{
 const cache=new CourseworkCache(),controller=new AbortController(),done=deferred(),course={source:'lms',id:'401',title:'课程'};let oldSignal;
 const cancelled=cache.read(course,signal=>{oldSignal=signal;return done.promise;},false,{signal:controller.signal});await tick();controller.abort();await assert.rejects(cancelled,{name:'AbortError'});assert.equal(oldSignal.aborted,true);
 const fresh=await cache.read(course,async()=>[{id:'2',courseId:'401',title:'新结果'}]);done.resolve([{id:'1',courseId:'401',title:'取消后的旧结果'}]);await tick();
 assert.equal(fresh[0].id,'2');assert.equal(cache.rows.get('lms:401')[0].id,'2');
});

test('cancelling the last native-reader consumer sends cancel without a fallback or a bad-tab penalty',async()=>{
 const original=globalThis.chrome,controller=new AbortController(),ready=deferred(),calls=[];
 try{
  globalThis.chrome={tabs:{query:async()=>[{id:1}],sendMessage:async(id,message)=>{calls.push(message);if(message.type==='DESK_READER_PING')return {version:1,kind:'lms'};if(message.type==='DESK_READER_CANCEL')return {ok:true};ready.resolve();return new Promise(()=>{});}}};
  const client=new LmsClient();client.fallback.read=()=>{throw Error('must not fall back');};
  const read=client.materials('401',{signal:controller.signal});await ready.promise;controller.abort();await assert.rejects(read,{name:'AbortError'});await tick();
  assert.equal(calls.filter(m=>m.type==='DESK_READER_CANCEL').length,1);assert.equal(client.badTabs.size,0);
 }finally{globalThis.chrome=original;}
});

test('background readers share a request until the last page cancels, then abort the fetch',async()=>{
 const original=globalThis.chrome,a=new AbortController(),b=new AbortController(),ready=deferred();let calls=0,aborted=false;
 try{
  globalThis.chrome={tabs:{query:async()=>[]}};const client=new LmsClient();
  client.fallback.read=({signal})=>{calls++;ready.resolve();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason);},{once:true}));};
  const first=client.materials('401',{signal:a.signal}),second=client.materials('401',{signal:b.signal});await ready.promise;
  a.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(aborted,false);b.abort();await assert.rejects(second,{name:'AbortError'});await tick();assert.equal(aborted,true);assert.equal(calls,1);
 }finally{globalThis.chrome=original;}
});

test('cancellation IDs are private to their sending document and are released on completion',async()=>{
 const reads=new ReadRequests(),sender={id:'extension',documentId:'A',tab:{id:1},frameId:0},id='request-1234567890',done=deferred();let signal;
 const read=reads.run(sender,id,inner=>{signal=inner;return done.promise;});
 reads.cancel({...sender,documentId:'B'},id);assert.equal(signal.aborted,false);reads.cancelTab(2);assert.equal(signal.aborted,false);reads.cancel(sender,id);assert.equal(signal.aborted,true);
 done.resolve();await assert.rejects(read,{name:'AbortError'});assert.equal(reads.reads.size,0);
 assert.equal(cancellableRead('lms',{method:'homeworks'}),true);assert.equal(cancellableRead('modern',{method:'materials'}),true);
 for(const operation of ['lmsWrite','download','cancelDownload','connection'])assert.equal(cancellableRead(operation,{method:'submit'}),false);
});

test('the page sends a cancel ID rather than a serialized signal or any write operation',async()=>{
 const original=globalThis.chrome,controller=new AbortController(),calls=[];
 try{
  globalThis.chrome={runtime:{sendMessage:async message=>{calls.push(message);if(message.type==='REFINE_CANCEL')return {ok:true};return new Promise(()=>{});}}};
  const read=new RemoteLms().homeworks('401',{signal:controller.signal});controller.abort();await assert.rejects(read,{name:'AbortError'});
  assert.equal(calls.length,2);assert.equal(calls[1].type,'REFINE_CANCEL');assert.equal(calls[0].requestId,calls[1].requestId);assert.deepEqual(calls[0].args,{method:'homeworks',args:['401']});
 }finally{globalThis.chrome=original;}
});

test('cancelling new-LMS pagination prevents a second page request',async()=>{
 const client=new LmsClient(),controller=new AbortController();let pages=0;
 client.read=async()=>{pages++;controller.abort();return {rows:[],pages:5};};
 await assert.rejects(client.homeworks('401',{signal:controller.signal}),{name:'AbortError'});assert.equal(pages,1);
});

test('Moodle section discovery survives cancellation of a different consumer of the same course',async()=>{
 const a=new AbortController(),b=new AbortController(),done=deferred();let signal,calls=0;
 const reader=new LexueReader({fetch:async(url,options)=>{calls++;signal=options.signal;await done.promise;const response=new Response('<body class="course-401"><main id="region-main"><li class="activity" id="module-501"><a href="/mod/assign/view.php?id=501">作业</a></li></main></body>',{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:url});return response;}});
 reader.courseCache={time:Date.now(),rows:[{id:'401'}]};
 const first=reader.course('401',a.signal),second=reader.course('401',b.signal);await tick();a.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(signal.aborted,false);done.resolve();assert.equal((await second)[0].id,'501');assert.equal(calls,1);
});
