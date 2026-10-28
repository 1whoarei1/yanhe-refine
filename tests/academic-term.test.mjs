import test from 'node:test';
import assert from 'node:assert/strict';
import {academicTerm,lmsCourses} from '../src/lms-core.js';
import {termLabel} from '../src/catalog-core.js';
import {TeachingCourses} from '../src/teaching-courses.js';
import {LmsClient} from '../src/lms-client.js';
import {safeBindings} from '../src/course-bindings.js';

test('structured academic years and semester names produce real terms without treating database IDs as semester numbers',()=>{
 assert.equal(academicTerm({id:42,name:'2026-2027'},{id:88,name:'第一学期'}),'2026-2027-1');
 assert.equal(academicTerm('2025-2026',2),'2025-2026-2');
 assert.equal(academicTerm({start_year:2024,end_year:2025},{label:'春季学期'}),'2024-2025-2');
 assert.equal(academicTerm('2026-2027-1',null),'2026-2027-1');
 assert.equal(academicTerm({id:4},{id:1}),'');assert.equal(academicTerm('2026-2027',{id:2}),'');
 const rows=lmsCourses({courses:[{id:401,name:'数据课程',academic_year:{name:'2026-2027'},semester:{name:'第一学期'},department:{name:'计算机学院'}},{id:402,name:'缺少学期信息',academic_year:{id:4},semester:{id:1}}]});
 assert.deepEqual(rows.map(row=>row.term),['2026-2027-1','']);assert.equal(rows[0].department,'计算机学院');assert.equal(rows.length,2);
});
test('unknown and previously flattened metadata never reappears as an object string in teaching selectors',async()=>{
 assert.equal(termLabel('[object Object]-[object Object]'),'');assert.equal(termLabel({unexpected:1}),'');assert.equal(termLabel({name:'2025-2026 第二学期'}),'2025-2026-2');
 const cache=new TeachingCourses({lms:{courses:async()=>[{id:'401',title:'数据课程',term:'[object Object]-[object Object]'}]},lexue:{courses:async()=>[]}});
 const {rows}=await cache.load();assert.equal(rows[0].term,'');assert.equal(rows[0].id,'401');
});
test('an old LMS content script is repaired through a fresh metadata read without requiring another tab reload',async()=>{
 const client=new LmsClient();client.read=async()=>({rows:[{id:'401',term:'[object Object]-[object Object]'}]});client.fallback.read=async()=>({rows:[{id:'401',term:'2026-2027-1'}]});
 assert.equal((await client.courses())[0].term,'2026-2027-1');
 client.fallback.read=async()=>{throw new Error('login expired');};const cache=new TeachingCourses({lms:client,lexue:{courses:async()=>[]}});assert.equal((await cache.load()).rows[0].term,'');
});

test('cleaning a saved object-string term retains the explicitly selected course identity',()=>{
 const binding=safeBindings({'modern:21:100':{title:'数据课程',term:'[object Object]-[object Object]',active:'lms',lms:{id:'401',title:'数据课程',term:'[object Object]-[object Object]'}}})['modern:21:100'];
 assert.equal(binding.term,'');assert.equal(binding.lms.term,'');assert.equal(binding.lms.id,'401');assert.equal(binding.active,'lms');
});
