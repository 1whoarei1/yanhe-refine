import test from 'node:test';
import assert from 'node:assert/strict';
import {LmsClient} from '../src/lms-client.js';

test('a frozen or failed LMS tab falls back and is skipped for subsequent reads',async()=>{
 const before=globalThis.chrome,attempts=[];
 try{
  globalThis.chrome={tabs:{query:async()=>[{id:1},{id:2}],sendMessage:id=>{attempts.push(id);return id===1?new Promise(()=>{}):Promise.resolve({ok:false,error:'expired page'});}}};
  const client=new LmsClient({tabTimeout:10});let fallback=0;
  client.fallback.read=async()=>{fallback++;return {rows:[{id:'401',term:'2026-2027-1'}]};};
  assert.equal((await client.courses())[0].id,'401');
  assert.equal((await client.courses())[0].id,'401');
  assert.deepEqual(attempts,[1,2]);assert.equal(fallback,2);
 }finally{globalThis.chrome=before;}
});

test('an LMS page error does not prevent another logged-in page from serving the request',async()=>{
 const before=globalThis.chrome;
 try{
  globalThis.chrome={tabs:{query:async()=>[{id:1},{id:2}],sendMessage:async (id,message)=>id===1?{ok:false,error:'old reader failed'}:message.type==='DESK_READER_PING'?{version:1,kind:'lms'}:{ok:true,data:{rows:[{id:'402',term:'2026-2027-1'}]}}}};
  const client=new LmsClient();client.fallback.read=async()=>{throw Error('fallback should not be needed');};
  assert.equal((await client.courses())[0].id,'402');assert.equal(client.tab,2);
 }finally{globalThis.chrome=before;}
});

test('a timed-out background request becomes a retryable read error rather than an endless loading state',async()=>{
 const before=globalThis.chrome;
 try{
  globalThis.chrome={tabs:{query:async()=>[]}};
  const client=new LmsClient();client.fallback.read=async()=>{throw new DOMException('deadline','TimeoutError');};
  await assert.rejects(()=>client.read({kind:'courses'}),/新乐学读取超时/);
 }finally{globalThis.chrome=before;}
});
