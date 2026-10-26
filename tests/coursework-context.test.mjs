import test from 'node:test';
import assert from 'node:assert/strict';
import {bindingSource,resolveBinding,setBinding,setBindingSource,sameTeachingCourse} from '../src/course-bindings.js';
import {CourseworkCache} from '../src/coursework-cache.js';
import {safeRecords} from '../src/records.js';

const cv={key:'modern:21:401',title:'计算机视觉',term:'2026-2027-1',code:'CV'};
const os={key:'modern:21:402',title:'操作系统',term:'2026-2027-1'};
const modern=[{id:'101',title:'计算机视觉',term:cv.term,source:'lms'},{id:'102',title:'操作系统',term:cv.term,source:'lms'}];
const old=[{id:'101',title:'2026-2027第一学期-计算机视觉-老师甲',term:cv.term,source:'lexue'},{id:'103',title:'计算机组成与原理',term:cv.term,source:'lexue'}];
test('legacy wrong-subject links cannot override the current computer vision official course',()=>{
 const legacy={[cv.key]:'102'},resolved=resolveBinding(cv,'lms',modern,{legacy,official:'101'});assert.equal(resolved.target.id,'101');assert.equal(resolved.origin,'official');
 const stale=resolveBinding(cv,'lexue',old,{legacy:{[cv.key]:'lexue:103'}});assert.equal(stale.target,null);assert.equal(stale.blocked,true);
 assert.equal(resolveBinding(cv,'lms',modern,{official:'102'}).target,null);
});
test('new and old LMS associations survive switching independently and never transfer between subjects',()=>{
 const bindings={};setBinding(bindings,cv,'lms',modern[0]);setBinding(bindings,cv,'lexue',old[0]);setBinding(bindings,os,'lms',modern[1]);
 assert.equal(resolveBinding(cv,'lms',modern,{bindings}).target.id,'101');assert.equal(resolveBinding(cv,'lexue',old,{bindings}).target.id,'101');assert.equal(bindingSource(os,bindings,{}),'lms');
 setBindingSource(bindings,cv,'lms');assert.equal(bindingSource(cv,bindings,{}),'lms');assert.equal(bindings[cv.key].lexue.id,'101');assert.equal(bindings[os.key].lms.id,'102');
});
test('a changed subject, term or reused LMS ID invalidates its old association metadata',()=>{
 const bindings={};setBinding(bindings,cv,'lms',modern[0]);
 assert.equal(resolveBinding({...cv,title:'操作系统'},'lms',modern,{bindings}).target,null);
 assert.equal(resolveBinding({...cv,term:'2027-2028-1'},'lms',modern,{bindings}).target,null);
 assert.equal(resolveBinding(cv,'lms',[{...modern[0],title:'操作系统'}],{bindings}).target,null);
 assert.equal(sameTeachingCourse(os,{title:'2026-2027第一学期-操作系统-老师甲',term:cv.term}),true);
});
test('explicitly clearing one platform does not restore a legacy association or erase the other platform',()=>{
 const bindings={};setBinding(bindings,cv,'lms',modern[0]);setBinding(bindings,cv,'lexue',old[0]);setBinding(bindings,cv,'lms',null);
 assert.equal(resolveBinding(cv,'lms',modern,{bindings,legacy:{[cv.key]:'101'},official:'101'}).target,null);assert.equal(resolveBinding(cv,'lexue',old,{bindings}).target.id,'101');
 const restored=safeRecords({'desk:bindings':{...bindings,bad:{token:'secret'}}});assert.deepEqual(restored['desk:bindings'],bindings);assert.ok(!JSON.stringify(restored).includes('secret'));
});
test('coursework caches separate course IDs and LMS platforms even when activity IDs repeat',async()=>{
 const cache=new CourseworkCache(),load=(id,title,source)=>()=>Promise.resolve([{id:'1',courseId:id,title,source}]);
 const a=await cache.read(modern[0],load('101','视觉资料','lms'));
 const b=await cache.read(modern[1],load('102','操作系统资料','lms'));
 const c=await cache.read(old[0],load('101','旧视觉资料','lexue'));
 assert.equal(a[0].title,'视觉资料');assert.equal(b[0].title,'操作系统资料');assert.equal(c[0].title,'旧视觉资料');assert.equal(cache.rows.size,3);
 await assert.rejects(()=>cache.read({...modern[0],id:'999'},load('102','不属于此课','lms')),/当前课程不一致/);assert.equal(cache.rows.has('lms:999'),false);
});
test('an invalidated request cannot overwrite a refreshed course with its late response',async()=>{
 const cache=new CourseworkCache();let finish;
 const pending=cache.read(modern[0],()=>new Promise(resolve=>finish=resolve));await Promise.resolve();cache.invalidate('lms');
 await cache.read(modern[0],async()=>[{id:'2',courseId:'101',title:'最新资料'}]);finish([{id:'1',courseId:'101',title:'旧请求资料'}]);await pending;
 assert.equal(cache.rows.get('lms:101')[0].title,'最新资料');
});
