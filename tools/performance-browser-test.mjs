// Isolated measurements only: synthetic teaching responses/media and the public bundled catalogs.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,cp,rm} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
const root=process.cwd(),scratch=await mkdtemp(join(tmpdir(),'yanhe-performance-')),ext=join(scratch,'extension'),out=join(root,'test-results');
await mkdir(out,{recursive:true});await cp(resolve(process.env.EXTENSION_PATH||join(root,'extension')),ext,{recursive:true});
await rm(join(ext,'private-catalog.json'),{force:true});await rm(join(ext,'legacy-session-index.json'),{force:true});
const snapshot=JSON.parse(await readFile(join(ext,'课程目录/旧版课次目录.json'),'utf8')),sample=snapshot.courses.find(c=>c.sessions.length>1),media=await readFile(join(root,'tests/fixtures/timing.mp4'));
const label=process.argv[2]||'current',report={label,mode:'isolated Edge; generated MP4 and 3000 synthetic subtitles; actual public catalogs; no real account requests',checks:[],errors:[]};let context;
const baseline=label.startsWith('before');
try{
 context=await chromium.launchPersistentContext(join(scratch,'profile'),{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`],viewport:{width:1440,height:900}});
 context.on('page',p=>p.on('pageerror',error=>report.errors.push(String(error.stack))));
 await context.addCookies([{name:'_token',value:'eyJfixture.performance.signature',domain:'aita.yanhekt.cn',path:'/',secure:true}]);
 await context.route('https://**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname,json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  if(u.hostname!=='aita.yanhekt.cn')return route.fulfill({status:403,body:'no external requests'});
  if(path==='/play/timing.mp4'){
   let bytes=media;const headers={'Accept-Ranges':'bytes'},range=req.headers().range?.match(/^bytes=(\d+)-(\d*)$/);
   if(range){const first=Number(range[1]),last=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;headers['Content-Range']=`bytes ${first}-${last}/${bytes.length}`;bytes=bytes.subarray(first,last+1);return route.fulfill({status:206,contentType:'video/mp4',headers,body:bytes});}
   return route.fulfill({contentType:'video/mp4',headers,body:bytes});
  }
  if(path.endsWith('/infosimple'))return json({code:200,params:{id:7,tenant_id:21,phone:'fixture',account:'fixture'}});
  if(path.endsWith('/get-course-detail'))return json({code:0,data:{id:100,title:'滚动性能合成课程',realname:'合成教师',term_name:'2026-2027-1',sub_list:[{id:200,sub_title:'长字幕合成课次',playback_status:'1',class_begin:1,type:'course_live'}]}});
  if(path.includes('/study-auth/'))return json({code:200,data:{hasPermission:true}});
  if(path.endsWith('/get-sub-info'))return json({code:0,data:{duration:9000,video_list:{screen:{type:2,status:2,preview_url:'https://aita.yanhekt.cn/play/timing.mp4'},room:{type:3,status:2,preview_url:'https://aita.yanhekt.cn/play/timing.mp4'}}}});
  if(path.endsWith('/search-trans-result'))return json({code:0,list:[{all_content:Array.from({length:3000},(_,i)=>({BeginSec:i*3,EndSec:i*3+2.8,Text:`合成字幕第 ${i+1} 段：课程内容、操作说明及性能测试。`}))}]});
  if(path.endsWith('/account-profile/course'))return json({code:1000,params:{result:{data:[],total:0}}});
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Native fixture</body></html>'});
 });
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),origin='chrome-extension://'+new URL(worker.url()).host;
 const page=await context.newPage();await page.goto('https://aita.yanhekt.cn/coursedetail?course_id=100&tenant_code=21&yh_tab=watch&sub_id=200&yh_sub=200');
 await page.frameLocator('iframe.watch-frame').locator('.subtitle-item').first().waitFor();
 const player=page.frames().find(f=>f.url().includes('/watch/player.html'));
 report.subtitleCount=Number((await player.locator('#subtitle-count').innerText()).match(/\d+/)?.[0]);report.renderedSubtitleCount=await player.locator('.subtitle-item').count();assert.equal(report.subtitleCount,3000);if(!baseline)assert.ok(report.renderedSubtitleCount<=64);
 await player.locator('#play').click();await player.waitForFunction(()=>document.getElementById('video').currentTime>.1);
 await player.locator('#video').evaluate(v=>v.pause());
 const cdp=await context.newCDPSession(player);await cdp.send('Performance.enable');
 const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 await player.evaluate(()=>{
  globalThis.fixtureUI={rectReads:0,mutations:0};const original=Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect=function(...args){globalThis.fixtureUI.rectReads++;return original.apply(this,args);};
  globalThis.fixtureObserver=new MutationObserver(records=>globalThis.fixtureUI.mutations+=records.length);
  globalThis.fixtureObserver.observe(document.getElementById('player-controls'),{subtree:true,attributes:true,childList:true});
 });
 const before=await metrics();
 await player.evaluate(async()=>{
  const v=document.getElementById('video'),surface=document.getElementById('media-grid');
  for(let i=0;i<60;i++){surface.dispatchEvent(new PointerEvent('pointermove',{bubbles:true}));v.dispatchEvent(new Event('timeupdate'));await new Promise(r=>requestAnimationFrame(r));}
 });
 const after=await metrics();report.idleUpdates={...(await player.evaluate(()=>globalThis.fixtureUI)),layouts:after.LayoutCount-before.LayoutCount,recalcs:after.RecalcStyleCount-before.RecalcStyleCount,layoutMs:(after.LayoutDuration-before.LayoutDuration)*1000,taskMs:(after.TaskDuration-before.TaskDuration)*1000};
 const scrollBefore=await metrics();
 await player.locator('#subtitle-list').hover();for(let i=0;i<30;i++){await page.mouse.wheel(0,i<15?220:-220);await page.waitForTimeout(12);}
 const scrollAfter=await metrics();report.subtitleScroll={layouts:scrollAfter.LayoutCount-scrollBefore.LayoutCount,layoutMs:(scrollAfter.LayoutDuration-scrollBefore.LayoutDuration)*1000,taskMs:(scrollAfter.TaskDuration-scrollBefore.TaskDuration)*1000};
 await player.locator('#subtitle-search').fill('第 2999 段');assert.equal(await player.locator('.subtitle-item').count(),1);await player.locator('#subtitle-search').fill('');
 assert.equal(Number((await player.locator('#subtitle-count').innerText()).match(/\d+/)?.[0]),3000);if(!baseline)assert.ok(await player.locator('.subtitle-item').count()<=64);report.checks.push('long transcript remains searchable and all cues return after clearing search');
 if(!baseline){
  // A scrollbar gesture first leaves follow mode, just as wheel/touch navigation does.
  await player.locator('#subtitle-list').evaluate(list=>{list.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));list.scrollTop=list.scrollHeight;});
  await player.locator('.subtitle-item[data-index="2999"]').waitFor();
  await player.waitForFunction(()=>{const list=document.getElementById('subtitle-list'),row=list.querySelector('[data-index="2999"]');if(!row)return false;const a=list.getBoundingClientRect(),b=row.getBoundingClientRect();return b.top<a.bottom&&b.bottom>a.top;});
  assert.ok(await player.locator('.subtitle-item').count()<=64);
  await player.locator('.subtitle-item[data-index="2999"]').evaluate(node=>node.focus({preventScroll:true}));await player.locator('.subtitle-item[data-index="2999"]').press('Home');
  await player.waitForFunction(()=>document.activeElement?.dataset.index==='0');await player.locator('.subtitle-item[data-index="0"]').press('ArrowDown');await player.waitForFunction(()=>document.activeElement?.dataset.index==='1');
  await player.locator('#subtitle-search').fill('第 11 段');await player.locator('.subtitle-item[data-index="10"]').click();await player.waitForFunction(()=>Math.abs(document.getElementById('video').currentTime-30)<1);await player.locator('#video').evaluate(v=>v.pause());
  assert.equal(await player.locator('#subtitle-search').inputValue(),'');assert.ok(await player.locator('.subtitle-item').count()<=64);
  report.checks.push('all 3000 cues remain reachable by scrollbar, Home/Arrow keyboard navigation, search and playback seeking while DOM stays bounded');
 }
 await page.mouse.move(1350,80);for(let i=0;i<20;i++){await page.mouse.wheel(0,i<10?150:-150);await page.waitForTimeout(12);}
 // Wait for the outer frame's scrolling/compositor coordinates to settle before another mouse action.
 await page.locator('iframe.watch-frame').evaluate(frame=>new Promise(resolve=>{let last='',stable=0;function settle(){const b=frame.getBoundingClientRect(),value=[scrollY,b.x,b.y,b.width,b.height].join(',');stable=value===last?stable+1:0;last=value;if(stable>=6)resolve();else requestAnimationFrame(settle);}requestAnimationFrame(settle);}));
 // The headless OOPIF inside the site's shadow root stops forwarding mouse events after
 // outer-page wheel input, including in the previous package (performance-before-scroll.json).
 // Keep mouse seeking above; use keyboard activation for this post-scroll functional check.
 await player.locator('#subtitle-search').fill('第 12 段');await player.locator('.subtitle-item[data-index="11"]').press('Enter');await player.waitForFunction(()=>Math.abs(document.getElementById('video').currentTime-33)<1);
 report.checks.push('subtitle search and keyboard seeking remain usable after scrolling the outer course page');
 report.limitations=['Outer-page post-wheel pointer forwarding fails in both old and new headless embedded fixtures; not a real-account scrolling or frame-rate measurement.'];
 const heaps=[];
 for(let i=0;i<2;i++){
  const tab=await context.newPage();await tab.goto(origin+'/desk.html#/settings');
  const owner=await tab.evaluate(async sid=>{const {AutoSlidesIndex}=await import(chrome.runtime.getURL('watch/autoslides-index.js'));globalThis.fixtureHeldIndex=new AutoSlidesIndex();return fixtureHeldIndex.owner(sid);},sample.sessions[1]);assert.equal(owner.id,String(sample.id));
  const session=await context.newCDPSession(tab);await session.send('Performance.enable');await session.send('HeapProfiler.collectGarbage');
  const data=Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));heaps.push(data.JSHeapUsedSize);
 }
 report.twoCatalogPageHeapBytes=heaps;report.heapAfterTwoCatalogPagesBytes=heaps.at(-1);report.heapMeasurement='CDP heap snapshots; pages may share a V8 isolate, so snapshots are not summed.';
 report.checks.push('two independent pages resolve the same real noncontiguous session owner correctly');assert.deepEqual(report.errors,[]);
 report.ok=true;
}catch(error){report.ok=false;report.error=String(error.stack);report.visible=await Promise.all(context.pages().flatMap(p=>p.frames()).map(f=>f.evaluate(()=>({url:location.href,message:document.getElementById('message')?.textContent,text:document.body?.innerText?.slice(0,500),transcript:{focus:document.activeElement?.dataset.index,tag:document.activeElement?.tagName,scroll:document.getElementById('subtitle-list')?.scrollTop,rows:[...document.querySelectorAll('.subtitle-item')].map(n=>n.dataset.index),clicks:globalThis.fixtureClicks,time:document.getElementById('video')?.currentTime}})).catch(()=>null)));process.exitCode=1;}
finally{
 await context?.close();if(dirname(scratch)===resolve(tmpdir())&&basename(scratch).startsWith('yanhe-performance-'))await rm(scratch,{recursive:true,force:true});
 await writeFile(join(out,'performance-'+label+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
