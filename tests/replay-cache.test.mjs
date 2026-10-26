import test from 'node:test';
import assert from 'node:assert/strict';
import {ReplayCache} from '../src/watch/replay-cache.js';
const course={id:'9910',title:'课程',teacher:'教师',term:'2026-2027-1',replays:[{id:'10',title:'第十讲',start:1,video:{url:'https://example.invalid?token=secret'}}],lives:[],token:'secret',streams:{screen:'https://example.invalid?token=secret'}};
function storage(){const data={};return {data,get:async key=>key===null?{...data}:{[key]:data[key]},set:async x=>Object.assign(data,x),remove:async keys=>{for(const key of Array.isArray(keys)?keys:[keys])delete data[key];}};}
test('returning player instances reuse account-scoped replay lists, but forced refresh and expiry load the server',async()=>{
 const session=storage();let now=1,calls=0;const load=async()=>{calls++;return course;};
 const a=new ReplayCache(session,()=>now),b=new ReplayCache(session,()=>now);
 await a.read('modern','9910','account1',load);await b.read('modern','9910','account1',load);assert.equal(calls,1);
 await b.read('modern','9910','account1',load,{force:true});assert.equal(calls,2);
 await b.read('modern','9910','account2',load);assert.equal(calls,3);
 await b.read('legacy','9910','account1',load);assert.equal(calls,4);
 now+=10*60*1000+1;await b.read('modern','9910','account1',load);assert.equal(calls,5);
 assert.ok(!JSON.stringify(session.data).includes('secret'));assert.ok(!JSON.stringify(session.data).includes('account1'));
});
test('live listings expire quickly and unsuccessful forced refresh does not revive old entries',async()=>{
 const session=storage();let now=2,calls=0;const cache=new ReplayCache(session,()=>now),load=async()=>{calls++;return {...course,lives:[{id:'20',title:'直播',mode:'live'}]};};
 await cache.read('modern','9911','account3',load);now+=21000;await cache.read('modern','9911','account3',load);assert.equal(calls,2);
 await assert.rejects(cache.read('modern','9911','account3',async()=>{throw new Error('403');},{force:true}),/403/);
 await cache.read('modern','9911','account3',load);assert.equal(calls,3);
});
