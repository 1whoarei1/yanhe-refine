import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,cp,rm} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const scratch=await mkdtemp(join(tmpdir(),'yanhe-tasks-')),ext=join(scratch,'extension'),out=join(root,'test-results');
await mkdir(out,{recursive:true});await cp(resolve(process.env.EXTENSION_PATH||join(root,'extension')),ext,{recursive:true});
const version=JSON.parse(await readFile(join(ext,'manifest.json'),'utf8')).version;
await writeFile(join(ext,'build-info.json'),JSON.stringify({version,catalog:null}));
const now=Date.now(),day=86400000,due=days=>now+days*day;
const cnDate=t=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t));
const oldCourses=[{id:601,fullname:'2026-2027第一学期-旧课程一',visible:true},{id:602,fullname:'2026-2027第一学期-旧课程二',visible:true},{id:603,fullname:'2025-2026第二学期-历史课程',visible:true},{id:604,fullname:'2027-2028第一学期-未来课程',visible:true}];
const assignments=[{id:901,courseId:601,title:'旧课程当前作业一',deadline:due(7)},{id:902,courseId:601,title:'旧课程当前作业二',deadline:due(18)},{id:903,courseId:602,title:'另一门旧课程当前作业',deadline:due(30)},{id:904,courseId:603,title:'历史课程补交任务',deadline:due(2)},{id:905,courseId:604,title:'未来学期任务',deadline:due(75)},...Array.from({length:4},(_,i)=>({id:910+i,courseId:601,title:'已过期旧作业'+i,deadline:due(-2-i)}))];
const expected=['新版当前作业',...assignments.slice(0,3).map(row=>row.title)].sort();
const shell=inside=>'<!doctype html><html><body>'+inside+'</body></html>';
const report={version,mode:'isolated browser; synthetic new/old LMS responses, no real course or submission requests',checks:[]};
let context,page,background,failedDetail=false,lexueConnected=false,slowNew=false,releaseNew,badNewCourses=false,badTermCatalog=false;
try{
 context=await chromium.launchPersistentContext(join(scratch,'profile'),{...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:process.platform==='win32'?{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}:{channel:'chromium'}),headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`],viewport:{width:1440,height:1000}});
 context.setDefaultTimeout(15000);
 const worker=background=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),errors=[],requests=[];
 await worker.evaluate(()=>{globalThis.fixtureCourseReads=[];chrome.runtime.onMessage.addListener(message=>{if(message.type==='REFINE_READ'&&message.operation==='lms'&&message.args?.method==='courses')globalThis.fixtureCourseReads.push(message.args.args);});});
 await context.addCookies([{name:'_token',value:'eyJfixture.tasks.signature',domain:'aita.yanhekt.cn',path:'/',secure:true}]);
 await context.route('https://**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname;requests.push({host:u.hostname,path,courseId:u.searchParams.get('id')});
  const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  const html=body=>route.fulfill({contentType:'text/html',body});
  assert.ok(req.method()==='GET'||(u.hostname==='lexue.bit.edu.cn'&&path==='/lib/ajax/service.php'&&req.method()==='POST'));
  if(u.hostname==='lexue.bit.edu.cn'){
   if(!lexueConnected)return html(shell('<form action="/login/index.php"><button id="loginbtn">Login</button></form>'));
   if(path==='/my/')return html(shell('<script>M.cfg={"wwwroot":"https://lexue.bit.edu.cn","sesskey":"fixtureTasks123"};</script>'));
   if(path==='/lib/ajax/service.php'){assert.equal(req.postDataJSON()[0].methodname,'core_course_get_enrolled_courses_by_timeline_classification');return json([{error:false,data:{courses:oldCourses,nextoffset:2}}]);}
   if(path==='/course/view.php'){
    const id=Number(u.searchParams.get('id'));return html(`<!doctype html><html><body class="course-${id}"><main id="region-main">${assignments.filter(row=>row.courseId===id).map(row=>`<li class="activity modtype_assign" id="module-${row.id}"><a href="/mod/assign/view.php?id=${row.id}"><span class="instancename">${row.title}</span></a></li>`).join('')}</main></body></html>`);
   }
   if(path==='/mod/assign/view.php'){
    const row=assignments.find(row=>row.id===Number(u.searchParams.get('id')));assert.ok(row);
    if(failedDetail&&row.id===903)return route.fulfill({status:503,contentType:'text/html',body:'Unavailable'});
    return html(shell(`<main id="region-main"><div id="intro">${row.title}</div><div class="submissionstatustable"><table><tr><th>提交状态</th><td>没有尝试</td></tr><tr><th>截止日期</th><td>${cnDate(row.deadline)}</td></tr></table></div></main>`));
   }
   throw Error('Unexpected Moodle path '+path);
  }
  if(u.hostname==='zy-eclass.bit.edu.cn'){
   if(path==='/api/my-courses'&&badNewCourses)return route.fulfill({status:503,contentType:'application/json',body:'{}'});
   if(badTermCatalog&&['/api/my-academic-years','/api/my-semesters-all','/api/my-semesters'].includes(path))return route.fulfill({status:503,contentType:'application/json',body:'{}'});
   if(path==='/api/my-courses')return json({courses:[{id:401,name:'新版课程',academic_year:{id:81},semester:{id:902}},...Array.from({length:54},(_,i)=>({id:402+i,name:'新版历史课程'+i,academic_year:80,semester:901}))]});
   if(path==='/api/my-academic-years')return json({academic_years:[{id:81,name:'2026-2027学年'},{id:80,name:'2025-2026学年'}]});
   if(path==='/api/my-semesters-all')return json({semesters:[{id:902,name:'2026-20271季学期',academic_year_id:81},{id:901,name:'2025-20262季学期',academic_year_id:80}]});
   if(path.endsWith('/homework-activities')){if(slowNew&&path.includes('/401/'))await new Promise(resolve=>releaseNew=resolve);return json({homework_activities:!path.includes('/401/')?[]:[{id:801,course_id:401,type:'homework',title:'新版当前作业',published:true,submitted:false,deadline:new Date(due(12)).toISOString()},{id:802,course_id:401,type:'homework',title:'已过期新版作业',published:true,submitted:false,deadline:new Date(due(-3)).toISOString()}],page:1,pages:1});}
   if(path.endsWith('/submission-status'))return json({homework_activities:[]});
   throw Error('Unexpected new LMS path '+path);
  }
  if(u.hostname==='aita.yanhekt.cn'){
   if(path.endsWith('/infosimple'))return json({code:200,params:{id:7,tenant_id:21,account:'fixture'}});
   if(path.endsWith('/account-profile/course'))return json({code:1000,params:{result:{data:[],total:0}}});
   if(path.endsWith('/get-my-course-day'))return json({code:0,list:{}});
   return html(shell('<h1>Native shell</h1>'));
  }
  throw Error('Unexpected host '+u.hostname);
 });
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const waitCount=async count=>page.waitForFunction(count=>document.querySelector('#yanhe-refine')?.shadowRoot?.querySelectorAll('.task-row').length===count,count);
 await page.goto('https://aita.yanhekt.cn/personal/?yh_view=tasks');await waitCount(1);
 await page.getByText('旧乐学未连接，旧乐学任务尚未同步',{exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:'登录旧乐学',exact:true}).getAttribute('href'),'https://lexue.bit.edu.cn/login/index.php');
 await page.goto('https://aita.yanhekt.cn/portal/#/');await page.getByText('旧乐学未连接',{exact:true}).waitFor();
 assert.equal(await page.locator('.task-mini').count(),1);
 report.checks.push('new LMS success does not conceal the independent old Moodle login failure on tasks or today; the old login link uses the actual Moodle login entry');
 lexueConnected=true;await page.bringToFront();await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.waitForFunction(()=>document.querySelector('#yanhe-refine')?.shadowRoot?.querySelectorAll('.task-mini').length===4);
 assert.equal(await page.getByText('旧乐学未连接',{exact:true}).count(),0);
 await page.goto('https://aita.yanhekt.cn/personal/?yh_view=tasks');await waitCount(4);
 report.observedAfterLogin=await page.locator('.task-row h3').allTextContents();
 assert.deepEqual(report.observedAfterLogin.sort(),expected);
 assert.equal(await page.getByLabel('学期',{exact:true}).inputValue(),'2026-2027-1');
 assert.ok(requests.some(r=>r.host==='lexue.bit.edu.cn'&&r.path==='/course/view.php'&&r.courseId==='601'));
 assert.ok(requests.some(r=>r.host==='lexue.bit.edu.cn'&&r.path==='/course/view.php'&&r.courseId==='602'));
 assert.equal(requests.some(r=>r.host==='lexue.bit.edu.cn'&&r.path==='/course/view.php'&&r.courseId==='603'),false);
 assert.equal(requests.some(r=>r.host==='zy-eclass.bit.edu.cn'&&r.path.includes('/402/')),false);assert.equal(requests.some(r=>r.host==='lexue.bit.edu.cn'&&r.path==='/course/view.php'&&r.courseId==='604'),false);
 assert.equal(requests.some(r=>r.host==='zy-eclass.bit.edu.cn'&&/\/api\/courses\/4(?:0[2-9]|[1-5]\d)\//.test(r.path)),false);
 assert.ok(requests.some(r=>r.host==='zy-eclass.bit.edu.cn'&&r.path==='/api/my-semesters-all'));
 report.checks.push('55 ID-only courses resolve through dictionaries using the screenshot label 2026-20271季学期; the current term yields four synthetic tasks while all 54 historical LMS courses remain unscanned');
 await page.getByLabel('资料来源',{exact:true}).selectOption('lexue');await waitCount(3);
 assert.ok((await page.locator('.task-row h3').allTextContents()).every(t=>t!=='新版当前作业'));
 await page.getByLabel('资料来源',{exact:true}).selectOption('all');await waitCount(4);
 assert.equal(await page.getByLabel('学期',{exact:true}).inputValue(),'2026-2027-1');
 await Promise.all([context.waitForEvent('request',{predicate:req=>new URL(req.url()).pathname==='/course/view.php'&&new URL(req.url()).searchParams.get('id')==='603'}),page.getByLabel('学期',{exact:true}).selectOption('')]);await waitCount(6);
 await page.getByLabel('学期',{exact:true}).selectOption('2026-2027-1');await waitCount(4);
 report.checks.push('switching platforms preserves the current term; historical details load only after explicitly selecting all terms');
 await page.goto('https://aita.yanhekt.cn/portal/#/');await page.waitForFunction(()=>document.querySelector('#yanhe-refine')?.shadowRoot?.querySelectorAll('.task-mini').length===4);
 assert.deepEqual((await page.locator('.task-mini button').allTextContents()).sort(),expected);
 report.checks.push('today shows the same four current-term tasks, without leaking a previously cached historical task');
 failedDetail=true;
 await page.goto('https://aita.yanhekt.cn/personal/?yh_view=tasks');await waitCount(4);
 await page.getByRole('button',{name:'刷新当前页',exact:true}).click();await page.getByText('部分作业详情未同步',{exact:false}).first().waitFor();await waitCount(4);
 assert.ok((await page.locator('.task-row').filter({hasText:'另一门旧课程当前作业'}).innerText()).includes('待同步'));
 report.checks.push('a failed old assignment detail remains visible as unknown with a partial-sync warning instead of disappearing');
 failedDetail=false;
 await page.getByRole('button',{name:'刷新当前页',exact:true}).click();
 await page.locator('.task-row').filter({hasText:'另一门旧课程当前作业'}).getByText('未交',{exact:true}).waitFor();
 await waitCount(4);assert.equal(await page.getByText('部分作业详情未同步',{exact:false}).count(),0);
 report.checks.push('explicit refresh recovers the old assignment status and removes the warning after its detail endpoint becomes available');
 slowNew=true;
 await page.getByRole('button',{name:'刷新当前页',exact:true}).click();await waitCount(3);
 assert.ok((await page.locator('.task-row h3').allTextContents()).every(title=>title!=='新版当前作业'));
 await page.getByText(/已读取 .*门课程/).first().waitFor();assert.equal(typeof releaseNew,'function');
 slowNew=false;releaseNew();await waitCount(4);
 await page.locator('#learning-results[aria-busy="false"]').waitFor();
 report.checks.push('a slow LMS endpoint does not blank the entire task page: completed old tasks and progress appear before the new task finishes');
 const oldRequests=requests.filter(r=>r.host==='lexue.bit.edu.cn').length;
 const onlyNew=await context.newPage();onlyNew.on('pageerror',error=>errors.push(error.message));
 await onlyNew.goto('https://aita.yanhekt.cn/personal/?yh_view=tasks&yh_source=lms');
 await onlyNew.locator('#learning-results[aria-busy="false"]').waitFor();
 assert.deepEqual(await onlyNew.locator('.task-row h3').allTextContents(),['新版当前作业']);
 assert.equal(requests.filter(r=>r.host==='lexue.bit.edu.cn').length,oldRequests);
 await onlyNew.goto('https://aita.yanhekt.cn/personal/?yh_view=settings');
 await onlyNew.locator('#connection-status').waitFor();
 assert.match(await onlyNew.locator('#connection-status').innerText(),/尚未检查/);
 assert.doesNotMatch(await onlyNew.locator('#connection-status').innerText(),/未连接/);
 await onlyNew.close();
 badTermCatalog=true;const unresolved=await context.newPage();await unresolved.goto('https://aita.yanhekt.cn/personal/?yh_view=tasks&yh_source=lms');await unresolved.locator('#learning-results[aria-busy="false"]').waitFor();await unresolved.getByRole('button',{name:'刷新当前页',exact:true}).click();
 await unresolved.getByText('学期信息未完整读取，暂时无法确认当前学期待办',{exact:true}).waitFor();assert.equal(await unresolved.getByText('暂无未交作业',{exact:true}).count(),0);assert.match(await unresolved.getByLabel('学期',{exact:true}).locator('option:checked').innerText(),/未匹配课程/);
 await unresolved.goto('https://aita.yanhekt.cn/portal/#/');await unresolved.getByText('55 门新乐学课程的学期尚未识别，待办可能不完整',{exact:false}).waitFor();assert.equal(await unresolved.getByText('暂无未交作业',{exact:true}).count(),0);assert.equal(await unresolved.locator('.task-mini').count(),3);
 badTermCatalog=false;await unresolved.goto('https://aita.yanhekt.cn/personal/?yh_view=tasks&yh_source=lms');await unresolved.getByRole('button',{name:'刷新当前页',exact:true}).click();await unresolved.locator('.task-row h3').getByText('新版当前作业',{exact:true}).waitFor();await unresolved.close();
 report.checks.push('unavailable semester dictionaries show incomplete-classification warnings on both tasks and Today instead of an empty-task claim; refresh recovers the current task');
 badNewCourses=true;const failure=await context.newPage();await failure.goto('https://aita.yanhekt.cn/personal/?yh_view=tasks&yh_source=lms');await failure.getByText(/新乐学读取失败：/).first().waitFor();assert.equal(await failure.getByText('暂无未交作业',{exact:true}).count(),0);await failure.close();badNewCourses=false;
 report.checks.push('a cold new-LMS-only task page reads its current task without any old Moodle request; unprobed classroom sessions are not falsely marked disconnected');
 assert.deepEqual(errors,[]);report.ok=true;await page.screenshot({path:join(out,'tasks-four-pending.png'),fullPage:true});
}catch(error){report.ok=false;report.error=String(error.stack);report.failedUI=await Promise.all(context.pages().map(async tab=>({url:tab.url(),visible:await tab.locator('h1,.task-row,.task-mini,.inline-notice,.loading,.empty-state').allTextContents().catch(()=>[])})));report.fixtureCourseReads=await background?.evaluate(()=>globalThis.fixtureCourseReads).catch(()=>[]);await page?.screenshot({path:join(out,'tasks-failed.png')}).catch(()=>{});process.exitCode=1;}
finally{await context?.close();if(dirname(scratch)===resolve(tmpdir())&&basename(scratch).startsWith('yanhe-tasks-'))await rm(scratch,{recursive:true,force:true});await writeFile(join(out,'tasks-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
