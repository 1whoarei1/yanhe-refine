import test from 'node:test';
import assert from 'node:assert/strict';
import {LmsClient} from '../src/lms-client.js';
import {LexueClient} from '../src/lexue-client.js';
import {LmsReader} from '../src/lms-reader.js';
import {TeachingCourses} from '../src/teaching-courses.js';
import {attachmentJob} from '../src/attachment-job.js';
import {AttachmentDownloads} from '../src/downloads.js';
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:(...args)=>resolve(...args)};};

test('slow native reads are coalesced and never launched in a second tab or background',async()=>{
 const before=globalThis.chrome,read=deferred(),calls=[];
 try{
  globalThis.chrome={tabs:{query:async()=>[{id:1},{id:2},{id:3}],sendMessage:async(id,message)=>{calls.push(message.type);return message.type==='DESK_READER_PING'?{version:1,kind:'lms'}:read.promise;}}};
  const client=new LmsClient({tabTimeout:5,readTimeout:1000});client.fallback.read=()=>{throw Error('duplicate');};
  const a=client.courses(),b=client.courses();await new Promise(r=>setTimeout(r,20));assert.deepEqual(calls,['DESK_READER_PING','DESK_LMS_READ']);
  read.resolve({ok:true,data:{rows:[{id:'1',term:'2026-2027-1'}]}});assert.deepEqual(await a,await b);
 }finally{globalThis.chrome=before;}
});
test('a frozen old tab only receives a probe; background fallback finishes without waiting forever',async()=>{
 const before=globalThis.chrome,calls=[];
 try{globalThis.chrome={tabs:{query:async()=>[{id:1}],sendMessage:async(id,message)=>{calls.push(message.type);return new Promise(()=>{});}}};
  const client=new LexueClient({tabTimeout:5});client.fallback.read=async()=>({rows:[{id:'2'}]});assert.equal((await client.courses())[0].id,'2');assert.deepEqual(calls,['DESK_READER_PING']);
 }finally{globalThis.chrome=before;}
});
test('an active tab read is cancelled on deadline without a second full read',async()=>{
 const before=globalThis.chrome,calls=[];
 try{globalThis.chrome={tabs:{query:async()=>[{id:1},{id:2}],sendMessage:async(id,message)=>{calls.push(message.type);return message.type==='DESK_READER_PING'?{version:1,kind:'lexue'}:message.type==='DESK_READER_CANCEL'?{ok:true}:new Promise(()=>{});}}};
  const client=new LexueClient({readTimeout:10});client.fallback.read=()=>{throw Error('duplicate');};await assert.rejects(client.courses(),/旧乐学读取超时/);assert.deepEqual(calls,['DESK_READER_PING','DESK_LEXUE_READ','DESK_READER_CANCEL']);
 }finally{globalThis.chrome=before;}
});
test('background deadline aborts the actual fetch and a later read can recover',async()=>{
 const before=globalThis.chrome;let aborted=false;
 try{globalThis.chrome={tabs:{query:async()=>[]}};const client=new LmsClient({readTimeout:10});
  client.fallback=new LmsReader(async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{aborted=true;reject(options.signal.reason);},{once:true})));
  await assert.rejects(client.courses(),/读取超时/);assert.equal(aborted,true);
  client.fallback.read=async()=>({rows:[]});assert.deepEqual(await client.courses(),[]);
 }finally{globalThis.chrome=before;}
});
test('healthy platform publishes courses before a slow peer finishes, whose timeout can be retried',async()=>{
 const updates=[],old=deferred();const cache=new TeachingCourses({timeout:25,lms:{courses:async()=>[{id:'1'}]},lexue:{courses:()=>old.promise}});
 const load=cache.load({onUpdate:data=>updates.push(data)});await new Promise(r=>setTimeout(r,5));assert.ok(updates.some(data=>data.rows.length===1&&data.loading[1]));
 const result=await load;assert.deepEqual(result.status,[true,false]);cache.clients.lexue.courses=async()=>[{id:'2'}];assert.equal((await cache.load({source:'lexue',force:true})).rows.length,2);
 old.resolve([{id:'stale'}]);await Promise.resolve();assert.equal(cache.snapshot().rows.some(row=>row.id==='stale'),false);
});
test('stop requested while obtaining a download ID cancels that file as soon as it starts',async()=>{
 const controller=new AbortController(),start=deferred(),cancelled=[];const job=attachmentJob({start:()=>start.promise,status:()=>{throw Error('must cancel first');},cancel:async id=>cancelled.push(id)},controller.signal);
 controller.abort();start.resolve({id:7});await assert.rejects(job,{name:'AbortError'});assert.deepEqual(cancelled,[7]);
});
test('stop cancels an active attachment and a cancellation failure is not reported as success',async()=>{
 for(const fail of [false,true]){const controller=new AbortController(),wait=deferred(),cancelled=[];
  const job=attachmentJob({start:async()=>({id:8}),status:async()=>{controller.abort();return [{state:'in_progress'}];},cancel:async id=>{cancelled.push(id);if(fail)throw Error('cancel failed');},wait:()=>wait.promise},controller.signal);
  await assert.rejects(job,fail?/cancel failed/:{name:'AbortError'});assert.deepEqual(cancelled,[8]);
 }
});
test('cancelling downloads retains ownership checks after a worker restart',async()=>{
 const data={},session={set:async values=>Object.assign(data,values),get:async key=>({[key]:data[key]})},cancelled=[];
 const api={download:async()=>9,search:async()=>[{state:'in_progress'}],cancel:async id=>cancelled.push(id)};
 await new AttachmentDownloads(api,session).start('https://lexue.bit.edu.cn/file','file','course');const restarted=new AttachmentDownloads(api,session);
 await restarted.cancel(9);await assert.rejects(restarted.cancel(10),/不是本次/);assert.deepEqual(cancelled,[9]);
});
