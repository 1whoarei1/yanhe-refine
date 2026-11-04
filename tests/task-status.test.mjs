import test from 'node:test';
import assert from 'node:assert/strict';
import {taskStatus,pendingTask} from '../src/task-status.js';
import {homeworkRows} from '../src/lms-core.js';

test('the actual activity 2422 response is upcoming despite is_closed before its start',()=>{
 const [task]=homeworkRows({homework_activities:[{id:2422,course_id:20290,type:'homework',published:true,submitted:false,title:'大作业 -技术报告&代码&展示',deadline:'2027-01-03T15:55:00Z',end_time:'2027-01-03T15:55:00Z',start_time:'2026-12-27T16:00:00Z',is_closed:true,is_in_progress:false}]},{},20290);
 const now=Date.parse('2026-11-04T08:00:00Z');assert.equal(task.deadline,Date.parse('2027-01-03T15:55:00Z'));assert.deepEqual(taskStatus(task,now),['未开始','pending']);assert.equal(pendingTask(task,now),true);
 const after=Date.parse('2027-01-04T00:00:00Z');assert.deepEqual(taskStatus(task,after),['已截止','closed']);assert.equal(pendingTask(task,after),false);
 assert.deepEqual(taskStatus({...task,state:'submitted'},now),['已交','submitted']);assert.equal(pendingTask({...task,state:'submitted'},now),false);
});

test('closed without an expired deadline is not described as expired; overdue tasks stay out of pending',()=>{
 const now=Date.parse('2026-11-04T08:00:00Z'),future=now+86400000,past=now-86400000;
 assert.deepEqual(taskStatus({state:'pending',closed:true,deadline:future},now),['未开放','closed']);assert.equal(pendingTask({state:'unknown',closed:true,deadline:future},now),true);
 assert.equal(pendingTask({state:'pending',closed:false,deadline:past},now),false);assert.equal(pendingTask({state:'pending',closed:true},now),false);
});
