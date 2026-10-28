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
const oldCourses=[{id:601,fullname:'复用的旧课程',startdate:Date.parse('2021-09-01T00:00:00+08:00')/1000,visible:true},{id:602,fullname:'未填写学期的课程',startdate:0,visible:true}];
const assignments=[{id:901,courseId:601,title:'旧课程当前作业一',deadline:due(7)},{id:902,courseId:601,title:'旧课程当前作业二',deadline:due(18)},{id:903,courseId:602,title:'无学期课程当前作业',deadline:due(30)},...Array.from({length:4},(_,i)=>({id:910+i,courseId:601,title:'已过期旧作业'+i,deadline:due(-2-i)}))];
const expected=['新版当前作业',...assignments.slice(0,3).map(row=>row.title)].sort();
const shell=inside=>'<!doctype html><html><body>'+inside+'</body></html>';
const report={version,mode:'isolated browser; synthetic new/old LMS responses, no real course or submission requests',checks:[]};
let context,page,failedDetail=false;
try{
 context=await chromium.launchPersistentContext(join(scratch,'profile'),{...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:process.platform==='win32'?{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}:{channel:'chromium'}),headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`],viewport:{width:1440,height:1000}});
 context.setDefaultTimeout(15000);
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),errors=[],requests=[];
 await context.addCookies([{name:'_token',value:'eyJfixture.tasks.signature',domain:'aita.yanhekt.cn',path:'/',secure:true}]);
 await context.route('https://**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname;requests.push({host:u.hostname,path,courseId:u.searchParams.get('id')});
  const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  const html=body=>route.fulfill({contentType:'text/html',body});
  assert.ok(req.method()==='GET'||(u.hostname==='lexue.bit.edu.cn'&&path==='/lib/ajax/service.php'&&req.method()==='POST'));
  if(u.hostname==='lexue.bit.edu.cn'){
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
   if(path==='/api/my-courses')return json({courses:[{id:401,name:'新版课程',academic_year:'2026-2027',semester:'第一学期'}]});
   if(path.endsWith('/homework-activities'))return json({homework_activities:[{id:801,course_id:401,type:'homework',title:'新版当前作业',published:true,submitted:false,deadline:new Date(due(12)).toISOString()},{id:802,course_id:401,type:'homework',title:'已过期新版作业',published:true,submitted:false,deadline:new Date(due(-3)).toISOString()}],page:1,pages:1});
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
 await page.goto('https://aita.yanhekt.cn/personal/?yh_view=tasks');await page.locator('.task-row').first().waitFor();
 report.observedInitial=await page.locator('.task-row h3').allTextContents();
 assert.deepEqual(report.observedInitial.sort(),expected);
 assert.equal(await page.getByLabel('学期',{exact:true}).inputValue(),'');
 assert.ok(requests.some(r=>r.host==='lexue.bit.edu.cn'&&r.path==='/course/view.php'&&r.courseId==='601'));
 assert.ok(requests.some(r=>r.host==='lexue.bit.edu.cn'&&r.path==='/course/view.php'&&r.courseId==='602'));
 report.checks.push('default pending tasks includes four unexpired assignments across modern, reused old-term and undated old courses; five overdue assignments are excluded');
 await page.getByLabel('资料来源',{exact:true}).selectOption('lexue');await waitCount(3);
 assert.ok((await page.locator('.task-row h3').allTextContents()).every(t=>t!=='新版当前作业'));
 await page.getByLabel('资料来源',{exact:true}).selectOption('all');await waitCount(4);
 await page.getByLabel('学期',{exact:true}).selectOption('2026-2027-1');await waitCount(1);
 await page.getByLabel('学期',{exact:true}).selectOption('');await waitCount(4);
 report.checks.push('explicit platform and semester filters still work; clearing the semester restores all four tasks');
 await page.goto('https://aita.yanhekt.cn/portal/#/');await page.waitForFunction(()=>document.querySelector('#yanhe-refine')?.shadowRoot?.querySelectorAll('.task-mini').length===4);
 assert.deepEqual((await page.locator('.task-mini button').allTextContents()).sort(),expected);
 report.checks.push('today upcoming tasks uses the same unexpired, cross-term assignment set');
 failedDetail=true;
 await page.goto('https://aita.yanhekt.cn/personal/?yh_view=tasks');await waitCount(4);
 await page.getByRole('button',{name:'刷新当前页',exact:true}).click();await page.getByText('部分作业详情未同步',{exact:false}).first().waitFor();await waitCount(4);
 assert.ok((await page.locator('.task-row').filter({hasText:'无学期课程当前作业'}).innerText()).includes('待同步'));
 report.checks.push('a failed old assignment detail remains visible as unknown with a partial-sync warning instead of disappearing');
 failedDetail=false;
 await page.getByRole('button',{name:'刷新当前页',exact:true}).click();
 await page.locator('.task-row').filter({hasText:'无学期课程当前作业'}).getByText('未交',{exact:true}).waitFor();
 await waitCount(4);assert.equal(await page.getByText('部分作业详情未同步',{exact:false}).count(),0);
 report.checks.push('explicit refresh recovers the old assignment status and removes the warning after its detail endpoint becomes available');
 assert.deepEqual(errors,[]);report.ok=true;await page.screenshot({path:join(out,'tasks-four-pending.png'),fullPage:true});
}catch(error){report.ok=false;report.error=String(error.stack);process.exitCode=1;}
finally{await context?.close();if(dirname(scratch)===resolve(tmpdir())&&basename(scratch).startsWith('yanhe-tasks-'))await rm(scratch,{recursive:true,force:true});await writeFile(join(out,'tasks-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
