import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,cp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),refine=JSON.parse(await readFile(join(root,'package.json'),'utf8')).name==='yanhe-refine',scratch=await mkdtemp(join(tmpdir(),'yanhe-imports-')),ext=join(scratch,'extension'),out=join(root,'test-results');
await cp(resolve(process.env.EXTENSION_PATH||join(root,'extension')),ext,{recursive:true});await mkdir(out,{recursive:true});
const version=JSON.parse(await readFile(join(ext,'manifest.json'),'utf8')).version;if(refine)await writeFile(join(ext,'build-info.json'),JSON.stringify({version,catalog:null}));
const modernPath=existsSync(join(root,'local-data/release-catalog.json'))?join(root,'local-data/release-catalog.json'):join(scratch,'modern.json'),oldPath=existsSync(join(root,'local-data/release-session-index.json'))?join(root,'local-data/release-session-index.json'):join(scratch,'old.json');
if(!existsSync(modernPath))await writeFile(modernPath,JSON.stringify({schema:1,courses:[{platform:'modern',id:'100',title:'数据课程',teacher:'教师',term:'2026-2027-1'}]}));
if(!existsSync(oldPath))await writeFile(oldPath,JSON.stringify({format:'yanhekt-session-index/v1',source:{kind:'self-collected'},partial:true,courses:[{id:'9397',name:'离散数学',teachers:['教师'],term:'2020-2021-2',sessions:['71990','72000']}]}));
const modern=JSON.parse(await readFile(modernPath,'utf8')),old=JSON.parse(await readFile(oldPath,'utf8')),sample=old.courses.find(c=>c.term&&c.sessions.length>=2&&c.sessions.length<50&&!/测试|试用/i.test(c.name)&&Number(c.sessions[1])-Number(c.sessions[0])>1)||old.courses.find(c=>c.term&&c.sessions.length>=2),sessions=old.courses.reduce((n,c)=>n+c.sessions.length,0);
const report={version,mode:'isolated browser; actual release catalogues when available; synthetic school responses',catalogues:{modern:modern.courses.length,legacy:old.courses.length,sessions},checks:[]};let context,page,indexRequests=0;
try{
 context=await chromium.launchPersistentContext(join(scratch,'profile'),{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`],viewport:{width:1440,height:1000}});context.setDefaultTimeout(30000);
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),extensionId=new URL(worker.url()).host,errors=[];
 await context.addCookies([{name:'_token',value:'eyJfixture.import.signature',domain:'aita.yanhekt.cn',path:'/',secure:true}]);
 await context.route('https://**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;assert.equal(request.method(),'GET');const json=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(url.hostname==='share.ruc.edu.kg'){indexRequests++;return route.fulfill({status:403,body:''});}
  if(path.endsWith('infosimple'))return json({code:200,params:{id:7,tenant_id:21,account:'fixture',phone:'fixture'}});
  if(path.endsWith('/term-list'))return json({code:1000,params:{list:[]}});if(path.endsWith('/structures'))return json({code:1000,params:{data:[]}});
  if(path.endsWith('/get-course-list'))return json({code:0,data:{list:[],total:0}});
  if(path.endsWith('/account-profile/course'))return json({code:1000,params:{result:{data:[],total:0}}});
  if(url.hostname==='cbiz.yanhekt.cn'){
   if(path==='/v1/user')return json({code:0,data:{id:7,badge:0}});
   if(path==='/v1/course')return json({code:0,data:{id:sample.id,name_zh:sample.name,school_year:sample.term.slice(0,9),semester:Number(sample.term.at(-1)),professors:sample.teachers.map(name=>({name}))}});
   if(path==='/v2/live/list')return json({code:0,data:{data:[]}});if(path==='/v2/course/session/list')return json({code:0,data:[]});
   if(path==='/v1/course/session')return json({code:0,data:{id:Number(url.searchParams.get('session_id')),course_id:Number(sample.id),title:'尚无录像的课次',video_ids:[],started_at:'2026-01-01 08:00:00'}});
   throw Error('Unexpected old API '+path);
  }
  if(['aita.yanhekt.cn','www.yanhekt.cn'].includes(url.hostname))return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Native fixture</body></html>'});
  return route.fulfill({status:403,body:'No media or extra API calls are allowed'});
 });
 const auth=await context.newPage();await auth.goto('https://www.yanhekt.cn/home?yh_native=1');await auth.evaluate(()=>localStorage.setItem('auth',JSON.stringify({token:'d'.repeat(32),login:true})));
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(refine?'https://aita.yanhekt.cn/personal/?yh_view=settings':`chrome-extension://${extensionId}/player.html`);
 if(!refine)await page.locator('#browse-courses').click();
 await page.locator('#catalog-file').setInputFiles(modernPath);const status=page.locator(refine?'#import-state':'#catalog-import-status');await status.filter({hasText:modern.courses.length.toLocaleString('en-US')}).waitFor();report.checks.push('the shipped modern JSON imports through the user-facing file picker');
 await page.locator('#catalog-file').setInputFiles(oldPath);await status.filter({hasText:sessions.toLocaleString('en-US')}).waitFor();report.checks.push('the shipped session JSON imports with explicit course/session totals');
 await page.reload();
 if(refine){await page.goto('https://aita.yanhekt.cn/searchContent?'+new URLSearchParams({yh_scope:'all',yh_platform:'legacy',yh_q:String(sample.id),yh_term:sample.term}));await page.locator('.course-row .course-title').filter({hasText:sample.name}).first().click();}
 else{await page.locator('#browse-courses').click();await page.locator('#catalog-source').selectOption('legacy');await page.locator('#catalog-term').selectOption(sample.term);await page.locator('#catalog-query').fill(String(sample.id));await page.locator('#catalog-submit').click();await page.locator(`.catalog-row[data-course="${sample.id}"]`).click();}
 let player=page;if(refine){await page.frameLocator('iframe.watch-frame').locator('#lecture-list').waitFor();player=page.frames().find(frame=>frame.url().includes('/watch/player.html'));}
 for(const sid of sample.sessions)await player.locator(`[data-id="${sid}:pending"]`).waitFor({state:'attached'});
 assert.equal(await player.locator('.lecture-item').count(),sample.sessions.length);assert.equal(indexRequests,0);report.checks.push('imports survive reload and resolve noncontiguous sessions through their own course IDs without the upstream index');
 assert.deepEqual(errors,[]);report.ok=true;await page.screenshot({path:join(out,'catalog-import-success.png')});
}catch(error){report.ok=false;report.error=String(error.stack);process.exitCode=1;await page?.screenshot({path:join(out,'catalog-import-failed.png')}).catch(()=>{});}
finally{await context?.close();if(dirname(scratch)===resolve(tmpdir())&&basename(scratch).startsWith('yanhe-imports-'))await rm(scratch,{recursive:true,force:true});await writeFile(join(out,'catalog-import-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
