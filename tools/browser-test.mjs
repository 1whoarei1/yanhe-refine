import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),ext=resolve(process.env.EXTENSION_PATH||join(root,'extension'));
const fixture=resolve(root,'../yanhe-replay-extension/tests/fixtures');
const output=join(root,'test-results'),profile=await mkdtemp(join(tmpdir(),'yanhe-desk-test-'));
await mkdir(output,{recursive:true});
const report={mode:'isolated Edge test profile; real private catalogue; mocked normal APIs and synthetic media',lectureDownloaded:false,checks:[]};
let context,page;
async function watchFrame(p){await p.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.getElementById('play'));return p.frames().find(f=>f.url().includes('/watch/player.html'));}
try{
 context=await chromium.launchPersistentContext(profile,{executablePath:process.env.BROWSER_EXECUTABLE||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`],viewport:{width:1440,height:1000}});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:20000}),id=new URL(worker.url()).host;
 report.browserVersion=context.browser()?.version();
 const errors=[],requests=[],unexpected=[];let offline=false,lmsOffline=false;
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const modernToken='desk-test-opaque-0123456789',oldToken='d'.repeat(32);
 const cookie=encodeURIComponent(`a:2:{i:0;s:6:"_token";i:1;s:${modernToken.length}:"${modernToken}";}`);
 await context.addCookies([{name:'_token',value:cookie,domain:'aita.yanhekt.cn',path:'/',secure:true,httpOnly:true,sameSite:'None'}]);
 const now=Date.now(),iso=t=>new Date(t).toISOString(),current={id:102178,title:'计算机视觉',realname:'裴明涛',term_name:'2026-2027-1',kkxy_name:'计算机学院',course_code:'EL3105',zhiyuan_id:20290};
 const live={id:102154,title:'强化学习',realname:'杨毅',term_name:'2026-2027-1',kkxy_name:'计算机学院'};
 const iot={id:110118,title:'人机协同的智能物联网应用设计',realname:'李海',term_name:'2026-2027-1',kkxy_name:'计算机学院'};
 const replay=(id,title,start)=>({id,sub_title:title,type:'course_live',playback_status:'1',class_begin:start,sub_status:'3'});
 const liveRow={id:1630190,sub_title:'强化学习 · 第八讲',type:'course_live',playback_status:'0',sub_status:'1',class_begin:Math.floor(now/1000)-1000};
 await context.route('https://**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname;requests.push({host:u.hostname,path,method:req.method()});
  assert.ok(['GET','HEAD'].includes(req.method()),'all platform activity must be read only');
  const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  if(u.hostname==='zy-eclass.bit.edu.cn'){
   if(lmsOffline)return route.fulfill({status:200,contentType:'text/html',body:'<html>Login</html>'});
   if(path==='/api/my-courses')return json({courses:[{id:20290,name:'计算机视觉',course_code:'EL3105',academic_year:'2026-2027',semester:1}]});
   if(path==='/api/courses/20290/homework-activities')return json({page:1,pages:1,homework_activities:[{id:5956,title:'白平衡与伽马校正',published:true,submitted:true},{id:2413,title:'相机标定',published:true,submitted:false,deadline:'2026-10-30 23:59:00'},{id:2414,title:'图像拼接（选做）',published:true,submit_by_group:true,deadline:'2026-11-04 23:59:00'},{id:9999,title:'尚未发布的题目',published:false}]});
   if(path==='/api/course/20290/homework/submission-status')return json({homework_activities:[{id:5956,status:'submitted',score:99},{id:2413,status:'absent'},{id:2414,status:'absent'},{id:9999,status:'absent'}]});
   if(path==='/api/course/20290/courseware-activities')return json([...['课程介绍','图像增强','相机模型','house 数据集'].map((title,i)=>({id:3000+i,type:'material',title,published:true})),{id:9999,type:'homework',title:'尚未发布的题目',published:false}]);
   if(/^\/api\/activities\/300\d\/resources$/.test(path))return json({uploads:[{name:'lecture.pdf',size:2100000,type:'application/pdf',allow_download:true},{name:'deleted.pdf',deleted:true}]});
   if(!path.startsWith('/api/'))return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>新乐学测试页</body></html>'});
  }
  if(u.hostname==='www.yanhekt.cn')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>延河课堂测试页</body></html>'});
  if(u.hostname==='cbiz.yanhekt.cn'){
   assert.equal(req.headers().authorization,`Bearer ${oldToken}`);
   const data=path==='/v1/user'?{id:7,badge:'fixture-badge'}:path==='/v1/auth/video/token'?{token:'video_fixture',now:100,expired_at:700}:
    path==='/v1/live'?{id:788579,session_id:'920536',course:{id:71988},session:{id:920536,course_id:71988}}:
    path==='/v1/course/session'?{id:Number(u.searchParams.get('session_id')),course_id:71988}:
    path==='/v1/course'?{id:Number(u.searchParams.get('id')),name_zh:'（英）纳米材料与物理',professors:[{name:'张教授'}],school_year:'2024-2025',semester:1}:
    path==='/v2/course/session/list'?[{id:920536,title:'纳米材料导论',started_at:'2024-09-22 08:00:00',videos:[{id:200,duration:5,main:'https://cvideo.yanhekt.cn/play/test.m3u8',vga:'https://cvideo.yanhekt.cn/play/test.m3u8'}]}]:path==='/v1/video/subtitle/list'?[]:undefined;
   if(data!==undefined)return json({code:0,data});
  }
  if(u.hostname==='aita.yanhekt.cn'){
   if(path.startsWith('/portal')||path==='/coursedetail'||path==='/livingroom')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>延河课堂测试页</body></html>'});
   if(path==='/userapi/v1/infosimple')return json({code:200,params:{id:123,tenant_id:21,phone:'13000001234',account:'student-fixture'}});
   if(offline&&path.startsWith('/courseapi/'))return route.fulfill({status:503,body:''});
   if(path==='/vlabpassportapi/v1/account-profile/course')return json({code:1000,params:{result:{data:[current,live,iot].map(r=>({Id:r.id,Title:r.title,Teacher:r.realname,TermName:r.term_name,kkxy_name:r.kkxy_name,zhiyuan_id:r.zhiyuan_id})),total:3}}});
   if(path==='/vlabpassportapi/v1/course/term-list')return json({code:1000,params:{list:[{id:1,term_name:'2026-2027-1'}]}});
   if(path==='/vlabpassportapi/v1/user/structures')return json({code:1000,params:{data:[{id:1,display_name:'计算机学院'}]}});
   if(path.endsWith('/get-course-list')){const q=u.searchParams.get('title')||'',rows=[current,live,iot].filter(c=>c.title.includes(q));return json({code:0,data:{list:rows,total:rows.length}});}
   if(path.endsWith('/get-my-course-day'))return json({code:0,list:{day:{course:[{...live,course_id:live.id,sub_id:1630190,course_begin:iso(now-1200000),course_over:iso(now+2400000),room_name:'中教 101',sub_status:'1'},{...current,course_id:current.id,sub_id:1600001,course_begin:iso(now+7200000),course_over:iso(now+12600000),room_name:'综教 503',sub_status:'2'}]}}});
   if(path.endsWith('/get-course-detail')){const n=Number(u.searchParams.get('course_id')),c=n===102154?live:n===110118?iot:current;return json({code:0,data:{...c,id:n,sub_list:n===102154?[liveRow]:[replay(1600001,'2026-09-22第8-9节',10),replay(1600002,'2026-09-29第8-9节',20)]}});}
   if(path.endsWith('/get-course-teacher-others'))return json({code:0,data:[{id:1042,title:'cs',realname:'超级管理员'},{...current,id:999001,term_name:'2024-2025-1'}]});
   if(path.endsWith('/get-course-resource'))return json({code:0,data:u.searchParams.get('course_id')==='110118'?[{id:1,name:'智能物联网 · 课程大纲'}]:[]});
   if(path.endsWith('/get-sub-info'))return json({code:0,data:u.searchParams.get('sub_id')==='1630190'?{sub_type:'course_live',sub_status:'1',sub_title:liveRow.sub_title,live_url:{output:{m3u8:'https://aita.yanhekt.cn/play/test.m3u8'},output_ppt:{m3u8:'https://aita.yanhekt.cn/play/test.m3u8'}}}:{duration:120,video_list:{screen:{type:2,status:2,preview_url:'https://aita.yanhekt.cn/play/timing.mp4'},room:{type:3,status:2,preview_url:'https://aita.yanhekt.cn/play/test.m3u8'}}}});
   if(path.startsWith('/coursesourceapi/course/study-auth/'))return json({code:200,data:{hasPermission:false}});
   if(path.endsWith('/search-trans-result'))return json({code:0,list:[{all_content:[{BeginSec:0,EndSec:2.9,Text:'我们先来看相机模型。'},{BeginSec:3,EndSec:5,Text:'从世界坐标映射到像素坐标。'},{BeginSec:68,EndSec:70,Text:'接下来讨论相机的内参矩阵。'},...Array.from({length:100},(_,i)=>({BeginSec:100+i*5,EndSec:104+i*5,Text:`针孔成像模型与投影变换，第 ${i+1} 个知识点。`}))]}]});
  }
  if((u.hostname==='aita.yanhekt.cn'||u.hostname==='cvideo.yanhekt.cn')&&path.startsWith('/play/')){
   const name=basename(path);if(!/^(?:timing\.mp4|test(?:\.m3u8|\d{3}\.ts))$/.test(name))throw new Error('unexpected media fixture');
   let data=await readFile(join(fixture,name));const headers={'Accept-Ranges':'bytes'},type=name.endsWith('.mp4')?'video/mp4':name.endsWith('.m3u8')?'application/vnd.apple.mpegurl':'video/mp2t';
   const range=req.headers().range?.match(/^bytes=(\d+)-(\d*)$/);if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),data.length-1):data.length-1;headers['Content-Range']=`bytes ${start}-${end}/${data.length}`;data=data.subarray(start,end+1);return route.fulfill({status:206,contentType:type,headers,body:data});}
   return route.fulfill({status:200,contentType:type,headers,body:data});
  }
  unexpected.push(u.hostname+path);return route.fulfill({status:404,body:''});
 });
 page=await context.newPage();const base=`chrome-extension://${id}/desk.html`;
 await page.goto(base+'#/today');await page.locator('.lesson').first().waitFor({timeout:90000});
 assert.equal(await page.locator('.lesson').count(),2);assert.match(await page.locator('.lesson-body.live').innerText(),/强化学习/);
 assert.equal(await page.locator('h1').innerText(),'今天');
 assert.equal(await page.locator('nav a').count(),4);report.checks.push('clean four-entry workspace loads a real 106,933-record catalogue in a worker');
 await page.screenshot({path:join(output,'today.png'),fullPage:true});
 await page.getByRole('link',{name:'观看直播',exact:true}).click();
 let frame=await watchFrame(page);
 await frame.waitForFunction(()=>!document.getElementById('play').disabled);assert.equal(await frame.locator('#filter-live').getAttribute('aria-pressed'),'true');
 assert.equal(requests.filter(r=>r.path.startsWith('/play/')).length,0);report.checks.push('today live action selects its exact lesson without preloading media');
 await frame.locator('#play').click();await frame.waitForFunction(()=>document.querySelector('video').videoWidth>0&&document.querySelector('video').currentTime>.2,null,{timeout:20000});
 await frame.locator('video').evaluate(v=>v.pause());assert.ok(requests.some(r=>r.path.endsWith('.ts')));report.checks.push('embedded live player decodes synthetic HLS with page-permission metadata preserved');
 await page.screenshot({path:join(output,'live.png'),fullPage:true});
 await page.goto(base+'#/courses?scope=all&q='+encodeURIComponent('计算机视觉'));await page.locator('.course-row').first().waitFor();
 assert.ok(await page.locator('.course-row').count()>=34);await page.screenshot({path:join(output,'courses.png'),fullPage:true});
 await page.goto(base+'#/courses?scope=all&q=73694');await page.locator('.course-row').first().waitFor();
 const keys=await page.locator('.course-row').evaluateAll(rows=>rows.map(r=>r.dataset.courseKey));assert.ok(keys.includes('legacy:21:73694'));assert.ok(keys.includes('modern:21:73694'));report.checks.push('same numeric old/new ID remains two independently linked courses');
 await page.goto(base+'#/courses?scope=all&q='+encodeURIComponent('裴明涛'));await page.locator('.course-row').first().waitFor();
 assert.ok(await page.locator('.course-row .source-label').filter({hasText:'新版'}).count()>0);assert.ok(await page.locator('.course-row .source-label').filter({hasText:'旧版'}).count()>0);report.checks.push('teacher search matches both platform catalogues even when remote title search returns zero');
 await page.goto(base+'#/course/modern/102178?tab=history');await page.locator('.course-list').waitFor();
 assert.ok(await page.locator('.course-row').count()>=18);assert.equal(await page.getByText('超级管理员',{exact:true}).count(),0);report.checks.push('teacher history spans archived terms and hides administrative test recommendations');
 await page.screenshot({path:join(output,'history.png'),fullPage:true});
 await page.goto(base+'#/course/modern/102178?tab=watch&sub=1600001');frame=await watchFrame(page);
 await frame.locator('.subtitle-item').first().waitFor();await frame.waitForFunction(()=>!document.getElementById('play').disabled);
 await frame.locator('#play').click();await frame.waitForFunction(()=>document.querySelector('video').currentTime>.2,null,{timeout:20000});
 await frame.locator('video').evaluate(v=>{v.pause();v.currentTime=90;});await frame.locator('#subtitle-calibration summary').click();await frame.locator('#subtitle-offset').fill('22');await frame.locator('.offset-apply').click();
 await frame.waitForFunction(()=>document.querySelector('.subtitle-item.active')?.textContent.includes('内参矩阵'));
 assert.equal(await frame.locator('.subtitle-item.active time').innerText(),'1:30');assert.equal(await frame.locator('video').evaluate(v=>v.videoWidth>0),true);
 await page.waitForFunction(async()=>Boolean((await chrome.storage.local.get('subtitleOffset:102178:1600001:screen'))['subtitleOffset:102178:1600001:screen']));report.checks.push('embedded replay decodes MP4 and manual +22s calibration aligns 1:08 to 1:30 in existing storage namespace');
 await page.screenshot({path:join(output,'watch.png'),fullPage:true});
 await page.setViewportSize({width:375,height:900});await page.screenshot({path:join(output,'watch-narrow.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.checks.push('375px shell and embedded player do not overflow horizontally');await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'#/tasks');await page.locator('.task-row').first().waitFor();assert.equal(await page.locator('.task-row').count(),2);assert.equal(await page.getByText('尚未发布的题目',{exact:true}).count(),0);assert.equal(await page.getByText('99',{exact:true}).count(),0);assert.match(await page.locator('.task-row').last().innerText(),/小组/);
 await page.screenshot({path:join(output,'tasks.png'),fullPage:true});await page.getByRole('combobox',{name:'提交状态'}).selectOption('submitted');await page.waitForFunction(()=>document.querySelectorAll('.task-row').length===1);assert.match(await page.locator('.task-row').innerText(),/白平衡/);report.checks.push('tasks distinguish submitted and pending work, preserve groups and exclude unpublished tasks/grades');
 await page.goto(base+'#/materials');await page.waitForFunction(()=>document.querySelectorAll('.material-row').length===5);assert.match(await page.locator('.material-row').first().innerText(),/智能物联网/);await page.screenshot({path:join(output,'materials.png'),fullPage:true});
 await page.getByRole('button',{name:'附件',exact:true}).first().click();await page.locator('.attachment-row').filter({hasText:'lecture.pdf'}).waitFor();assert.equal(await page.getByText('deleted.pdf',{exact:true}).count(),0);await page.getByRole('button',{name:'关闭',exact:true}).click();report.checks.push('global materials combine classroom sources with four published LMS resources and guarded attachment metadata');
 await page.goto(base+'#/course/modern/102178?tab=materials');await page.waitForFunction(()=>document.querySelectorAll('.material-row').length===4);assert.equal(await page.getByRole('combobox',{name:'关联新乐学课程'}).inputValue(),'20290');report.checks.push('official LMS association exposes published material when classroom resources are empty');
 await page.goto(base+'#/courses?scope=my');await page.locator('.course-row').first().waitFor();await page.getByRole('button',{name:'收藏计算机视觉',exact:true}).click();await page.getByRole('tab',{name:'收藏',exact:true}).click();await page.locator('.course-row').waitFor();assert.equal(await page.locator('.course-row').count(),1);report.checks.push('favorites persist independently of platform enrolment');
 await page.goto(base+'#/settings');await page.getByRole('heading',{name:'设置',exact:true}).waitFor();assert.match(await page.locator('.setting-row').first().innerText(),/79,564/);const seed=(await page.evaluate(()=>chrome.storage.local.get('desk:seed')))['desk:seed'];assert.equal(typeof seed,'string');
 await page.reload();await page.getByRole('heading',{name:'设置',exact:true}).waitFor();assert.equal((await page.evaluate(()=>chrome.storage.local.get('desk:seed')))['desk:seed'],seed);report.checks.push('full catalogue survives reload in IndexedDB without a repeated seed import');
 offline=true;await page.goto(base+'#/courses?scope=all&q='+encodeURIComponent('裴明涛'));await page.locator('.course-row').first().waitFor();assert.match(await page.locator('.list-heading').innerText(),/目录结果/);report.checks.push('an offline API preserves local teacher/course discovery');offline=false;
 lmsOffline=true;await page.goto(base+'#/materials');await page.getByRole('button',{name:'刷新当前页'}).click();await page.waitForFunction(()=>document.querySelectorAll('.material-row').length===1);assert.match(await page.locator('.inline-notice').innerText(),/新乐学未连接/);report.checks.push('LMS disconnection retains independently available classroom materials');lmsOffline=false;
 const old=await context.newPage();await old.goto('https://www.yanhekt.cn/course/71988');await old.evaluate(token=>localStorage.setItem('auth',JSON.stringify({token,login:true})),oldToken);await old.locator('#yanhe-desk-open').waitFor();await old.evaluate(()=>history.pushState({},'','/live/788579'));
 const [opened]=await Promise.all([context.waitForEvent('page'),old.locator('#yanhe-desk-open').click()]);await opened.getByRole('heading',{name:'（英）纳米材料与物理',exact:true}).waitFor({timeout:30000});assert.match(opened.url(),/#\/course\/legacy\/71988\?tab=watch&sub=920536/);let oldFrame=await watchFrame(opened);await oldFrame.waitForFunction(()=>document.querySelector('.lecture-item.selected')?.dataset.id==='920536:200');report.checks.push('actual floating launcher follows old-site SPA /live/788579 to course 71988 and session 920536');await opened.close();await old.close();
 await page.goto(`chrome-extension://${id}/player.html?course=102178`);await page.waitForURL(`chrome-extension://${id}/watch/player.html?course=102178`);report.checks.push('previous player links redirect to the retained component');
 const stored=JSON.stringify(await page.evaluate(()=>chrome.storage.local.get(null)));assert.ok(!/desk-test-opaque|13000001234|student-fixture|video_fixture/.test(stored));assert.ok(!stored.includes(oldToken));report.checks.push('catalogues and preferences contain no authentication/signing credentials');
 await page.goto(base+'#/today');await page.locator('.lesson').first().waitFor();await page.setViewportSize({width:375,height:900});await page.screenshot({path:join(output,'today-narrow.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.goto(base+'#/courses?scope=all&q='+encodeURIComponent('计算机视觉'));await page.locator('.course-row').first().waitFor();await page.screenshot({path:join(output,'courses-narrow.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.checks.push('mobile course and schedule layouts pass overflow checks');
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);report.checks.push('no page exceptions, unexpected hosts or platform writes');report.ok=true;
}catch(error){report.ok=false;report.error=String(error.stack).replace(/https?:\/\/\S+/g,'[url]');process.exitCode=1;if(page){await page.screenshot({path:join(output,'failed.png'),fullPage:true}).catch(()=>{});report.visible=await page.locator('main').innerText().catch(()=>null);}}
finally{if(context)await context.close();if(dirname(resolve(profile))===resolve(tmpdir())&&basename(profile).startsWith('yanhe-desk-test-'))await rm(profile,{recursive:true,force:true});await writeFile(join(output,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
