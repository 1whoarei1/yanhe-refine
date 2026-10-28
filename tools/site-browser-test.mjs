import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,rm,writeFile,cp} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),ext=resolve(process.env.EXTENSION_PATH||join(root,'extension'));
const fixture=resolve(root,'tests/fixtures');
const output=join(root,'test-results'),testRoot=await mkdtemp(join(tmpdir(),'yanhe-refine-test-')),profile=join(testRoot,'profile'),testExt=join(testRoot,'extension');
await cp(ext,testExt,{recursive:true});
const testCourses=[{id:102178,title:'计算机视觉',teacher:'裴明涛',term:'2026-2027-1',platform:'modern'},...Array.from({length:20},(_,i)=>({id:70000+i,title:'计算机视觉',teacher:'裴明涛',term:'2024-2025-1',platform:'modern'})),{id:60001,title:'计算机视觉',teacher:'裴明涛',term:'2023-2024-1',platform:'legacy'},{id:73694,title:'计算机视觉',teacher:'张老师',term:'2025-2026-1',platform:'legacy'},{id:73694,title:'计算机视觉',teacher:'裴明涛',term:'2025-2026-2',platform:'modern'}];
testCourses.push(...Array.from({length:45},(_,i)=>({id:85000+i,title:'分页课程',teacher:'分页老师',term:'2024-2025-1',platform:i%2?'modern':'legacy'})));
const seed=JSON.stringify({courses:testCourses});await writeFile(join(testExt,'private-catalog.json'),seed);await writeFile(join(testExt,'build-info.json'),JSON.stringify({version:JSON.parse(await readFile(join(ext,'manifest.json'),'utf8')).version,catalog:{count:testCourses.length,sha256:createHash('sha256').update(seed).digest('hex')}}));
await mkdir(output,{recursive:true});
await mkdir(join(profile,'Default'),{recursive:true});
await writeFile(join(profile,'Default','Preferences'),JSON.stringify({download:{default_directory:join(testRoot,'downloads'),prompt_for_download:false}}));
const report={version:JSON.parse(await readFile(join(ext,'manifest.json'),'utf8')).version,mode:'isolated Edge; in-site UI; synthetic catalogue, normal API fixtures and synthetic media',lectureDownloaded:false,checks:[]};
report.checks.push=(...values)=>{console.log(...values);return Array.prototype.push.apply(report.checks,values);};
let context,page;
async function watchFrame(p){await p.frameLocator('iframe').locator('#play').waitFor();return p.frames().find(f=>f.url().includes('/watch/player.html'));}
async function visit(p,url){await p.goto(url,{waitUntil:'commit'}).catch(e=>{if(!/ERR_ABORTED/.test(e.message))throw e;});}
const nativeHtml='<!doctype html><html><head><meta charset=utf-8></head><body><h1>原站功能</h1><input id=original-input aria-label=原站输入><button id=native-button>原站操作</button><script>window.nativeStarted=true;document.getElementById("native-button").onclick=()=>document.getElementById("native-button").textContent="已操作";</script></body></html>';
try{
 context=await chromium.launchPersistentContext(profile,{executablePath:process.env.BROWSER_EXECUTABLE||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${testExt}`,`--load-extension=${testExt}`],viewport:{width:1440,height:1000}});
 const control=await context.newCDPSession(context.pages()[0]);await control.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:join(testRoot,'downloads'),eventsEnabled:true});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:20000}),id=new URL(worker.url()).host;
 // Keep Chromium's actual disk download + progress API; replace only the fixture URL at its boundary.
 // Browser downloads bypass Playwright request routing, so never send these synthetic IDs to a real host.
 await worker.evaluate(()=>{const download=chrome.downloads.download.bind(chrome.downloads);globalThis.fixtureDownloads=[];chrome.downloads.download=async options=>{
  if(!['https://zy-eclass.bit.edu.cn/api/uploads/reference/5001/blob','https://aita.yanhekt.cn/fixture/outline.txt',...['slides.pdf','helper.pdf','instructions.zip'].map(name=>'https://lexue.bit.edu.cn/pluginfile.php/1901/mod_resource/content/0/'+name+'?forcedownload=1')].includes(options.url))throw new Error('Unexpected fixture download');
  globalThis.fixtureDownloads.push(options);return download({...options,url:'data:text/plain;base64,c3ludGhldGljIGF0dGFjaG1lbnQ='});
 };});
 report.browserVersion=context.browser()?.version();
 const errors=[],requests=[],unexpected=[];let offline=false,lmsOffline=false,roomBroken=false,legacyStatus=1,submitted=null,submissionPosts=0,lexueConnected=false,crossCourse=false,delayOperatingSystem=false,releaseOperatingSystem,operatingSystemStarted;
 context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='warning')console.log(m.text());});});
 const modernToken='desk-test-opaque-0123456789',oldToken='d'.repeat(32);
 const cookie=encodeURIComponent(`a:2:{i:0;s:6:"_token";i:1;s:${modernToken.length}:"${modernToken}";}`);
 await context.addCookies([{name:'_token',value:cookie,domain:'aita.yanhekt.cn',path:'/',secure:true,httpOnly:true,sameSite:'None'}]);
 await context.addCookies([{name:'XSRF-TOKEN',value:'fixture%20csrf',domain:'zy-eclass.bit.edu.cn',path:'/',secure:true,sameSite:'None'}]);
 const now=Date.now(),iso=t=>new Date(t).toISOString(),current={id:102178,title:'计算机视觉',realname:'裴明涛',term_name:'2026-2027-1',kkxy_name:'计算机学院',course_code:'EL3105',zhiyuan_id:20290};
 const live={id:102154,title:'强化学习',realname:'杨毅',term_name:'2026-2027-1',kkxy_name:'计算机学院'};
 const iot={id:110118,title:'人机协同的智能物联网应用设计',realname:'李海',term_name:'2026-2027-1',kkxy_name:'计算机学院'};
 const replay=(id,title,start)=>({id,sub_title:title,type:'course_live',playback_status:'1',class_begin:start,sub_status:'3'});
 const liveRow={id:1630190,sub_title:'强化学习 · 第八讲',type:'course_live',playback_status:'0',sub_status:'1',class_begin:Math.floor(now/1000)-1000};
 await context.route('https://**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname;requests.push({host:u.hostname,path,method:req.method()});
  const moodleRead=u.hostname==='lexue.bit.edu.cn'&&path==='/lib/ajax/service.php'&&req.method()==='POST';
  if(moodleRead)assert.deepEqual(req.postDataJSON().map(r=>r.methodname),['core_course_get_enrolled_courses_by_timeline_classification']);
  assert.ok(['GET','HEAD'].includes(req.method())||moodleRead||(u.hostname==='zy-eclass.bit.edu.cn'&&['/api/uploads','/api/course/activities/2413/submissions'].includes(path))||(u.hostname==='zy-media.bit.edu.cn'&&path==='/upload/file/9001'&&['PUT','OPTIONS'].includes(req.method())),'only named Moodle reads and explicit synthetic coursework writes are allowed');
  const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  if(u.hostname==='lexue.bit.edu.cn'){
   const html=body=>route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html><body class="course-${path==='/course/view.php'?u.searchParams.get('id'):'20290'}"><main id="region-main">${body}</main></body></html>`});
   if(!lexueConnected)return html('<button id="loginbtn">Login</button>');
   const file=name=>'https://lexue.bit.edu.cn/pluginfile.php/1901/mod_resource/content/0/'+name+'?forcedownload=1';
   if(path==='/my/')return html('<script>window.M={};M.cfg={"wwwroot":"https://lexue.bit.edu.cn","sesskey":"syntheticMoodle123"};</script><h1>旧乐学课程</h1>');
   if(path==='/lib/ajax/service.php')return json([{error:false,data:{courses:[{id:20290,fullname:'旧乐学示例课程',startdate:1790000000,visible:true},...(crossCourse?[[20291,'操作系统'],[20292,'计算机组成与原理'],[20293,'计算机视觉']].map(([id,fullname])=>({id,fullname,startdate:1790000000,visible:true})):[])],nextoffset:crossCourse?4:1}}]);
   if(path==='/course/view.php'&&crossCourse&&u.searchParams.get('id')!=='20290'){const id=u.searchParams.get('id'),title=({'20291':'操作系统','20292':'计算机组成与原理','20293':'计算机视觉'})[id];return html(`<li id="module-${Number(id)+10000}" class="activity modtype_folder"><div class="activityinstance"><a href="/mod/folder/view.php?id=${Number(id)+10000}"><span class="instancename">${title}旧资料</span></a></div></li>`);}
   if(path==='/course/view.php')return html([[9001,'resource','旧乐学课件'],[9002,'folder','旧乐学文件夹'],[2413,'assign','旧乐学示例作业']].map(([id,type,title])=>`<li id="module-${id}" class="activity modtype_${type}"><div class="activityinstance"><a href="/mod/${type}/view.php?id=${id}"><span class="instancename">${title}<span class="accesshide">文件</span></span></a></div></li>`).join(''));
   if(path==='/mod/resource/view.php')return route.fulfill({status:302,headers:{Location:file('slides.pdf')},body:''});
   if(path==='/mod/folder/view.php')return html(['slides.pdf','helper.pdf','helper.pdf'].map(name=>`<a href="${file(name)}">${name}</a>`).join(''));
   if(path==='/mod/assign/view.php')return html(`<div id="intro"><h3>旧乐学作业正文</h3><p>截止时间2026年11月27日24:00</p><a href="${file('instructions.zip')}">instructions.zip</a><script>window.moodleInjection=true</script></div><table class="submissionstatustable"><tr><th>作业状态</th><td>没有尝试</td></tr></table>`);
   if(path.startsWith('/pluginfile.php/'))return route.fulfill({status:206,contentType:'application/pdf',headers:{'Content-Range':'bytes 0-0/23','Content-Disposition':'attachment; filename="slides.pdf"'},body:'x'});
  }
  if(u.hostname==='zy-media.bit.edu.cn'&&path==='/upload/file/9001'){
   assert.equal(req.method(),'PUT');assert.equal(req.headers()['x-xsrf-token'],undefined);assert.equal(req.headers().cookie,undefined);
   assert.match(req.headers()['content-type'],/multipart\/form-data/);assert.ok(req.postDataBuffer().includes(Buffer.from('synthetic answer')));return route.fulfill({body:''});
  }
  if(u.hostname==='zy-eclass.bit.edu.cn'){
   if(lmsOffline)return route.fulfill({status:200,contentType:'text/html',body:'<html>Login</html>'});
   if(path==='/api/my-courses')return json({courses:[{id:20290,name:'计算机视觉',course_code:'EL3105',academic_year:'2026-2027',semester:1},...(crossCourse?[[20291,'操作系统'],[20292,'计算机组成与原理']].map(([id,name])=>({id,name,academic_year:'2026-2027',semester:1})):[])]});
   if(crossCourse&&/^\/api\/(?:course|courses)\/(20291|20292)\//.test(path)){const id=path.match(/(20291|20292)/)[0];if(path.endsWith('/courseware-activities')){if(id==='20291'&&delayOperatingSystem){operatingSystemStarted?.();await new Promise(resolve=>releaseOperatingSystem=resolve);}return json([{id:Number(id)+1000,course_id:Number(id),type:'material',title:id==='20291'?'操作系统新资料':'计算机组成与原理新资料',published:true}]);}if(path.endsWith('/homework-activities'))return json({page:1,pages:1,homework_activities:[]});if(path.endsWith('/submission-status'))return json({homework_activities:[]});}
   if(path==='/api/courses/20290/homework-activities')return json({page:1,pages:1,homework_activities:[{id:5956,title:'白平衡与伽马校正',published:true,submitted:true},{id:2413,title:'相机标定',published:true,submitted:false,deadline:'2026-10-30 23:59:00'},{id:2414,title:'图像拼接（选做）',published:true,submit_by_group:true,deadline:'2026-11-04 23:59:00'},{id:9999,title:'尚未发布的题目',published:false}]});
   if(path==='/api/course/20290/homework/submission-status')return json({homework_activities:[{id:5956,status:'submitted',score:99},{id:2413,status:'absent'},{id:2414,status:'absent'},{id:9999,status:'absent'}]});
   if(path==='/api/course/20290/courseware-activities')return json([...['课程介绍','图像增强','相机模型','house 数据集'].map((title,i)=>({id:3000+i,type:'material',title,published:true})),...[5956,2413,2414].map(id=>({id,type:'homework',published:true})),{id:9999,type:'homework',title:'尚未发布的题目',published:false}]);
   const attachment={id:4001,reference_id:5001,name:'lecture.txt',size:17,type:'file',allow_download:true};
   if(/^\/api\/activities\/(300\d|2413)\/resources$/.test(path))return json({uploads:[attachment,{name:'deleted.pdf',deleted:true}]});
   if(path==='/api/activities/2413')return json({id:2413,course_id:20290,type:'homework',title:'相机标定',published:true,is_in_progress:true,non_submit_times:true,user_submit_count:submitted?1:0,end_time:iso(now+86400000),data:{description:'<h3>实验要求</h3><p>实现相机标定并提交代码。</p><table><tr><td>输入</td><td>合成图像</td></tr></table><script>window.evilExecuted=true</script><img src="javascript:alert(1)" onerror="window.evilExecuted=true"><a href="javascript:alert(1)">坏链接</a>',homework_type:'file_upload',mode:'normal'},uploads:[attachment]});
   if(path==='/api/activities/2413/students/7/submission_list')return json({list:submitted?[submitted]:[]});
   if(path==='/api/uploads'&&req.method()==='POST'){assert.equal(req.headers()['x-xsrf-token'],'fixture csrf');assert.equal(req.postDataJSON().name,'answer.zip');return json({id:9001,upload_url:'https://zy-media.bit.edu.cn/upload/file/9001',storage_type:'MEDIA',transcoder:'MEDIA'});}
   if(path==='/api/uploads/9001')return json({id:9001,status:'ready'});
   if(path==='/api/course/activities/2413/submissions'&&req.method()==='POST'){submissionPosts++;assert.deepEqual(req.postDataJSON().uploads,[9001]);submitted={id:9002,comment:req.postDataJSON().comment,is_draft:false,created_at:iso(now),uploads:[{...attachment,id:9001,reference_id:9003,name:'answer.zip'}]};return json({submission:{id:9002}});}
   if(path==='/api/uploads/reference/5001/blob')return route.fulfill({contentType:'text/plain',headers:{'Content-Disposition':'attachment; filename=lecture.txt'},body:'synthetic lecture'});
   if(!path.startsWith('/api/'))return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>新乐学测试页<span id="userId" data-id="7"></span></body></html>'});
  }
  if(u.hostname==='www.yanhekt.cn')return route.fulfill({contentType:'text/html',body:nativeHtml});
  if(u.hostname==='cbiz.yanhekt.cn'){
   assert.equal(req.headers().authorization,`Bearer ${oldToken}`);
   if(path==='/v2/live/list')return json({code:0,data:{data:[],last_page:1,total:0}});
   const sessionId=u.searchParams.get('session_id'),courseId=u.searchParams.get('course_id')||u.searchParams.get('id');
   const sessionCourse=sessionId==='281490'?30226:['71990','72000'].includes(sessionId)?9397:71988;
   const identities={71990:['（英）材料电化学理论与应用','张存中'],9397:['离散数学Ⅱ','何雨果'],30226:['机器学习实践','李侃']};
   const sessionRows=(courseId==='30226'?[[281490,201]]:courseId==='9397'?[[71990,301],[72000,302]]:[[920536,200]]).map(([id,videoId])=>({id,title:'旧站课次回放',started_at:'2024-09-22 08:00:00',videos:[{id:videoId,duration:5,main:'https://cvideo.yanhekt.cn/play/test.m3u8',vga:'https://cvideo.yanhekt.cn/play/test.m3u8'}]}));
   const data=path==='/v1/user'?{id:7,badge:'fixture-badge'}:path==='/v1/auth/video/token'?{token:'video_fixture',now:100,expired_at:700}:
    path==='/v1/live'?{id:Number(u.searchParams.get('id')),status:legacyStatus,title:'旧版直播测试',schedule_started_at:iso(now-60000),schedule_ended_at:iso(now+3600000),target:u.searchParams.get('id')==='788580'?'https://live.yanhekt.cn/play/test.flv':'https://live.yanhekt.cn/play/test.m3u8',target_vga:'https://live.yanhekt.cn/play/test.m3u8',session_id:'920536',course:{id:71988,name_zh:'（英）纳米材料与物理'},session:{id:920536,course_id:71988}}:
    path==='/v2/course/private/list'?{data:[{id:71988,name_zh:'（英）纳米材料与物理',professors:[{name:'张教授'}],school_year:'2024-2025',semester:1}],last_page:1,total:1}:
    path==='/v1/course/session'?{id:Number(sessionId),course_id:sessionCourse}:
    path==='/v1/course'?{id:Number(u.searchParams.get('id')),name_zh:identities[courseId]?.[0]||'（英）纳米材料与物理',professors:[{name:identities[courseId]?.[1]||'张教授'}],school_year:'2024-2025',semester:1}:
    path==='/v2/course/session/list'?sessionRows:path==='/v1/video/subtitle/list'?[]:undefined;
   if(data!==undefined)return json({code:0,data});
  }
  if(u.hostname==='aita.yanhekt.cn'){
   if(!/^\/(userapi|courseapi|coursesourceapi|vlabpassportapi|spidermaterial|play|fixture)\//.test(path))return route.fulfill({contentType:'text/html',body:nativeHtml});
   if(path==='/userapi/v1/infosimple')return json({code:200,params:{id:123,tenant_id:21,phone:'13000001234',account:'student-fixture'}});
   if(offline&&path.startsWith('/courseapi/'))return route.fulfill({status:503,body:''});
   if(path==='/vlabpassportapi/v1/account-profile/course')return json({code:1000,params:{result:{data:[current,live,iot,...(crossCourse?[{id:910001,title:'操作系统',realname:'老师乙',term_name:'2026-2027-1',zhiyuan_id:20291},{id:910002,title:'计算机组成与原理',realname:'老师丙',term_name:'2026-2027-1',zhiyuan_id:20292}]:[])].map(r=>({Id:r.id,Title:r.title,Teacher:r.realname,TermName:r.term_name,kkxy_name:r.kkxy_name,zhiyuan_id:r.zhiyuan_id})),total:3}}});
   if(path==='/vlabpassportapi/v1/course/term-list')return json({code:1000,params:{list:[{id:1,term_name:'2026-2027-1'}]}});
   if(path==='/vlabpassportapi/v1/user/structures')return json({code:1000,params:{data:[{id:1,display_name:'计算机学院'}]}});
   if(path.endsWith('/get-course-list')){const q=u.searchParams.get('title')||'',rows=(q==='分页课程'?[{id:99000,title:q,realname:'分页老师',term_name:'2026-2027-1'},{id:99001,title:q,realname:'分页老师',term_name:'2025-2026-1'}]:[current,live,iot]).filter(c=>c.title.includes(q));return json({code:0,data:{list:rows,total:rows.length}});}
   if(path.endsWith('/get-my-course-day'))return json({code:0,list:{day:{course:[{...live,course_id:live.id,sub_id:1630190,course_begin:iso(now-1200000),course_over:iso(now+2400000),room_name:'中教 101',sub_status:'1'},{...current,course_id:current.id,sub_id:1600001,course_begin:iso(now+7200000),course_over:iso(now+12600000),room_name:'综教 503',sub_status:'2'}]}}});
   if(path.endsWith('/get-course-detail')){const n=Number(u.searchParams.get('course_id')),c=n===102154?live:n===110118?iot:crossCourse&&n===910001?{title:'操作系统',term_name:'2026-2027-1',zhiyuan_id:20291}:crossCourse&&n===910002?{title:'计算机组成与原理',term_name:'2026-2027-1',zhiyuan_id:20292}:current;return json({code:0,data:{...c,id:n,sub_list:n===102154?[liveRow]:[replay(1600001,'2026-09-22第8-9节',10),replay(1600002,'2026-09-29第8-9节',20)]}});}
   if(path.endsWith('/get-course-teacher-others'))return json({code:0,data:[{id:1042,title:'cs',realname:'超级管理员'},{...current,id:999001,term_name:'2024-2025-1'}]});
   if(path.endsWith('/get-course-resource'))return json({code:0,data:u.searchParams.get('course_id')==='110118'?[{id:1,resource_id:'8001',resource_name:'智能物联网 · 课程大纲',resource_suffix:'txt',resource_size:17}]:[]});
   if(path==='/spidermaterial/spider-material/web/download/dlUrl')return json({state:200,data:'https://aita.yanhekt.cn/fixture/outline.txt'});
   if(path==='/fixture/outline.txt')return route.fulfill({contentType:'text/plain',headers:{'Content-Disposition':'attachment; filename=outline.txt'},body:'synthetic outline'});
   if(path.endsWith('/get-sub-info'))return json({code:0,data:u.searchParams.get('sub_id')==='1630190'?{sub_type:'course_live',sub_status:'1',sub_title:liveRow.sub_title,live_url:{output:{m3u8:'https://aita.yanhekt.cn/play/test.m3u8'},output_ppt:{m3u8:'https://aita.yanhekt.cn/play/test.m3u8'}}}:{duration:120,video_list:{screen:{type:2,status:2,preview_url:'https://aita.yanhekt.cn/play/timing.mp4'},room:{type:3,status:2,preview_url:'https://aita.yanhekt.cn/play/timing-room.mp4'}}}});
   if(path.startsWith('/coursesourceapi/course/study-auth/'))return json({code:200,data:{hasPermission:false}});
   if(path.endsWith('/search-trans-result'))return json({code:0,list:[{all_content:[{BeginSec:0,EndSec:2.9,Text:'我们先来看相机模型。'},{BeginSec:3,EndSec:5,Text:'从世界坐标映射到像素坐标。'},{BeginSec:68,EndSec:70,Text:'接下来讨论相机的内参矩阵。'},...Array.from({length:100},(_,i)=>({BeginSec:100+i*5,EndSec:104+i*5,Text:`针孔成像模型与投影变换，第 ${i+1} 个知识点。`}))]}]});
  }
  if((u.hostname==='aita.yanhekt.cn'||u.hostname==='cvideo.yanhekt.cn'||u.hostname==='live.yanhekt.cn')&&path.startsWith('/play/')){
   const name=basename(path);if(roomBroken&&name==='timing-room.mp4')return route.fulfill({status:404,body:''});if(!/^(?:timing(?:-room)?\.mp4|test(?:\.m3u8|\.flv|\d{3}\.ts))$/.test(name))throw new Error('unexpected media fixture');
   let data=await readFile(join(fixture,name));const headers={'Accept-Ranges':'bytes'},type=name.endsWith('.mp4')?'video/mp4':name.endsWith('.m3u8')?'application/vnd.apple.mpegurl':name.endsWith('.flv')?'video/x-flv':'video/mp2t';
   const range=req.headers().range?.match(/^bytes=(\d+)-(\d*)$/);if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),data.length-1):data.length-1;headers['Content-Range']=`bytes ${start}-${end}/${data.length}`;data=data.subarray(start,end+1);return route.fulfill({status:206,contentType:type,headers,body:data});}
   return route.fulfill({status:200,contentType:type,headers,body:data});
  }
  unexpected.push(u.hostname+path);return route.fulfill({status:404,body:''});
 });

 page=await context.newPage();await visit(page,'https://aita.yanhekt.cn/portal/#/');
 await page.locator('.lesson').first().waitFor({timeout:45000});assert.equal(new URL(page.url()).origin,'https://aita.yanhekt.cn');assert.equal(await page.locator('#original-input').count(),0);assert.equal(context.pages().filter(p=>p.url().startsWith('chrome-extension:')).length,0);
 report.checks.push('opening the original portal renders the new UI directly without a standalone tab or duplicate native UI');
 assert.equal(await page.getByRole('link',{name:'旧版直播',exact:true}).count(),0);
 await page.setViewportSize({width:2560,height:1440});await page.screenshot({path:join(output,'site-today.png'),fullPage:true,timeout:10000});await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('link',{name:'课程',exact:true}).first().click();await page.locator('.course-row').first().waitFor();assert.match(page.url(),/personal/);
 await page.locator('[data-course-key="modern:21:102178"] .course-title').click();assert.match(page.url(),/coursedetail\?course_id=102178/);
 let frame=await watchFrame(page);await frame.locator('.lecture-item').first().click();await frame.waitForFunction(()=>!document.getElementById('play').disabled);assert.equal(requests.filter(r=>r.path.startsWith('/play/')).length,0);
 await frame.locator('#play').click();await frame.waitForFunction(()=>document.querySelector('video').currentTime>.2&&document.querySelector('video').videoWidth>0,null,{timeout:15000});await frame.locator('#video').evaluate(v=>{v.pause();v.currentTime=90;});
 await frame.locator('#subtitle-calibration summary').click();await frame.locator('#subtitle-offset').fill('22');await frame.locator('.offset-apply').click();await frame.waitForFunction(()=>document.querySelector('.subtitle-item.active')?.textContent.includes('内参矩阵'));
 assert.equal(await frame.locator('.subtitle-item.active time').innerText(),'1:30');report.checks.push('original course URL contains the real embedded MP4 player with working +22-second subtitle calibration');
 await frame.locator('#dual').click();await frame.waitForFunction(()=>document.getElementById('secondary-video').readyState>=2);
 await frame.locator('#video').evaluate(v=>{v.currentTime=30;v.playbackRate=1.5;});await frame.waitForFunction(()=>Math.abs(document.getElementById('video').currentTime-document.getElementById('secondary-video').currentTime)<.5);
 await frame.locator('#video').evaluate(v=>v.play());await frame.waitForFunction(()=>!document.getElementById('secondary-video').paused&&document.getElementById('secondary-video').currentTime>30);
 await frame.locator('#control-settings').click();await frame.locator('#audio-source').selectOption('classroom');await frame.locator('#control-settings').click();assert.deepEqual(await frame.evaluate(()=>[document.getElementById('video').muted,document.getElementById('secondary-video').muted]),[true,false]);
 await frame.locator('#video').evaluate(v=>v.pause());await frame.waitForFunction(()=>document.getElementById('secondary-video').paused);assert.equal(await frame.locator('#secondary-video').evaluate(v=>v.playbackRate),1.5);
 await page.setViewportSize({width:2560,height:1440});await frame.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:join(output,'site-dual-wide.png'),fullPage:true});const width=await page.locator('iframe').evaluate(e=>e.getBoundingClientRect().width);assert.ok(width>2100);
 await frame.locator('#toggle-lectures').click();await frame.locator('#toggle-subtitles').click();assert.equal(await frame.locator('.lecture-pane').isVisible(),false);assert.equal(await frame.locator('.transcript-pane').isVisible(),false);await frame.locator('#toggle-lectures').click();await frame.locator('#toggle-subtitles').click();
 for(const size of [{width:3840,height:1800},{width:1920,height:1080},{width:1024,height:900},{width:768,height:900},{width:375,height:900}]){
 await page.setViewportSize(size);await frame.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.ok(await frame.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+3),'embedded content must fit without a second vertical scrollbar');
 if(size.width===3840||size.width===375)await page.screenshot({path:join(output,'dual-'+size.width+'.png'),fullPage:true});
 }
 await page.setViewportSize({width:2560,height:1440});await frame.locator('#dual').click();assert.equal(await frame.locator('#secondary-video').getAttribute('src'),null);
 roomBroken=true;await frame.locator('#dual').click();await frame.waitForFunction(()=>document.getElementById('dual').getAttribute('aria-pressed')==='false');assert.ok(await frame.locator('#video').evaluate(v=>v.readyState>=2));roomBroken=false;
 report.checks.push('dual playback synchronizes seek/pause/rate, keeps one audio source, releases unused media and preserves the primary when the second stream fails');
 await page.screenshot({path:join(output,'site-course.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
 const courseReads=requests.filter(r=>r.path.endsWith('/get-course-detail')).length;
 await page.getByRole('tab',{name:'同师往年',exact:true}).click();await page.locator('.course-row').first().waitFor();assert.ok(await page.locator('.course-row').count()>=20);assert.equal(await page.locator('[data-course-key^="legacy:"]').count(),0);const historyUrl=page.url();
 await page.goBack();frame=await watchFrame(page);await frame.locator('.lecture-item.selected').waitFor();assert.equal(requests.filter(r=>r.path.endsWith('/get-course-detail')).length,courseReads);
 assert.equal(await frame.locator('.lecture-item.selected').getAttribute('data-id'),'1600001');
 await frame.locator('#refresh-list').click();await frame.locator('.lecture-item.selected').waitFor();assert.equal(requests.filter(r=>r.path.endsWith('/get-course-detail')).length,courseReads+1);
 report.checks.push('returning to the player reuses its replay list and last selected lesson; explicit refresh fetches a fresh list');
 const restored=new URL(await page.getByRole('link',{name:'恢复原版',exact:true}).getAttribute('href'));restored.searchParams.delete('yh_native');restored.searchParams.delete('yh_mode');assert.equal(restored.href,page.url());await page.goForward();await page.locator('.course-row').first().waitFor();assert.equal(page.url(),historyUrl);report.checks.push('course detail tabs support real browser back and forward navigation');
 await page.getByRole('tab',{name:'同课老师',exact:true}).click();await page.locator('[data-course-key="modern:21:73694"]').waitFor();assert.equal(await page.locator('[data-course-key^="legacy:"]').count(),0);
 await page.getByRole('searchbox',{name:'搜索课程、教师或链接'}).fill('73694');await page.getByRole('searchbox',{name:'搜索课程、教师或链接'}).press('Enter');await page.locator('[data-course-key="modern:21:73694"]').waitFor();assert.equal(await page.locator('.course-row').count(),1);assert.match(page.url(),/searchContent/);
 assert.equal(await page.locator('[data-course-key^="legacy:"]').count(),0);await page.getByRole('link',{name:'打开旧版课次 73694',exact:true}).waitFor();
 report.checks.push('school-wide discovery and related courses exclude the withdrawn legacy table even when old rows remain cached; numeric queries offer a separate session entry');
 await page.getByRole('link',{name:'资料',exact:true}).click();await page.locator('.material-row').first().waitFor();assert.equal(await page.locator('.material-row').count(),5);await page.getByRole('button',{name:'附件',exact:true}).first().click();await page.locator('.attachment-row').waitFor();await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('link',{name:'待办',exact:true}).click();await page.locator('.task-row').first().waitFor();assert.equal(await page.locator('.task-row').count(),2);report.checks.push('in-site materials and tasks read through the extension bridge without exposing unpublished tasks or credentials');
 await page.getByRole('button',{name:'相机标定',exact:true}).click();await page.getByRole('heading',{name:'实验要求',exact:true}).waitFor();
 assert.equal(await page.locator('.rich-content script,.rich-content [onerror],.rich-content [href^="javascript:"]').count(),0);assert.equal(submissionPosts,0);
 await page.getByRole('button',{name:'下载',exact:true}).click();await page.getByRole('button',{name:'已下载',exact:true}).waitFor({timeout:20000});
 const downloads=await worker.evaluate(()=>chrome.downloads.search({}));assert.equal(downloads.length,1);assert.equal(downloads[0].state,'complete');assert.ok(resolve(downloads[0].filename).startsWith(resolve(testRoot)));assert.equal(await readFile(downloads[0].filename,'utf8'),'synthetic attachment');
 await page.getByRole('textbox',{name:'作业内容',exact:true}).fill('合成作业回答 <tag>');
 await page.getByLabel('选择作业附件').setInputFiles({name:'answer.zip',mimeType:'application/zip',buffer:Buffer.from('synthetic answer')});
 assert.equal(requests.filter(r=>r.method==='POST'||r.method==='PUT').length,0,'selecting a local file does not upload it');
 await page.screenshot({path:join(output,'site-task.png'),fullPage:true});await page.setViewportSize({width:375,height:900});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('#resources-dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
 await page.screenshot({path:join(output,'site-task-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'提交作业',exact:true}).click();await page.getByText('提交记录 · 1',{exact:true}).waitFor();assert.equal(submissionPosts,1);assert.equal(await page.locator('.submission-entry .rich-content').innerText(),'合成作业回答 <tag>');
 assert.match(await page.locator('.submission-entry .attachment-name').innerText(),/answer\.zip/);await page.getByRole('button',{name:'关闭',exact:true}).click();
 report.checks.push('assignment content is sanitized; selecting files does not upload; synthetic multipart upload + CSRF + receipt-checked submission work in place at desktop/mobile widths');
 await page.getByRole('link',{name:'资料',exact:true}).click();await page.locator('.material-row').first().waitFor();await page.getByLabel('课程',{exact:true}).selectOption('lms:20290');
 await page.getByRole('button',{name:'下载本课全部资料附件'}).click();await page.getByText('已下载 1 / 1',{exact:true}).waitFor({timeout:20000});await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByLabel('课程',{exact:true}).selectOption('modern:21:110118');await page.getByRole('button',{name:'下载本课全部资料附件'}).click();await page.getByText('已下载 1 / 1',{exact:true}).waitFor({timeout:20000});await page.getByRole('button',{name:'关闭',exact:true}).click();
 assert.equal((await worker.evaluate(()=>globalThis.fixtureDownloads)).length,3);report.checks.push('single/batch attachment downloads save synthetic bytes through Chromium, deduplicate references and support both LMS and modern resource IDs');
 await visit(page,'https://aita.yanhekt.cn/coursedetail?course_id=102178&tenant_code=21&yh_tab=materials');
 await page.getByLabel('乐学平台',{exact:true}).selectOption('lexue');await page.getByText('旧乐学未连接',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('乐学平台',{exact:true}).locator('option[value="lexue"]').count(),1);assert.equal(await page.getByLabel('关联乐学课程',{exact:true}).isDisabled(),true);assert.equal(await page.getByText('暂无已发布资料',{exact:true}).count(),0);
 lexueConnected=true;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.getByLabel('关联乐学课程',{exact:true}).locator('option[value="lexue:20290"]').waitFor({state:'attached'});await page.getByLabel('关联乐学课程',{exact:true}).selectOption('lexue:20290');await page.getByRole('button',{name:'旧乐学文件夹',exact:true}).waitFor();
 await page.screenshot({path:join(output,'site-lexue-recovered.png'),fullPage:true});
 report.checks.push('both LMS platforms remain selectable after old-site login failure; returning after login refreshes course options without a full page reload');
 await page.getByRole('link',{name:'资料',exact:true}).click();await page.getByLabel('课程',{exact:true}).locator('option[value="lexue:20290"]').waitFor({state:'attached'});await page.getByLabel('课程',{exact:true}).selectOption('lexue:20290');await page.getByRole('button',{name:'旧乐学文件夹',exact:true}).waitFor();assert.equal(await page.locator('.material-row').count(),2);
 await page.getByRole('button',{name:'旧乐学文件夹',exact:true}).click();await page.getByText('helper.pdf',{exact:true}).waitFor();assert.equal(await page.locator('.attachment-row').count(),2);await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'下载本课全部资料附件'}).click();await page.getByText('已下载 2 / 2',{exact:true}).waitFor({timeout:20000});await page.getByRole('button',{name:'关闭',exact:true}).click();assert.equal((await worker.evaluate(()=>globalThis.fixtureDownloads)).length,5);
 await page.getByRole('link',{name:'待办',exact:true}).click();await page.getByLabel('课程',{exact:true}).selectOption('lexue:20290');await page.getByRole('button',{name:'旧乐学示例作业',exact:true}).click();await page.getByRole('heading',{name:'旧乐学作业正文',exact:true}).waitFor();assert.equal(await page.locator('.submission-form').count(),0);assert.equal(await page.getByRole('link',{name:'在旧乐学提交',exact:true}).count(),1);assert.equal(await page.locator('.task-attachments .attachment-row').count(),1);assert.equal(await page.evaluate(()=>window.moodleInjection),undefined);
 await page.getByRole('button',{name:'下载',exact:true}).click();await page.getByRole('button',{name:'已下载',exact:true}).waitFor({timeout:20000});await page.setViewportSize({width:375,height:900});assert.equal(await page.locator('#resources-dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.screenshot({path:join(output,'site-lexue-task-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByLabel('课程',{exact:true}).selectOption('lms:20290');assert.equal(await page.getByRole('button',{name:'旧乐学示例作业',exact:true}).count(),0);assert.equal(submissionPosts,1);assert.equal((await worker.evaluate(()=>globalThis.fixtureDownloads)).length,6);
 await page.getByRole('link',{name:'课程',exact:true}).first().click();await page.getByRole('heading',{name:'旧乐学课程',exact:true}).waitFor();await page.getByRole('link',{name:'旧乐学示例课程',exact:true}).click();await page.getByRole('button',{name:'旧乐学文件夹',exact:true}).waitFor();assert.match(page.url(),/yh_course=lexue%3A20290/);
 await visit(page,'https://aita.yanhekt.cn/coursedetail?course_id=102178&tenant_code=21&yh_tab=materials');await page.getByLabel('乐学平台',{exact:true}).selectOption('lexue');await page.getByLabel('关联乐学课程',{exact:true}).selectOption('lexue:20290');await page.getByRole('button',{name:'旧乐学文件夹',exact:true}).waitFor();assert.equal((await worker.evaluate(()=>chrome.storage.local.get('desk:bindings')))['desk:bindings']['modern:21:102178'].lexue.id,'20290');assert.equal(await page.getByRole('button',{name:'旧乐学示例作业',exact:true}).count(),1);
 report.checks.push('old Moodle courses, folders, direct files and assignment attachments sync in place; colliding LMS IDs remain separate, downloads deduplicate and submissions retain the official Moodle action');
 await page.getByRole('link',{name:'更多',exact:true}).click();await page.getByRole('heading',{name:'更多',exact:true}).waitFor();await page.screenshot({path:join(output,'site-more.png'),fullPage:true});assert.equal(await page.getByRole('link',{name:'我的笔记',exact:true}).count(),1);
 await page.getByRole('link',{name:'我的笔记',exact:true}).click();await page.getByRole('heading',{name:'原站功能',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.nativeStarted),true);await page.getByRole('textbox',{name:'原站输入'}).fill('保留原站操作');await page.getByRole('button',{name:'原站操作'}).click();await page.getByRole('button',{name:'已操作'}).waitFor();report.checks.push('secondary features are collected in More and their original native application still works');
 await page.getByRole('link',{name:'返回延河课堂焕新版'}).click();await page.locator('.course-row').first().waitFor();await page.getByRole('link',{name:'恢复原版',exact:true}).click();await page.getByRole('heading',{name:'原站功能',exact:true}).waitFor();assert.ok(new URL(page.url()).searchParams.has('yh_native'));report.checks.push('restore-original mode returns to the current native route without modifying account state');
 await page.getByRole('link',{name:'返回延河课堂焕新版'}).click();await page.locator('.course-row').first().waitFor();
 await visit(page,'https://aita.yanhekt.cn/portal/?token=opaque-login-fixture');await page.getByRole('heading',{name:'原站功能',exact:true}).waitFor();assert.equal(await page.locator('#yanhe-refine').count(),0);report.checks.push('login and SSO callback routes remain native');
 await visit(page,'https://aita.yanhekt.cn/livingroom?course_id=102154&sub_id=1630190&tenant_code=21');frame=await watchFrame(page);await frame.waitForFunction(()=>!document.getElementById('play').disabled);
 // Retain actual playback progress: the five-second fixture can end and clear
 // currentTime before a busy browser processes the next Playwright poll.
 await frame.evaluate(()=>{globalThis.fixtureLiveMaxTime=0;const video=document.getElementById('video');video.addEventListener('timeupdate',()=>{globalThis.fixtureLiveMaxTime=Math.max(globalThis.fixtureLiveMaxTime,video.currentTime);});});
 await frame.locator('#play').click();await frame.waitForFunction(()=>globalThis.fixtureLiveMaxTime>.2,null,{timeout:15000});await frame.locator('#video').evaluate(v=>v.pause());assert.equal(new URL(page.url()).pathname,'/livingroom');report.checks.push('an original live link plays HLS in place and preserves its course/sub IDs');
 const old=await context.newPage();await visit(old,'https://www.yanhekt.cn/home?yh_native=1');await old.getByRole('heading',{name:'原站功能',exact:true}).waitFor();await old.evaluate(t=>localStorage.setItem('auth',JSON.stringify({token:t,login:true})),oldToken);await visit(old,'https://www.yanhekt.cn/live/788579');await old.getByRole('heading',{name:'（英）纳米材料与物理',exact:true}).waitFor();const oldFrame=await watchFrame(old);await oldFrame.waitForFunction(()=>!document.getElementById('play').disabled);await oldFrame.locator('#play').click();await oldFrame.waitForFunction(()=>document.getElementById('video').currentTime>.2);await oldFrame.locator('#video').evaluate(v=>v.pause());assert.ok(old.url().includes('yh_live=788579'));assert.equal(new URL(old.url()).hostname,'www.yanhekt.cn');report.checks.push('legacy live links retain the live identity and play the platform target HLS stream');await visit(old,'https://www.yanhekt.cn/live/788580');let flvFrame=await watchFrame(old);await flvFrame.waitForFunction(()=>!document.getElementById('play').disabled);await flvFrame.locator('#play').click();await flvFrame.waitForFunction(()=>document.getElementById('video').currentTime>.2);await flvFrame.locator('#video').evaluate(v=>v.pause());
 legacyStatus=2;await visit(old,'https://www.yanhekt.cn/live/788579');legacyStatus=3;const endedFrame=await watchFrame(old);await endedFrame.getByText('直播已结束',{exact:true}).first().waitFor();assert.equal(await endedFrame.locator('#play').isDisabled(),true);
 await visit(old,'https://www.yanhekt.cn/session/920536');const oldReplay=await watchFrame(old);await oldReplay.waitForFunction(()=>!document.getElementById('play').disabled);await oldReplay.locator('#play').click();await oldReplay.waitForFunction(()=>document.getElementById('video').currentTime>.2);await oldReplay.locator('#video').evaluate(v=>v.pause());await visit(old,'https://www.yanhekt.cn/profile/myCourse');await old.locator('[data-course-key="legacy:21:71988"]').waitFor();report.checks.push('legacy FLV playback, ended-state handling and enrolled legacy course list are supported');
 await visit(old,'https://www.yanhekt.cn/course/73694');await old.locator('iframe').waitFor();
 assert.equal(new URL(old.url()).origin,'https://www.yanhekt.cn');assert.equal(new URL(old.url()).pathname,'/course/73694');
 const discovered=await watchFrame(old);assert.equal(new URL(discovered.url()).searchParams.get('legacy'),'73694');await discovered.locator('.lecture-item').first().click();await discovered.waitForFunction(()=>!document.getElementById('play').disabled);await discovered.locator('#play').click();await discovered.waitForFunction(()=>document.getElementById('video').currentTime>.2);await discovered.locator('#video').evaluate(v=>v.pause());
 await old.getByRole('searchbox',{name:'搜索课程、教师或链接'}).fill('https://www.yanhekt.cn/session/281490');await old.getByRole('searchbox',{name:'搜索课程、教师或链接'}).press('Enter');
 await old.waitForURL(u=>u.pathname==='/session/281490');
 const sessionReplay=await watchFrame(old);await sessionReplay.waitForFunction(()=>document.querySelector('.lecture-item.selected')?.dataset.id==='281490:201');
 await sessionReplay.locator('#play').click();await sessionReplay.waitForFunction(()=>document.getElementById('video').currentTime>.2);await sessionReplay.locator('#video').evaluate(v=>v.pause());
 await old.getByRole('heading',{name:'机器学习实践',exact:true}).waitFor();assert.equal(new URL(old.url()).pathname,'/session/281490');
 await old.screenshot({path:join(output,'site-legacy-replay.png'),fullPage:true});report.checks.push('legacy discovery opens the old-platform player; the /session/281490 route resolves the session and decodes synthetic HLS');await old.close();
 const identity=await context.newPage();await visit(identity,'https://www.yanhekt.cn/course/71990');await identity.getByRole('heading',{name:'（英）材料电化学理论与应用',exact:true}).waitFor();
 await identity.getByRole('searchbox',{name:'搜索课程、教师或链接'}).fill('71990');await identity.getByRole('searchbox',{name:'搜索课程、教师或链接'}).press('Enter');await identity.getByRole('link',{name:'打开旧版课次 71990',exact:true}).click();
 let identityFrame=await watchFrame(identity);await identityFrame.locator('.lecture-item.selected[data-id="71990:301"]').waitFor();await identity.getByRole('heading',{name:'离散数学Ⅱ',exact:true}).waitFor();
 assert.equal(new URL(identity.url()).pathname,'/session/71990');assert.match(await identity.getByRole('link',{name:'原站',exact:true}).getAttribute('href'),/\/session\/71990/);
 await identity.getByRole('tab',{name:'同课老师',exact:true}).click();await identity.getByRole('tab',{name:'观看',exact:true}).click();identityFrame=await watchFrame(identity);await identityFrame.locator('.lecture-item.selected[data-id="71990:301"]').waitFor();
 await identityFrame.locator('.lecture-item[data-id="72000:302"]').click();await identity.waitForURL(u=>u.pathname==='/session/72000');assert.equal(await watchFrame(identity),identityFrame);
 await identity.reload();identityFrame=await watchFrame(identity);await identityFrame.locator('.lecture-item.selected[data-id="72000:302"]').waitFor();
 await identity.screenshot({path:join(output,'site-session-identity.png'),fullPage:true});await identity.close();report.checks.push('course/71990 and session/71990 open different subjects; session identity survives tabs, selection changes and reload without recreating the active player');
 await visit(page,'https://aita.yanhekt.cn/coursedetail?course_id=102178&sub_id=1600001&tenant_code=21');frame=await watchFrame(page);await frame.locator('.subtitle-item').first().waitFor();await page.setViewportSize({width:375,height:900});await frame.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:join(output,'site-course-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.checks.push('375px in-site UI and embedded player have no horizontal overflow');
 // Reproduce stale OS/architecture links while returning to a vision lecture.
 crossCourse=true;
 await worker.evaluate(()=>chrome.storage.local.set({'desk:bindings':{},'desk:mappings':{'modern:21:102178':'20291'}}));
 await visit(page,'https://aita.yanhekt.cn/coursedetail?course_id=102178&tenant_code=21&yh_tab=materials');await page.locator('#refresh').click();await page.getByRole('button',{name:'图像增强',exact:true}).waitFor();
 assert.equal(await page.getByLabel('关联乐学课程',{exact:true}).inputValue(),'20290');assert.equal(await page.getByRole('button',{name:'操作系统新资料',exact:true}).count(),0);
 await worker.evaluate(()=>chrome.storage.local.set({'desk:mappings':{'modern:21:102178':'lexue:20292'}}));await visit(page,'https://aita.yanhekt.cn/coursedetail?course_id=102178&tenant_code=21&yh_tab=materials&yh_source=lexue');
 await page.getByText('历史关联与当前课程不符，请重新选择',{exact:true}).waitFor();assert.equal(await page.getByLabel('关联乐学课程',{exact:true}).inputValue(),'');assert.equal(await page.locator('.material-row').count(),0);
 await page.getByLabel('关联乐学课程',{exact:true}).selectOption('lexue:20293');await page.getByRole('button',{name:'计算机视觉旧资料',exact:true}).waitFor();
 await page.getByLabel('乐学平台',{exact:true}).selectOption('lms');await page.getByRole('button',{name:'图像增强',exact:true}).waitFor();assert.equal(await page.getByLabel('关联乐学课程',{exact:true}).inputValue(),'20290');
 await page.getByLabel('乐学平台',{exact:true}).selectOption('lexue');await page.getByRole('button',{name:'计算机视觉旧资料',exact:true}).waitFor();assert.equal(await page.getByLabel('关联乐学课程',{exact:true}).inputValue(),'lexue:20293');
 for(const [id,title,lmsId] of [[910001,'操作系统','20291'],[910002,'计算机组成与原理','20292']]){
  await visit(page,`https://aita.yanhekt.cn/coursedetail?course_id=${id}&tenant_code=21&yh_tab=materials`);await page.getByRole('button',{name:title+'新资料',exact:true}).waitFor();
  await page.getByLabel('乐学平台',{exact:true}).selectOption('lexue');await page.getByLabel('关联乐学课程',{exact:true}).selectOption('lexue:'+lmsId);await page.getByRole('button',{name:title+'旧资料',exact:true}).waitFor();
 }
 await visit(page,'https://aita.yanhekt.cn/coursedetail?course_id=102178&tenant_code=21');await watchFrame(page);await page.getByRole('tab',{name:'资料与任务',exact:true}).click();await page.getByRole('button',{name:'计算机视觉旧资料',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'计算机组成与原理旧资料',exact:true}).count(),0);
 await page.getByLabel('乐学平台',{exact:true}).selectOption('lms');await page.getByRole('button',{name:'图像增强',exact:true}).waitFor();
 await page.screenshot({path:join(output,'site-course-isolation.png'),fullPage:true});
 report.checks.push('vision, operating systems and architecture keep separate old/new LMS associations; stale wrong-subject links are rejected and vision materials return after watching');
 // Hold an OS response, switch courses in the SPA, then release the old request.
 await visit(page,'https://aita.yanhekt.cn/coursedetail?course_id=910001&tenant_code=21&yh_tab=materials&yh_source=lms');await page.getByRole('button',{name:'操作系统新资料',exact:true}).waitFor();
 delayOperatingSystem=true;const started=new Promise(resolve=>operatingSystemStarted=resolve);await page.getByRole('button',{name:'重新读取新乐学',exact:true}).click();await started;
 await page.getByRole('link',{name:'课程',exact:true}).first().click();await page.locator('[data-course-key="modern:21:102178"] .course-title').click();await watchFrame(page);await page.getByRole('tab',{name:'资料与任务',exact:true}).click();await page.getByRole('button',{name:'图像增强',exact:true}).waitFor();
 const completed=context.waitForEvent('requestfinished',{predicate:r=>new URL(r.url()).pathname==='/api/course/20291/courseware-activities'});delayOperatingSystem=false;releaseOperatingSystem();await completed;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.getByRole('button',{name:'操作系统新资料',exact:true}).count(),0);assert.equal(await page.getByLabel('关联乐学课程',{exact:true}).inputValue(),'20290');
 report.checks.push('a delayed previous-course response cannot replace the current course materials or selection');
 const stored=JSON.stringify(await worker.evaluate(()=>chrome.storage.local.get(null)));assert.ok(!/desk-test-opaque|13000001234|video_fixture/.test(stored));assert.equal(await page.evaluate(()=>localStorage.getItem('desk:favorites')),null);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);report.checks.push('no page exceptions, real platform writes, stored credentials or private data in the host localStorage');report.ok=true;
}catch(error){report.ok=false;report.error=String(error.stack).replace(/https?:\/\/\S+/g,'[url]');process.exitCode=1;if(page){await page.screenshot({path:join(output,'site-failed.png'),fullPage:true}).catch(()=>{});report.visible=await page.locator('body').innerText().catch(()=>null);}report.players=await Promise.all(context.pages().flatMap(p=>p.frames()).filter(f=>f.url().includes('/watch/player.html')).map(f=>f.evaluate(()=>({status:document.getElementById('message')?.textContent,playback:document.getElementById('playback-status')?.textContent,stage:document.getElementById('stage-label')?.textContent,lectures:document.getElementById('lecture-list')?.textContent})).catch(()=>null)));}
finally{if(context)await context.close();if(dirname(resolve(testRoot))===resolve(tmpdir())&&basename(testRoot).startsWith('yanhe-refine-test-'))await rm(testRoot,{recursive:true,force:true});await writeFile(join(output,'site-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
