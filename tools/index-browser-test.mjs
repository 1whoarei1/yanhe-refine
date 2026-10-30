import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm,cp} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8')),refine=pkg.name==='yanhe-refine';
const scratch=await mkdtemp(join(tmpdir(),'yanhe-index-test-')),ext=join(scratch,'extension'),out=join(root,'test-results');await mkdir(out,{recursive:true});await cp(resolve(process.env.EXTENSION_PATH||join(root,'extension')),ext,{recursive:true});
await rm(join(ext,'legacy-session-index.json'),{force:true}); // Exercise missing-catalog guidance before importing a local snapshot.
if(refine)await writeFile(join(ext,'build-info.json'),JSON.stringify({version:pkg.version,catalog:null}));
const report={version:pkg.version,mode:'isolated Edge; local catalog import and synthetic school APIs; no online index or media requests',checks:[]};let context,page;
try{
 context=await chromium.launchPersistentContext(join(scratch,'profile'),{executablePath:process.env.BROWSER_EXECUTABLE||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`],viewport:{width:1440,height:1000}});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,requests=[],errors=[];
 await context.addCookies([{name:'_token',value:encodeURIComponent('a:2:{i:0;s:6:"_token";i:1;s:13:"index-fixture";}'),domain:'aita.yanhekt.cn',path:'/',secure:true,sameSite:'None'}]);
 await context.route('https://**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname;requests.push({origin:u.origin,path});assert.equal(req.method(),'GET');
  const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
  if(u.origin==='https://share.ruc.edu.kg')throw Error('Removed index must never be contacted');
  if(u.hostname==='cbiz.yanhekt.cn'){
   if(path==='/v2/live/list'){assert.equal(u.searchParams.get('source_id'),'9397');return json({code:0,data:{data:[],last_page:1,total:0}});}
   if(path==='/v1/video/subtitle/list')return json({code:0,data:[]});
   const data=path==='/v1/user'?{id:731002,badge:'fixture'}:path==='/v1/course'?{id:9397,name_zh:'离散数学Ⅱ',professors:[{name:'索引教师'}],school_year:'2026-2027',semester:1}:path==='/v2/course/session/list'?[]:path==='/v1/course/session'?{id:Number(u.searchParams.get('session_id')),course_id:9397,video_ids:[301,302],title:'集合与关系',started_at:'2026-09-07 08:00:00'}:path==='/v1/video'?{id:Number(u.searchParams.get('id')),course_id:0,session_id:0,main:'https://cvideo.yanhekt.cn/index-fixture.m3u8',duration:5}:null;
   assert.ok(data,'Unexpected legacy path '+path);return json({code:0,data});
  }
  if(['www.yanhekt.cn','aita.yanhekt.cn'].includes(u.hostname)){
   if(path==='/userapi/v1/infosimple')return json({code:200,params:{id:731002,tenant_id:21,phone:'fixture',account:'fixture'}});
   if(path.endsWith('/term-list'))return json({code:1000,params:{list:[{id:1,term_name:'2026-2027-1'}]}});
   if(path.endsWith('/structures'))return json({code:1000,params:{data:[{id:2,display_name:'示例学院'}]}});
   if(path.endsWith('/get-course-list'))return json({code:0,data:{total:0,list:[]}});
   if(path.endsWith('/account-profile/course'))return json({code:1000,params:{result:{data:[],total:0}}});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html><meta charset=utf-8><body><h1>原站</h1></body></html>'});
  }
  throw new Error('Unexpected network host '+u.hostname);
 });
 const auth=await context.newPage();await auth.goto('https://www.yanhekt.cn/home?yh_native=1');await auth.evaluate(()=>localStorage.setItem('auth',JSON.stringify({token:'d'.repeat(32),login:true})));
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const indexFile=join(scratch,'sessions.json');await writeFile(indexFile,JSON.stringify({format:'yanhekt-session-index/v1',source:{kind:'self-collected'},partial:true,generatedAt:'2026-10-30T00:00:00Z',courses:[{id:'9397',name:'离散数学Ⅱ',teachers:['索引教师'],term:'2026-2027-1',sessions:['71990','72000']}]}));
 await page.goto('https://aita.yanhekt.cn/searchContent?yh_scope=all&yh_platform=legacy');
 await page.getByText(/尚未导入旧版课次目录/).waitFor();assert.equal(await page.locator('a[href*="share.ruc.edu.kg"]').count(),0);
 await page.getByRole('link',{name:'导入目录',exact:true}).first().click();await page.locator('#catalog-file').setInputFiles(indexFile);await page.locator('#import-state').filter({hasText:'2 个课次'}).waitFor();
 report.checks.push('missing local catalogs show an import action with no index-site link or request');

 if(refine){await page.goto('https://aita.yanhekt.cn/searchContent?yh_scope=all&yh_platform=legacy&yh_q=离散&yh_term=2026-2027-1');await page.getByRole('link',{name:'离散数学Ⅱ',exact:true}).waitFor();assert.equal(await page.getByLabel('平台',{exact:true}).inputValue(),'legacy');await page.getByRole('link',{name:'离散数学Ⅱ',exact:true}).click();}
 else{await page.goto(`chrome-extension://${id}/player.html`);await page.locator('#browse-courses').click();await page.locator('#catalog-source').selectOption('legacy');await page.locator('#catalog-term option[value="2026-2027-1"]').waitFor({state:'attached'});await page.locator('#catalog-query').fill('离散');await page.locator('#catalog-submit').click();await page.locator('.catalog-row').click();}
 const player=refine?await(async()=>{await page.frameLocator('iframe').locator('#lecture-list').waitFor();return page.frames().find(f=>f.url().includes('/watch/player.html'));})():page;
 await player.locator('[data-id="71990:pending"]').waitFor();assert.equal(requests.filter(r=>r.path==='/v1/video').length,0);report.checks.push('旧版 source searches imported local terms and lists session IDs without guessing course/video identity or fetching media');
 await player.locator('[data-id="71990:pending"]').click();await player.waitForFunction(()=>!document.getElementById('play').disabled);await player.locator('[data-id="71990:302"]').click();await player.waitForFunction(()=>document.querySelector('[data-id="71990:302"]')?.getAttribute('aria-current')==='true'&&!document.getElementById('play').disabled);
 assert.equal(await player.locator('.lecture-item').count(),3);assert.ok(refine?page.url().includes('/session/71990'):new URL(page.url()).searchParams.get('legacy_video')==='302');report.checks.push('selected session resolves its real video parts; switching parts keeps course 9397 and session 71990 distinct');
 const [download]=await Promise.all([context.waitForEvent('page'),player.locator('#download-video').click()]);await download.waitForFunction(()=>document.getElementById('lecture-title').textContent||(document.getElementById('message').textContent&&!document.getElementById('message').textContent.includes('正在读取')));assert.equal(await download.locator('#message').textContent(),'');await download.waitForFunction(()=>document.getElementById('lecture-title').textContent.includes('片段2'));await download.close();report.checks.push('indexed video parts also resolve in the download page without needing the v2 listing');
 await page.reload();const restored=refine?await(async()=>{await page.frameLocator('iframe').locator('#play').waitFor();return page.frames().find(f=>f.url().includes('/watch/player.html'));})():page;await restored.waitForFunction(()=>!document.getElementById('play').disabled&&document.querySelector('[data-id="71990:302"]')?.getAttribute('aria-current')==='true');report.checks.push('reload restores the same session and second video part');
 assert.equal(requests.some(r=>r.origin==='https://share.ruc.edu.kg'),false);report.checks.push('local catalog browsing, playback and downloads never contact the removed index service');
 assert.equal(requests.some(r=>r.origin.includes('cvideo')||r.path.includes('/auth/video/token')),false);assert.deepEqual(errors,[]);await page.screenshot({path:join(out,'index-unavailable.png'),fullPage:true});report.ok=true;
}catch(error){report.ok=false;report.error=String(error.stack);process.exitCode=1;if(page){report.visible=await page.locator('body').innerText().catch(()=>null);report.pages=await Promise.all(context.pages().map(p=>p.locator('body').innerText().catch(()=>null)));await page.screenshot({path:join(out,'index-failed.png'),fullPage:true}).catch(()=>{});}}
finally{await context?.close();if(dirname(scratch)===resolve(tmpdir())&&basename(scratch).startsWith('yanhe-index-test-'))await rm(scratch,{recursive:true,force:true});await writeFile(join(out,'index-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
