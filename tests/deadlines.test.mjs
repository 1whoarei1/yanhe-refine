import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolEpoch,homeworkRows} from '../src/lms-core.js';
import {formatDeadline} from '../src/deadline-display.js';
import {LmsReader} from '../src/lms-reader.js';

test('explicit next-year timestamps retain their year in both parsing and display',()=>{
 const now=Date.parse('2026-11-04T12:00:00+08:00'),expected=Date.parse('2027-01-03T23:59:00+08:00');
 for(const value of ['2027-01-03 23:59:00','2027-01-03T23:59:00+08:00','2027/1/3 23:59:00',expected,expected/1000])assert.equal(schoolEpoch(value),expected);
 assert.match(formatDeadline(expected,now),/2027/);assert.ok(expected>now);
});

test('yearless January deadlines use the course academic year rather than Date.parse defaults',()=>{
 for(const value of ['01-03 23:59','1月3日 23:59'])assert.equal(schoolEpoch(value,'2026-2027-1'),Date.parse('2027-01-03T23:59:00+08:00'));
 assert.equal(schoolEpoch('11-04 23:59','2026-2027-1'),Date.parse('2026-11-04T23:59:00+08:00'));
 assert.equal(schoolEpoch('01-03 23:59'),null);assert.equal(schoolEpoch('01-03 23:59','2026-2027（未标注学期）'),null);
 assert.equal(schoolEpoch('2025-01-03 23:59','2026-2027-1'),Date.parse('2025-01-03T23:59:00+08:00'));
 assert.equal(schoolEpoch('02-30 23:59','2026-2027-1'),null);assert.equal(schoolEpoch('13-03 23:59','2026-2027-1'),null);
});

test('the native end_time takes priority over stale auxiliary deadline values, including an unlimited deadline',()=>{
 const row={id:2422,course_id:20290,published:true,type:'homework',title:'大作业 -技术报告&代码&展示',submitted:false,deadline:'2026-01-03 23:59:00',end_time:'2027-01-03 23:59:00'};
 assert.equal(homeworkRows({homework_activities:[row]}, {},20290,'2026-2027-1')[0].deadline,Date.parse('2027-01-03T23:59:00+08:00'));
 assert.equal(homeworkRows({homework_activities:[{...row,end_time:null}]}, {},20290)[0].deadline,null);
});

test('homework list and task detail share the enrolled course term for cross-year dates',async()=>{
 const activity={id:20,course_id:10,published:true,type:'homework',title:'跨年作业',submitted:false,deadline:'01-03 23:59',data:{homework_type:'file_upload'}};
 const reader=new LmsReader(async url=>{const p=new URL(url).pathname;return new Response(JSON.stringify(p==='/api/my-courses'?{courses:[{id:10,name:'计算机视觉',academic_year:{name:'2026-2027'},semester:{name:'第一学期'}}]}:p.endsWith('/homework-activities')?{homework_activities:[activity]}:p.endsWith('/courseware-activities')?[activity]:p.endsWith('/submission-status')?{}:activity),{headers:{'content-type':'application/json'}});});
 const {rows}=await reader.read({kind:'homework',id:10});assert.equal(rows[0].deadline,Date.parse('2027-01-03T23:59:00+08:00'));
 const detail=await reader.read({kind:'task',courseId:10,id:20});assert.equal(detail.deadline,rows[0].deadline);
 assert.equal(homeworkRows({homework_activities:[{...activity,deadline:'2027-01-03T15:59:00Z'}]}, {},10)[0].deadline,rows[0].deadline);
});
