import test from 'node:test';
import assert from 'node:assert/strict';
import {academicTerm,lmsCourses} from '../src/lms-core.js';
import {termLabel} from '../src/catalog-core.js';
import {TeachingCourses} from '../src/teaching-courses.js';
import {LmsClient} from '../src/lms-client.js';
import {safeBindings} from '../src/course-bindings.js';
import {currentTeachingTerm} from '../src/teaching-terms.js';

test('the native screenshot semester 2026-20271季学期 resolves with and without a separate academic year',()=>{
 for(const value of ['2026-20271季学期','2026-2027-1季学期','２０２６－２０２７１季学期','2026-2027学年第一季学期']){
  assert.equal(academicTerm({name:'2026-2027'},{name:value}),'2026-2027-1');
  assert.equal(academicTerm(null,{real_name:value}),'2026-2027-1');
 }
 assert.equal(academicTerm('2026-2027',{real_name:'1季学期'}),'2026-2027-1');
 assert.equal(academicTerm(null,{name:'2025-20262季学期'}),'2025-2026-2');
 assert.equal(academicTerm(null,{name:'2024-20253季学期'}),'2024-2025-3');
 for(const value of ['2026-20291季学期','2026-202712季学期','2026-20274季学期'])assert.equal(academicTerm('2026-2027',{name:value}),'');
 assert.equal(lmsCourses({courses:[{id:401,name:'操作系统',academic_year:{name:'2026-2027'},semester:{id:902,name:'2026-20271季学期'}}]})[0].term,'2026-2027-1');
});

test('LMS real_name and explicit semester indices are semantic labels, while database IDs remain unknown',()=>{
 assert.equal(academicTerm({name:'2026-2027学年'},{id:91,name:'教学安排 A',real_name:'第一学期'}),'2026-2027-1');
 assert.equal(academicTerm({name:'2026-2027'},{id:92,name:'教学安排 B',real_name:'第二学期'}),'2026-2027-2');
 assert.equal(academicTerm({name:'2026-2027'},{semester_index:1}),'2026-2027-1');
 assert.equal(academicTerm({name:'2026-2027'},{id:1}),'');
 assert.equal(currentTeachingTerm(Date.parse('2026-10-28T00:00:00Z')),'2026-2027-1');
 assert.equal(currentTeachingTerm(Date.parse('2027-01-05T00:00:00Z')),'2026-2027-1');
 assert.equal(currentTeachingTerm(Date.parse('2027-04-05T00:00:00Z')),'2026-2027-2');
});

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

test('reference-only course metadata resolves through semester and academic-year dictionaries without guessing database IDs',()=>{
 const body={courses:[{id:701,name:'当前课',academic_year:{id:81},semester:{id:902}},{id:702,name:'旧课',academic_year:80,semester:901},{id:703,name:'未知课',academic_year:{id:1},semester:{id:1}}]};
 assert.deepEqual(lmsCourses(body).map(row=>row.term),['','','']);
 const rows=lmsCourses(body,{academicYears:[{id:81,name:'2026-2027'},{id:80,name:'2025-2026'}],semesters:[{id:902,name:'内部名称',real_name:'第一学期',academic_year_id:81},{id:901,real_name:'第二学期',academic_year_id:80}]});
 assert.deepEqual(rows.map(row=>row.term),['2026-2027-1','2025-2026-2','']);
 assert.equal(lmsCourses({courses:[{id:705,academic_year:{name:'2026-2027'},semester:1}]})[0].term,'');
 assert.equal(lmsCourses({courses:[{id:705,academic_year:{name:'2026-2027'},semester:1}]},{semesters:[{id:1,real_name:'第二学期'}]})[0].term,'2026-2027-2');
 assert.equal(lmsCourses({courses:[{id:704,name:'父学年',semester_id:902}]},{academicYears:[{id:81,name:'2026'}],semesters:[{id:902,real_name:'秋季学期',academic_year_id:81}]} )[0].term,'2026-2027-1');
});
