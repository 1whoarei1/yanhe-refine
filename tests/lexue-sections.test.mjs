import test from 'node:test';
import assert from 'node:assert/strict';
import {LEXUE,courseSections,assignmentContent} from '../src/lexue-core.js';
import {LexueReader} from '../src/lexue-reader.js';

const page=content=>`<body class="course-401"><main id="region-main">${content}</main></body>`;
const activity=(id,type='assign')=>`<li class="activity" id="module-${id}"><div class="activityinstance"><a href="/mod/${type}/view.php?id=${id}"><span class="instancename">活动${id}</span></a></div></li>`;
const summary=(section,href=`/course/view.php?id=401&section=${section}`)=>`<li class="section section-summary" id="section-${section}"><h3><a href="${href}">教学周${section}</a></h3><span class="activity-count">作业: 1</span></li>`;
const dates='<div data-region="activity-dates"><div><strong>打开：</strong> 2026年10月28日 星期三 00:00</div><div><strong>到期日：</strong> 2026年11月4日 星期三 23:59</div></div>';
const assignment=page(dates+'<div id="intro">请完成作业</div><table class="submissionstatustable"><tr><th>作业状态</th><td>没有尝试</td></tr></table>');
const response=(html,url)=>{const r=new Response(html,{headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:url});return r;};

test('Moodle section discovery follows only actual summaries of the current course',()=>{
 const html=page(summary(1)+summary(1)+summary(2)+summary(3,'/course/view.php?id=402&section=3')+summary(4,'https://example.com/course/view.php?id=401&section=4')+'<a href="/course/view.php?id=401&section=5">expanded section heading</a>');
 assert.deepEqual(courseSections(html,401),[LEXUE+'/course/view.php?id=401&section=1',LEXUE+'/course/view.php?id=401&section=2']);
 assert.throws(()=>courseSections(html,402),/未正确加载/);
});

test('the current Moodle activity-dates header supplies the deadline without mistaking the opening date',()=>{
 const task=assignmentContent(assignment,{id:'501',courseId:'401',module:'assign'});
 assert.equal(task.deadline,Date.parse('2026-11-04T23:59:00+08:00'));assert.equal(task.state,'pending');
 const conflicting=assignment.replace('2026年11月4日 星期三 23:59','2026年11月27日 星期五 16:06').replace('请完成作业','截止时间2026年11月28日24:00');
 assert.equal(assignmentContent(conflicting,{module:'assign'}).deadline,Date.parse('2026-11-27T16:06:00+08:00'));
 const future=assignmentContent(page(dates.replace('2026年11月4日 星期三','2027年1月3日 星期日')),{module:'assign'});
 assert.equal(future.deadline,Date.parse('2027-01-03T23:59:00+08:00'));
 const openingOnly=page('<div data-region="activity-dates"><div><strong>打开：</strong> 2026年10月28日 星期三 00:00</div></div>');
 assert.equal(assignmentContent(openingOnly,{module:'assign'}).deadline,null);
});

test('weekly summary courses include both sections, deduplicate shared activities, and coalesce discovery',async()=>{
 const calls=[],reader=new LexueReader({fetch:async url=>{
  const u=new URL(url);calls.push(u.pathname+u.search);
  if(u.pathname==='/mod/assign/view.php')return response(assignment,url);
  const section=u.searchParams.get('section');
  return response(section? page(activity(500,'resource')+activity(section==='1'?501:502)):page(activity(500,'resource')+summary(1)+summary(2)),url);
 }});
 reader.courseCache={time:Date.now(),rows:[{id:'401'}]};
 const [materials,tasks]=await Promise.all([reader.read({kind:'materials',id:'401'}),reader.read({kind:'homework',id:'401'})]);
 assert.deepEqual(materials.rows.map(r=>r.id),['500']);assert.deepEqual(tasks.rows.map(r=>r.id),['501','502']);assert.ok(tasks.rows.every(r=>r.deadline===Date.parse('2026-11-04T23:59:00+08:00')));
 assert.equal(calls.filter(url=>url.startsWith('/course/view.php')).length,3);
});

test('a failed section is never cached as an empty successful course and can be retried',async()=>{
 let fails=true;const reader=new LexueReader({fetch:async url=>{
  if(new URL(url).searchParams.has('section')){if(fails)throw new Error('network');return response(page(activity(501)),url);}
  return response(page(summary(1)),url);
 }});reader.courseCache={time:Date.now(),rows:[{id:'401'}]};
 await assert.rejects(reader.course(401),/连接失败/);assert.equal(reader.activities.size,0);
 fails=false;assert.equal((await reader.course(401))[0].id,'501');
});

test('fully expanded courses do not request each heading as another section',async()=>{
 let calls=0;const reader=new LexueReader({fetch:async url=>{calls++;return response(page('<h3><a href="/course/view.php?id=401&section=1">教学周</a></h3>'+activity(501)),url);}});
 reader.courseCache={time:Date.now(),rows:[{id:'401'}]};assert.equal((await reader.course(401)).length,1);assert.equal(calls,1);
});
