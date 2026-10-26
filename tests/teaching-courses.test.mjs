import test from 'node:test';
import assert from 'node:assert/strict';
import {TeachingCourses} from '../src/teaching-courses.js';

test('a failed old-LMS login never becomes a permanently cached new-only course list',async()=>{
 let connected=false,newReads=0,oldReads=0,clock=1000;
 const cache=new TeachingCourses({now:()=>clock,lms:{courses:async()=>{newReads++;return [{id:'401',title:'New'}];}},lexue:{courses:async()=>{oldReads++;if(!connected)throw new Error('请登录旧乐学');return [{id:'401',title:'Old'}];}}});
 let result=await cache.load();assert.deepEqual(result.status,[true,false]);assert.equal(result.rows.length,1);
 connected=true;await cache.load();assert.equal(oldReads,1);
 clock+=5001;result=await cache.load();assert.deepEqual(result.status,[true,true]);assert.deepEqual(result.rows.map(r=>r.source),['lms','lexue']);assert.equal(newReads,1);assert.equal(oldReads,2);
});
test('explicit reconnection refreshes only the chosen site and immediately recovers its options',async()=>{
 let connected=false,newReads=0,oldReads=0;
 const cache=new TeachingCourses({lms:{courses:async()=>{newReads++;return [{id:'401'}];}},lexue:{courses:async force=>{oldReads++;if(!connected)throw new Error('login');assert.equal(force,true);return [{id:'401'}];}}});
 await cache.load();connected=true;const result=await cache.load({source:'lexue',force:true});assert.deepEqual(result.status,[true,true]);assert.equal(result.errors[1],null);assert.equal(newReads,1);assert.equal(oldReads,2);
});
test('concurrent views share in-flight reads, but an expired login discards the old course list',async()=>{
 let finish,reads=0,connected=true;
 const wait=new Promise(resolve=>finish=resolve);
 const cache=new TeachingCourses({lms:{courses:async()=>[]},lexue:{courses:async()=>{reads++;await wait;if(!connected)throw new Error('expired');return [{id:'401'}];}}});
 const first=cache.load(),second=cache.load();finish();await Promise.all([first,second]);assert.equal(reads,1);connected=false;const result=await cache.load({source:'lexue',force:true});assert.deepEqual(result.rows,[]);assert.deepEqual(result.status,[true,false]);
});
