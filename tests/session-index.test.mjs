import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionIndex} from '../src/watch/session-index.js';
import {AutoSlidesIndex} from '../src/watch/autoslides-index.js';
const url='chrome-extension://fixture/legacy-session-index.json';
const snapshot=()=>({format:'yanhekt-session-index/v1',source:{kind:'self-collected'},generatedAt:'2026-10-28T04:32:51Z',partial:true,courses:[{id:9397,name:'离散数学Ⅱ',term:'2020-2021-2',teachers:['何雨果'],number:'20202021210007100203',sessions:[71990,72000]},{id:71990,name:'另一门课程',term:'2026-2027-1',teachers:[],sessions:[916997]}]});
const response=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
const options=(data=snapshot())=>({snapshotUrl:url,fetcher:async()=>response(data)});
test('a failed snapshot read is retried instead of permanently caching the rejected promise',async()=>{let reads=0;const index=new SessionIndex({...options(),fetcher:async()=>++reads===1?new Response('',{status:500}):response(snapshot())});await assert.rejects(index.terms());assert.equal((await index.terms()).courseCount,2);assert.equal(reads,2);});
test('local snapshot retains early terms and noncontiguous session ownership with independent course ids',async()=>{
 const index=new AutoSlidesIndex(options());assert.deepEqual((await index.terms()).terms,['2026-2027-1','2020-2021-2']);
 assert.deepEqual(await index.sessions('9397'),['71990','72000']);assert.deepEqual(await index.sessions('71990'),['916997']);
 assert.equal((await index.search('何雨果',{term:'2020-2021-2'})).rows[0].id,'9397');
 assert.equal((await index.search('71990')).rows[0].id,'71990');
 await assert.rejects(index.sessions('72000'),/尚未收录/);
});
test('own snapshot supports every page beyond the upstream 200-result cap',async()=>{
 const data=snapshot();data.courses=Array.from({length:245},(_,i)=>({id:1000+i,name:'算法设计 '+i,term:'2025-2026-2',teachers:[],sessions:[800000+i]}));
 const index=new AutoSlidesIndex(options(data)),result=await index.search('算法',{page:6});
 assert.equal(result.total,245);assert.equal(result.rows.length,40);assert.equal(result.rows[0].id,'1200');assert.equal(result.truncated,false);
 assert.equal((await index.search('',{term:'2025-2026-2',page:7})).rows.length,5);
});
test('snapshot requests use the extension resource without credentials or upstream index requests',async()=>{
 const calls=[];const index=new AutoSlidesIndex({...options(),fetcher:async(raw,opts)=>{calls.push(raw);assert.equal(raw,url);assert.equal(opts.credentials,'omit');return response(snapshot());}});
 await Promise.all([index.terms(),index.search('离散'),index.sessions('9397')]);assert.deepEqual(calls,[url]);
 const sessions=await index.sessions('9397');sessions.push('999');assert.deepEqual(await index.sessions('9397'),['71990','72000']);
});
test('conflicting parent ownership or corrupt local data cannot silently turn into an empty catalogue',async()=>{
 const data=snapshot();data.courses[1].sessions.push(71990);await assert.rejects(new SessionIndex(options(data)).load(),/格式无效/);
 await assert.rejects(new SessionIndex({...options(),fetcher:async()=>new Response('{bad')}).load(),/格式无效/);
 const noName=snapshot();noName.courses[0].name='';assert.equal((await new SessionIndex(options(noName)).search('9397')).rows[0].title,'旧版课程 9397');
});
test('missing optional snapshot asks for an import; cancelled callers are not empty results',async()=>{
 const index=new AutoSlidesIndex({snapshotUrl:url,fetcher:async raw=>raw===url?new Response('',{status:404}):response({terms:['2023-2024-1']})});
 await assert.rejects(index.terms(),/导入旧版课次目录/);
 const controller=new AbortController();controller.abort();await assert.rejects(new SessionIndex(options()).load(controller.signal),{name:'AbortError'});
});
