// Real self-collected directory + live public CBIZ metadata in an isolated browser.
// Login/profile and host-page shells are fixtures; this does not claim media playback.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm,cp} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8')),refine=pkg.name==='yanhe-refine';
const scratch=await mkdtemp(join(tmpdir(),'yanhe-self-index-')),ext=join(scratch,'extension'),out=join(root,'test-results');await mkdir(out,{recursive:true});await cp(resolve(process.env.EXTENSION_PATH||join(root,'extension')),ext,{recursive:true});
const raw=await readFile(join(ext,'legacy-session-index.json')),catalog=JSON.parse(raw),courses=new Map(catalog.courses.map(c=>[String(c.id),c]));
if(refine)await writeFile(join(ext,'build-info.json'),JSON.stringify({version:pkg.version,catalog:null}));
const report={version:pkg.version,mode:'real self-collected snapshot and live anonymous public metadata; fixture login/profile and host shell; no media playback',snapshot:{sha256:createHash('sha256').update(raw).digest('hex'),generatedAt:catalog.generatedAt,courses:courses.size,sessions:catalog.coverage.sessions,partial:catalog.partial},checks:[],liveReads:[]};
let context,page;
try{
 context=await chromium.launchPersistentContext(join(scratch,'profile'),{executablePath:process.env.BROWSER_EXECUTABLE||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`],viewport:{width:1440,height:1000}});
 context.setDefaultTimeout(45000);context.setDefaultNavigationTimeout(45000);
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,errors=[],upstream=[],media=[];
 await context.addCookies([{name:'_token',value:encodeURIComponent('a:2:{i:0;s:6:"_token";i:1;s:13:"index-fixture";}'),domain:'aita.yanhekt.cn',path:'/',secure:true,sameSite:'None'}]);
 await context.route('https://**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname;
  const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
  if(u.origin==='https://share.ruc.edu.kg'){upstream.push(path);return route.abort();}
  if(u.hostname==='cbiz.yanhekt.cn'){
   if(path==='/v1/user')return json({code:0,data:{id:731002,badge:0}}); // Authentication is explicitly outside this test.
   assert.ok(['/v1/course','/v2/course/session/list','/v1/course/session','/v1/video','/v1/video/subtitle/list'].includes(path),'Unexpected school API '+path);
   const headers={...req.headers(),origin:'https://www.yanhekt.cn',referer:'https://www.yanhekt.cn/'};delete headers.authorization;delete headers.cookie;
   const actual=await route.fetch({headers,timeout:25000,maxRedirects:0});
   const body=await actual.json();
   const record={path,status:actual.status(),code:body.code};
   if(path==='/v1/course/session')Object.assign(record,{session:body.data?.id,course:body.data?.course_id,videoIds:body.data?.video_ids});
   if(path==='/v1/video')record.video=body.data?.id;
   report.liveReads.push(record);
   return route.fulfill({response:actual,contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
  }
  if(['www.yanhekt.cn','aita.yanhekt.cn'].includes(u.hostname)){
   if(path==='/userapi/v1/infosimple')return json({code:200,params:{id:731002,tenant_id:21,phone:'fixture',account:'fixture'}});
   if(path.endsWith('/term-list'))return json({code:1000,params:{list:[{id:1,term_name:'2026-2027-1'}]}});
   if(path.endsWith('/structures'))return json({code:1000,params:{data:[]}});
   if(path.endsWith('/account-profile/course'))return json({code:1000,params:{result:{data:[],total:0}}});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html><meta charset=utf-8><body>原站测试外壳</body></html>'});
  }
  media.push(u.hostname);return route.abort();
 });
 const auth=await context.newPage();await auth.goto('https://www.yanhekt.cn/home?yh_native=1');await auth.evaluate(()=>localStorage.setItem('auth',JSON.stringify({token:'d'.repeat(32),login:true})));
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 // Large real term: the sixth page must remain reachable, beyond 200 results.
 const historical=catalog.courses.filter(c=>c.term==='2025-2026-2');assert.ok(historical.length>200);
 if(refine){
  await page.goto('https://aita.yanhekt.cn/searchContent?yh_scope=all&yh_platform=legacy&yh_term=2025-2026-2&yh_page=6');
  await page.getByText(new RegExp(historical.length.toLocaleString()+' 门')).first().waitFor();
  await page.getByRole('link',{name:historical.sort((a,b)=>a.id-b.id)[200].name,exact:true}).first().waitFor();
 }else{
  await page.goto(`chrome-extension://${id}/player.html`);await page.locator('#browse-courses').click();await page.locator('#catalog-source').selectOption('legacy');
  await page.locator('#catalog-term option[value="2025-2026-2"]').waitFor({state:'attached'});await page.locator('#catalog-term').selectOption('2025-2026-2');
  await page.waitForFunction(n=>document.getElementById('catalog-status').textContent.includes(String(n))&&!document.getElementById('catalog-next').disabled,historical.length);
  for(let i=2;i<=6;i++){await page.locator('#catalog-next').click();await page.waitForFunction(n=>document.getElementById('catalog-page').textContent.startsWith(n+' /')&&document.getElementById('catalog-submit').getAttribute('aria-busy')==='false',i);}
  assert.equal(await page.locator('.catalog-row').count(),40);await page.locator('#catalog-close').click();
 }
 report.checks.push(`real 2025-2026-2 term: ${historical.length} courses, sixth page available without the upstream 200-course cap`);
 console.log(JSON.stringify({event:'pagination-ok',version:pkg.version}));
 async function openCourse(courseId){
  const row=courses.get(courseId);assert.ok(row);
  if(refine){await page.goto('https://aita.yanhekt.cn/searchContent?'+new URLSearchParams({yh_scope:'all',yh_platform:'legacy',yh_q:courseId,yh_term:row.term}));await page.getByRole('link',{name:row.name,exact:true}).first().click();await page.frameLocator('iframe').locator('#lecture-list').waitFor();return page.frames().find(f=>f.url().includes('/watch/player.html'));}
  await page.locator('#browse-courses').click();await page.locator('#catalog-source').selectOption('legacy');await page.locator(`#catalog-term option[value="${row.term}"]`).waitFor({state:'attached'});await page.locator('#catalog-term').selectOption(row.term);await page.locator('#catalog-query').fill(courseId);await page.locator('#catalog-submit').click();await page.locator(`.catalog-row[data-course="${courseId}"]`).click();return page;
 }
 async function select(player,courseId,session){
  const beforeVideos=report.liveReads.filter(r=>r.path==='/v1/video').length;
  await player.locator(`[data-id="${session}:pending"]`).waitFor();await player.locator(`[data-id="${session}:pending"]`).click();
  await player.waitForFunction(s=>document.querySelector(`[data-id^="${s}:"][aria-current="true"]`)&&(!document.getElementById('play').disabled||document.getElementById('stage-detail').textContent.includes('此课次暂未提供回放')),session,{timeout:45000});
  const actual=report.liveReads.find(r=>r.path==='/v1/course/session'&&String(r.session)===session&&String(r.course)===courseId);assert.ok(actual,'Live parent course must agree with the snapshot');
  if(!actual.videoIds.length){assert.equal(await player.locator('#play').isDisabled(),true);assert.equal(report.liveReads.filter(r=>r.path==='/v1/video').length,beforeVideos);if(refine)await page.waitForURL(u=>u.pathname==='/session/'+session);else{assert.equal(new URL(page.url()).searchParams.get('legacy_session'),session);assert.equal(new URL(page.url()).searchParams.get('legacy_video'),null);assert.ok((await page.locator('#course-meta').textContent()).includes('课次 ID '+session));}report.checks.push(`real session ${session} has no video IDs: shows unavailable, preserves that session target and never fetches a guessed video`);return null;}
  const selected=await player.locator(`[data-id^="${session}:"][aria-current="true"]`).getAttribute('data-id');assert.match(selected,new RegExp('^'+session+':\\d+$'));
  assert.ok(actual.videoIds.map(String).includes(selected.split(':')[1]));return selected;
 }
 const player=await openCourse('65802');
 console.log(JSON.stringify({event:'course-opened',course:'65802'}));
 for(const sid of courses.get('65802').sessions)await player.locator(`[data-id="${sid}:pending"]`).waitFor();
 report.checks.push('real 信号与系统 course 65802 groups 879786, 879787, 891269, 891272 and 891273 together');
 await select(player,'65802','879786');await select(player,'65802','891269');
 report.checks.push('noncontiguous sessions 879786 and 891269 both verify course 65802 through live metadata; only actual video IDs are used');
 await page.screenshot({path:join(out,'self-index-noncontiguous.png'),fullPage:true});
 for(const [courseId,sid]of [['9397','71990'],['30226','281490']]){
  const p=await openCourse(courseId);await select(p,courseId,sid);report.checks.push(`early term ${courses.get(courseId).term}: session ${sid} resolves to its actual course ${courseId}`);
 }
 await page.reload();const restored=refine?await(async()=>{await page.frameLocator('iframe').locator('#lecture-list').waitFor();return page.frames().find(f=>f.url().includes('/watch/player.html'));})():page;
 await restored.waitForFunction(()=>document.querySelector('[data-id^="281490:"][aria-current="true"]')&&!document.getElementById('play').disabled,undefined,{timeout:45000});
 report.checks.push('reload retains the real early session 281490 and selected video');
 assert.deepEqual(upstream,[]);assert.deepEqual(media,[]);assert.deepEqual(errors,[]);
 report.checks.push('all directory reads use the packaged snapshot; no AutoSlides online query or media request');
 await page.screenshot({path:join(out,'self-index-early-course.png'),fullPage:true});report.ok=true;
}catch(error){report.ok=false;report.error=String(error.stack);process.exitCode=1;if(page){report.visible=await page.locator('body').innerText().catch(()=>null);await page.screenshot({path:join(out,'self-index-failed.png'),fullPage:true}).catch(()=>{});}}
finally{await context?.close();if(dirname(scratch)===resolve(tmpdir())&&basename(scratch).startsWith('yanhe-self-index-'))await rm(scratch,{recursive:true,force:true});await writeFile(join(out,'self-index-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
