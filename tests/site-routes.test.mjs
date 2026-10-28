import test from 'node:test';
import assert from 'node:assert/strict';
import {siteRoute,siteHref,nativeHref,referenceRoute} from '../src/site-routes.js';

test('explicit student entries converge while native secondary routes stay functional',()=>{
 for(const u of ['https://aita.yanhekt.cn/portal/#/','https://aita.yanhekt.cn/workbenchAi?tenant_code=21'])assert.equal(siteRoute(u),'/today');
 assert.equal(siteRoute('https://aita.yanhekt.cn/personal/#/myStudy/myCourse'),'/courses');
 assert.equal(siteRoute('https://aita.yanhekt.cn/education/#/home?menu_code=B-wdkc,-1'),'/courses');
 for(const u of ['https://aita.yanhekt.cn/personal/#/myStudy/myScore','https://aita.yanhekt.cn/graph','https://aita.yanhekt.cn/docroom','https://zy-eclass.bit.edu.cn/course/20290/homework'])assert.equal(siteRoute(u),null);
});
test('login callbacks, native opt-out and untrusted origins are never replaced',()=>{
 for(const u of ['https://aita.yanhekt.cn/portal/?token=test','https://aita.yanhekt.cn/portal/?ticket=test','https://aita.yanhekt.cn/portal/?code=test','https://aita.yanhekt.cn/portal/?yh_native=1','https://evil.example/portal/','https://user:pass@aita.yanhekt.cn/portal/'])assert.equal(siteRoute(u),null);
 assert.equal(siteRoute(nativeHref('https://www.yanhekt.cn/course/77464')),null);
});
test('copyable original links round-trip platform, course, lesson and filters',()=>{
 for(const route of ['/course/modern/110118?tab=history&sub=1630190','/course/legacy/77464?tab=watch&sub=920536','/session/legacy/71990?tab=watch','/session/legacy/71990?tab=materials&source=lexue','/courses?scope=all&q=裴明涛&platform=legacy&term=2024-2025-1','/materials?course=lms%3A20290','/settings','/more']){
  const decoded=siteRoute(siteHref('#'+route)),a=new URL('https://fixture.test'+route),b=new URL('https://fixture.test'+decoded);
  assert.equal(a.pathname,b.pathname);assert.deepEqual([...a.searchParams].sort(),[...b.searchParams].sort());
 }
});
test('legacy live IDs are resolved as live references instead of being treated as course IDs',()=>{
 assert.equal(siteRoute('https://www.yanhekt.cn/live/788579'),'/open?legacy_live=788579');
 assert.equal(siteRoute('https://www.yanhekt.cn/ReadSession/920536'),'/session/legacy/920536');
 assert.equal(siteHref('#/open?legacy_live=788579'),'https://www.yanhekt.cn/live/788579');
 assert.equal(siteRoute('https://aita.yanhekt.cn/livingroom?course_id=102154&sub_id=1630190'),'/course/modern/102154?sub=1630190');
});

test('a resolved legacy session keeps its own URL instead of adopting the parent course number',()=>{
 assert.equal(siteRoute('https://www.yanhekt.cn/course/71990'),'/course/legacy/71990');
 assert.equal(siteRoute('https://www.yanhekt.cn/session/71990'),'/session/legacy/71990');
 const route=referenceRoute({legacy:true,id:'9397',sessionId:'71990'});
 assert.equal(route,'#/session/legacy/71990?tab=watch');
 assert.equal(new URL(siteHref(route)).pathname,'/session/71990');
 assert.equal(new URL(siteHref(referenceRoute({legacy:true,id:'71990'}))).pathname,'/course/71990');
});
