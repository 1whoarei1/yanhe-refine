import test from 'node:test';
import assert from 'node:assert/strict';
import {AutoSlidesIndex} from '../src/watch/autoslides-index.js';
import {sharedCatalog} from '../src/watch/catalog-client.js';

test('player catalog lookups return small shared results and preserve standalone fallback',async()=>{
 const original={chrome:globalThis.chrome,document:globalThis.document,fetch:globalThis.fetch};let response,calls=0;
 try{
  globalThis.document={};globalThis.chrome={runtime:{getURL:path=>'chrome-extension://fixture/'+path,sendMessage:async message=>{calls++;assert.equal(message.operation,'publicCatalog');return response;}}};
  globalThis.fetch=async()=>{throw Error('the player must not fetch a full catalog');};
  response={ok:true,value:{id:'401',name:'示例课程',teachers:[],sessions:['501','509']}};
  const index=new AutoSlidesIndex();assert.equal((await index.owner('509')).id,'401');assert.equal(index.snapshot.flight,null);assert.equal(calls,1);
  response={ok:false,error:'目录格式无效'};await assert.rejects(index.owner('509'),/目录格式无效/);assert.equal(index.snapshot.flight,null);
  const controller=new AbortController();controller.abort();const before=calls;await assert.rejects(sharedCatalog('terms',[],controller.signal),{name:'AbortError'});assert.equal(calls,before);
  response=undefined;let localReads=0;index.snapshot.fetcher=async()=>{localReads++;return new Response(JSON.stringify({format:'yanhekt-session-index/v1',partial:true,source:{kind:'self-collected'},courses:[{id:'401',name:'示例课程',teachers:[],sessions:['501','509']}]}));};
  assert.equal((await index.owner('509')).id,'401');assert.equal(localReads,1);
 }finally{globalThis.chrome=original.chrome;if(original.document===undefined)delete globalThis.document;else globalThis.document=original.document;globalThis.fetch=original.fetch;}
});
