import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeCourse,searchCourses,relatedCourses,termLabel} from '../src/catalog-core.js';
import {lmsCourses,homeworkRows,materialRows,schoolEpoch} from '../src/lms-core.js';
import {LmsReader} from '../src/lms-reader.js';
import {safeRecords} from '../src/records.js';

test('the same numeric ID on two platforms remains two distinct courses',()=>{
 const old=normalizeCourse({'课程ID':73694,'课程名称':'计算机视觉','授课教师':'张文耀','学年学期':'2026-2027 第一学期','课程链接':'https://www.yanhekt.cn/course/73694'});
 const modern=normalizeCourse({id:73694,title:'计算机视觉',realname:'裴明涛',term_name:'2025-2026-2'},'modern');
 assert.equal(old.key,'legacy:21:73694');assert.equal(modern.key,'modern:21:73694');assert.notEqual(old.teacher,modern.teacher);
 assert.equal(old.term,'2026-2027-1');assert.equal(searchCourses([old,modern],{q:'73694'}).total,2);
});
test('untrusted URLs and invalid identities never enter the catalogue',()=>{
 assert.equal(normalizeCourse({id:'1',title:'bad',url:'https://evil.example/course/1'}),null);
 assert.equal(normalizeCourse({id:'not-an-id',title:'bad'}),null);
 assert.equal(normalizeCourse({id:'1',title:'safe',url:'https://u:p@www.yanhekt.cn/course/1'}),null);
});
test('teacher history supports multiple authors without merging parallel classes',()=>{
 const make=(id,teacher,term,platform='legacy')=>normalizeCourse({id,title:'计算机视觉',teacher,term,platform,code:'EL3105'});
 const current=make('10','裴明涛','2026-2027-1','modern'),old=make('11','梁玮、裴明涛','2024-2025-1'),other=make('12','张文耀','2024-2025-1');
 assert.equal(relatedCourses([current,old,other],current,'teacher').length,1);
 assert.equal(relatedCourses([current,old,other],current,'title').length,2);
 assert.equal(searchCourses([current,old,other],{teacher:'裴明涛'}).total,2);
});
test('empty college and test-course metadata do not become legitimate teacher recommendations',()=>{
 const row=normalizeCourse({id:1042,title:'cs',teacher:'超级管理员',college:'未标注'});
 assert.equal(row.college,'');assert.equal(searchCourses([row]).total,0);assert.equal(searchCourses([row],{includeTests:true}).total,1);
});
test('school timestamps do not depend on the operating system timezone',()=>{
 assert.equal(schoolEpoch('2026-10-23 16:00:00'),Date.parse('2026-10-23T08:00:00Z'));
 assert.equal(schoolEpoch('1792739700'),1792739700000);
 assert.equal(termLabel('2026-2027-第一学期'),'2026-2027-1');
});
test('only published homework is joined with submission metadata, without exposing grades',()=>{
 const body={homework_activities:[{id:1,published:true,title:'已交',submitted:true},{id:2,published:true,data:{title:'小组作业'},submitted:false,submit_by_group:true},{id:3,published:false,title:'未发布'},{id:4,published:true,is_visible:false,title:'未分配'}]};
 const status={homework_activities:[{id:1,status:'submitted',score:92},{id:2,status:'absent'},{id:3,status:'absent'}]};
 const rows=homeworkRows(body,status,20290);assert.equal(rows.length,2);assert.equal(rows[0].state,'submitted');assert.equal(rows[1].state,'pending');assert.equal(rows[1].group,true);
 assert.ok(!JSON.stringify(rows).includes('score'));assert.ok(!JSON.stringify(rows).includes('未发布'));
});
test('unknown submission state remains unknown instead of inflating unsubmitted counts',()=>{
 assert.equal(homeworkRows({homework_activities:[{id:1,published:true,title:'未知状态'}]}, {},20290)[0].state,'unknown');
});
test('mixed courseware responses retain published materials without unpublished homework',()=>{
 const rows=materialRows([{id:1,type:'material',title:'课件',published:true},{id:2,type:'homework',title:'作业',published:true},{id:3,type:'material',title:'未发布',published:false}],20290);
 assert.equal(rows.length,1);assert.equal(rows[0].title,'课件');assert.ok(rows[0].url.endsWith('#/1'));
});
test('the LMS bridge only reads owned courses and published activity attachments',async()=>{
 const calls=[],reader=new LmsReader(async(raw,options)=>{const path=new URL(raw).pathname;calls.push(path);assert.equal(options.credentials,'include');
  const body=path==='/api/my-courses'?{courses:[{id:20290,name:'计算机视觉',academic_year:'2026-2027',semester:1}]}:path.endsWith('courseware-activities')?[{id:10,type:'material',title:'课件',published:true},{id:11,type:'material',title:'未发布',published:false}]:{uploads:[{name:'课件.pdf',allow_download:true,deleted:false},{name:'旧.pdf',deleted:true}]};
  return new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
 });
 await reader.read({kind:'courses'});await assert.rejects(reader.read({kind:'materials',id:'99999'}),/所学课程/);
 await reader.read({kind:'materials',id:'20290'});await assert.rejects(reader.read({kind:'resources',id:'11'}),/刷新/);
 const response=await reader.read({kind:'resources',id:'10'});assert.equal(response.rows.length,1);assert.ok(!calls.includes('/api/activities/11/resources'));
});
test('LMS login HTML is not represented as an empty course list',async()=>{
 const reader=new LmsReader(async()=>new Response('<html>login</html>',{headers:{'content-type':'text/html'}}));
 await assert.rejects(reader.read({kind:'courses'}),/登录新乐学/);
});
test('visible homework survives a submission-status failure without inventing pending work',async()=>{
 const reader=new LmsReader(async raw=>{const p=new URL(raw).pathname;if(p.endsWith('submission-status'))return new Response('',{status:503});return new Response(JSON.stringify(p==='/api/my-courses'?{courses:[{id:20290,name:'计算机视觉'}]}:{homework_activities:[{id:2,published:true,title:'可见作业'}]}),{headers:{'content-type':'application/json'}});});
 const {rows}=await reader.read({kind:'homework',id:20290});assert.equal(rows.length,1);assert.equal(rows[0].state,'unknown');
});
test('numeric visibility flags still hide unavailable activities',()=>{
 assert.equal(homeworkRows({homework_activities:[{id:2,published:1,is_visible:0},{id:3,published:'1',available:'0'}]}, {},20290).length,0);
});
test('record transfer retains progress and calibration while rejecting credentials and arbitrary keys',()=>{
 const saved=safeRecords({'progress:102178:1600001':{time:90,view:'screen',updatedAt:1,token:'secret'},'subtitleOffset:legacy:71988:920536:200:classroom':{seconds:22},'desk:favorites':['modern:21:102178','https://evil.example','modern:21:102178'],'desk:mappings':{'modern:21:102178':20290},token:'secret',cookies:['secret'],'desk:seed':'secret'});
 assert.equal(saved['progress:102178:1600001'].time,90);assert.equal(saved['subtitleOffset:legacy:71988:920536:200:classroom'].seconds,22);assert.equal(saved['desk:mappings']['modern:21:102178'],'20290');assert.deepEqual(saved['desk:favorites'],['modern:21:102178']);assert.ok(!JSON.stringify(saved).includes('secret'));
 assert.throws(()=>safeRecords(null),/格式/);
});
test('XLSX import reads every one of the 79,564 supplied old-site rows',async()=>{
 globalThis.self={};const {readXlsx}=await import('../src/catalog-worker.js');
 const bytes=await readFile(new URL('../../延河课堂-全部课程信息.xlsx',import.meta.url));
 const records=readXlsx(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 assert.equal(records.length,79564);assert.equal(new Set(records.map(r=>r.key)).size,79564);
 const cv=searchCourses(records,{q:'计算机视觉'});assert.ok(cv.total>=34);
 const same=records.filter(c=>c.title==='计算机视觉'&&c.teacher==='裴明涛');assert.equal(same.length,18);
});
