import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm,cp} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8')),refine=pkg.name==='yanhe-refine';
const scratch=await mkdtemp(join(tmpdir(),'yanhe-viewer-layout-')),ext=join(scratch,'extension'),out=join(root,'test-results');await mkdir(out,{recursive:true});await cp(resolve(process.env.EXTENSION_PATH||join(root,'extension')),ext,{recursive:true});
if(refine)await writeFile(join(ext,'build-info.json'),JSON.stringify({version:pkg.version,catalog:null}));
const fixture=refine?resolve(root,'../yanhe-replay-extension/tests/fixtures'):join(root,'tests/fixtures');
const report={version:pkg.version,mode:'isolated Edge; synthetic APIs and two generated MP4 videos; no campus requests',checks:[],themes:{}};

async function control(selector){
 if(refine)await page.locator('iframe.watch-frame').evaluate(frame=>new Promise(resolve=>{let previous='',stable=0;function settle(){const box=frame.getBoundingClientRect(),next=[box.x,box.y,box.width,box.height].join(',');stable=next===previous?stable+1:0;previous=next;if(stable>=3)resolve();else requestAnimationFrame(settle);}requestAnimationFrame(settle);}));
 const element=player.locator(selector),menu=await element.evaluate(node=>node.closest('.control-menu')?.id?.replace('menu-',''));
 if(menu&&await player.locator('#menu-'+menu).isHidden()){
  await player.locator('#media-grid').hover();
  if(menu==='volume')await player.locator('#control-volume').hover();else await player.locator('#control-'+menu).click();
  await player.locator('#menu-'+menu).waitFor({state:'visible'});
 }
 return element;
}


async function assertCaptionPlacement(controlsVisible){
 await player.locator('#video-caption').waitFor({state:'visible'});
 await player.waitForFunction(visible=>{const v=document.getElementById('video'),r=v.getBoundingClientRect(),caption=document.getElementById('video-caption').getBoundingClientRect(),dock=document.querySelector('.player-control-dock').getBoundingClientRect(),scale=Math.min(r.width/v.videoWidth,r.height/v.videoHeight),height=v.videoHeight*scale,top=r.top+(r.height-height)/2,bottom=top+height;return caption.top>=top-1&&caption.bottom<=bottom+1&&(!visible||caption.bottom<dock.top-3);},controlsVisible);
 const native=await player.locator('#video').evaluate(v=>[...v.textTracks].filter(t=>t.kind==='subtitles').map(t=>t.mode));assert.ok(native.every(mode=>mode==='hidden'),'native subtitles must not duplicate the positioned overlay');
}

let context,page,player;
try{
 context=await chromium.launchPersistentContext(join(scratch,'profile'),{executablePath:process.env.BROWSER_EXECUTABLE||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`,'--disable-gpu'],viewport:{width:1600,height:1050}});
 context.setDefaultTimeout(20000);context.setDefaultNavigationTimeout(20000);
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,errors=[];
 const token='layout-fixture-token';await context.addCookies([{name:'_token',value:encodeURIComponent(`a:2:{i:0;s:6:"_token";i:1;s:${token.length}:"${token}";}`),domain:'aita.yanhekt.cn',path:'/',secure:true,sameSite:'None'}]);
 await context.route('https://**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
  if(path.startsWith('/play/')){
   const data=await readFile(join(fixture,basename(path))),range=req.headers().range?.match(/^bytes=(\d+)-(\d*)$/),headers={'Accept-Ranges':'bytes'};
   if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),data.length-1):data.length-1;headers['Content-Range']=`bytes ${start}-${end}/${data.length}`;return route.fulfill({status:206,contentType:'video/mp4',headers,body:data.subarray(start,end+1)});}
   return route.fulfill({contentType:'video/mp4',headers,body:data});
  }
  if(url.hostname==='cbiz.yanhekt.cn'){
   const data=path==='/v1/user'?{id:7,badge:0}:path==='/v1/course'?{id:9397,name_zh:'离散数学Ⅱ',professors:[{name:'示例教师'}],school_year:'2020-2021',semester:2}:path==='/v2/live/list'?{data:[]}:path==='/v2/course/session/list'?[]:path==='/v1/course/session'?{id:71990,course_id:9397,video_ids:[301],title:'集合与关系',started_at:'2021-04-06 08:00:00'}:path==='/v1/video'?{id:301,main:'https://cvideo.yanhekt.cn/play/timing-room.mp4',vga:'https://cvideo.yanhekt.cn/play/timing.mp4',duration:120}:path==='/v1/video/subtitle/list'?[]:path==='/v1/auth/video/token'?{token:'layout-media',now:1000,expired_at:2000}:null;
   assert.notEqual(data,null,'Unexpected legacy request '+path);return json({code:0,data});
  }
  if(path==='/userapi/v1/infosimple')return json({code:200,params:{id:7,tenant_id:21,phone:'13000000000',account:'fixture'}});
  if(path.endsWith('/get-course-detail'))return json({code:0,data:{id:100,title:'计算机视觉',realname:'示例教师',term_name:'2026-2027-1',sub_list:[{id:200,sub_title:'第一讲 · 图像与视觉',playback_status:'1',class_begin:1}]}});
  if(path.endsWith('/get-sub-info'))return json({code:0,data:{duration:120,video_list:{screen:{type:2,status:2,preview_url:'https://aita.yanhekt.cn/play/timing.mp4'},room:{type:3,status:2,preview_url:'https://aita.yanhekt.cn/play/timing-room.mp4'}}}});
  if(path.endsWith('/search-trans-result'))return json({code:0,list:[{all_content:[{BeginSec:0,EndSec:60,Text:'第一句示例字幕：保持课程内容清晰可读。'},{BeginSec:60,EndSec:120,Text:'第二句示例字幕。'}]}]});
  if(path.endsWith('/term-list'))return json({code:1000,params:{list:[]}});
  if(path.endsWith('/structures'))return json({code:1000,params:{data:[]}});
  if(path.endsWith('/account-profile/course'))return json({code:1000,params:{result:{data:[],total:0}}});
  if(['www.yanhekt.cn','aita.yanhekt.cn'].includes(url.hostname))return route.fulfill({contentType:'text/html',body:'<!doctype html><html><meta charset=utf-8><body>原站测试页面</body></html>'});
  throw new Error('Unexpected request '+url.hostname+path);
 });
 const auth=await context.newPage();await auth.goto('https://www.yanhekt.cn/home?yh_native=1');await auth.evaluate(()=>localStorage.setItem('auth',JSON.stringify({token:'d'.repeat(32),login:true})));
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 async function getPlayer(){if(!refine)return page;await page.frameLocator('iframe').locator('#play').waitFor();return page.frames().find(f=>f.url().includes('/watch/player.html'));}
 async function readyPlayer(){player=await getPlayer();await player.locator('.lecture-item').first().waitFor({state:'attached'});if(!await player.locator('.lecture-item.selected').count()&&await player.locator('.lecture-pane').isVisible())await player.locator('.lecture-item').first().click();await player.locator('#play:not([disabled])').waitFor();}
 async function bounds(){
  const sizes=await player.evaluate(()=>{const r=document.querySelector('.workspace').getBoundingClientRect();return {width:r.width,height:r.height,innerWidth,innerHeight,full:document.fullscreenElement?.className,overflow:document.documentElement.scrollWidth>innerWidth+1};});
  assert.ok(Math.abs(sizes.width-sizes.innerWidth)<2,JSON.stringify(sizes));assert.ok(Math.abs(sizes.height-sizes.innerHeight)<2,JSON.stringify(sizes));
  if(refine){const box=await page.locator('iframe.watch-frame').boundingBox(),view=page.viewportSize();assert.ok(Math.abs(box.width-view.width)<2,JSON.stringify(box));assert.ok(Math.abs(box.height-view.height)<2,JSON.stringify(box));}
 }
 for(const platform of ['modern','legacy']){
  await worker.evaluate(()=>chrome.storage.local.set({'player:panels':{lectures:true,subtitles:true},'desk:sidebarCollapsed':false}));
  const url=refine?(platform==='modern'?'https://aita.yanhekt.cn/coursedetail?course_id=100&sub_id=200':'https://www.yanhekt.cn/session/71990'):`chrome-extension://${id}/player.html?`+(platform==='modern'?'course=100':'legacy_session=71990');
  await page.goto(url);await readyPlayer();
  report.themes[platform]=await player.evaluate(()=>{const style=getComputedStyle(document.documentElement);return {font:style.fontSize,ink:style.getPropertyValue('--ink').trim(),accent:style.getPropertyValue('--teal').trim(),title:getComputedStyle(document.querySelector('.watch-heading h2')).fontSize};});
  assert.equal(report.themes[platform].font,'16px');assert.equal(report.themes[platform].accent,'#007b83');
  if(refine){
   const before=(await page.locator('iframe.watch-frame').boundingBox()).width;await page.getByRole('button',{name:'隐藏侧边栏',exact:true}).click();assert.equal(await page.locator('.sidebar').isVisible(),false);
   assert.ok((await page.locator('iframe.watch-frame').boundingBox()).width>before+150);
   await page.reload();await readyPlayer();assert.equal(await page.locator('.sidebar').isVisible(),false);await page.getByRole('button',{name:'显示侧边栏',exact:true}).click();
   report.checks.push(platform+': main navigation collapses, widens the player and survives reload');
  }
  await (await control('#toggle-lectures')).click();await (await control('#toggle-subtitles')).click();assert.equal(await player.locator('.lecture-pane').isVisible(),false);assert.equal(await player.locator('.transcript-pane').isVisible(),false);
  await page.reload();await readyPlayer();await player.waitForFunction(()=>document.getElementById('toggle-lectures').textContent==='显示课次'&&document.getElementById('toggle-subtitles').textContent==='显示字幕');await (await control('#toggle-lectures')).click();await (await control('#toggle-subtitles')).click();
  assert.equal(await player.locator('.lecture-pane').isVisible(),true);assert.equal(await player.locator('.transcript-pane').isVisible(),true);report.checks.push(platform+': hide/show labels are explicit and normal pane preferences survive reload');
  await (await control('#dual:not([disabled])')).click();await player.locator('#play:not([disabled])').click();await player.waitForFunction(()=>['video','secondary-video'].every(id=>{const v=document.getElementById(id);return v.videoWidth>0&&v.currentTime>.2;}));
  if(platform==='modern'){await player.locator('#control-captions:not([disabled])').click();assert.equal(await player.locator('#show-captions').isChecked(),false);await player.locator('#control-captions').click();assert.equal(await player.locator('#show-captions').isChecked(),true);}else assert.equal(await player.locator('#control-captions').isDisabled(),true);report.checks.push(platform+': direct caption control toggles available video captions independently; an empty transcript leaves it disabled');

  if(platform==='modern'){
   assert.equal(await player.locator('#unmute').count(),0,'no duplicate enable-sound button');
   await player.locator('#control-volume').hover();await player.locator('#menu-volume').waitFor({state:'visible'});
   const icon=await player.locator('#control-volume').boundingBox(),popup=await player.locator('#menu-volume').boundingBox();
   await page.mouse.move(icon.x+icon.width/2,icon.y-2,{steps:3});await page.waitForTimeout(220);assert.equal(await player.locator('#menu-volume').isVisible(),true,'the gap is a hoverable bridge');
   await page.mouse.move(popup.x+popup.width/2,popup.y+popup.height/2,{steps:5});await page.waitForTimeout(220);assert.equal(await player.locator('#menu-volume').isVisible(),true);
   const slider=await player.locator('#audio-volume').boundingBox();await page.mouse.move(slider.x+slider.width/2,slider.y+slider.height*.3);await page.mouse.down();await page.mouse.move(slider.x+slider.width/2,slider.y+slider.height*.65,{steps:5});await page.waitForTimeout(220);assert.equal(await player.locator('#menu-volume').isVisible(),true);await page.mouse.up();
   const volume=Number(await player.locator('#audio-volume').inputValue());assert.ok(volume>5&&volume<80,String(volume));assert.ok(await player.evaluate(()=>['video','secondary-video','tertiary-video','audio-video'].every(id=>Math.abs(document.getElementById(id).volume-Number(document.getElementById('audio-volume').value)/100)<.01)));
   await player.locator('.watch-heading h2').click();await player.locator('#menu-volume').waitFor({state:'hidden'});report.checks.push('volume remains open across the icon/popup gap and during a real drag, and one slider updates every decoder');
   await player.locator('#media-grid').hover({position:{x:20,y:20}});await assertCaptionPlacement(true);const lifted=await player.locator('#video-caption').evaluate(node=>node.getBoundingClientRect().y);
   await player.locator('#media-grid').screenshot({path:join(out,'caption-controls-visible.png')});
   await player.evaluate(()=>document.activeElement?.blur());await page.mouse.move(0,0);await player.locator('#media-grid.controls-idle').waitFor();await assertCaptionPlacement(false);await player.waitForFunction(y=>document.getElementById('video-caption').getBoundingClientRect().y>y+25,lifted);await player.locator('#media-grid').screenshot({path:join(out,'caption-controls-hidden.png')});
   await player.locator('#media-grid').hover({position:{x:20,y:20}});await assertCaptionPlacement(true);report.checks.push('captions lift above visible controls and return toward the image edge after controls hide, without a native duplicate');
   await player.locator('#subtitle-calibration summary').click();await player.locator('#subtitle-offset').fill('30');await player.locator('#offset-form button[type=submit]').click();await player.locator('#video-caption').waitFor({state:'hidden'});await player.locator('#offset-reset').click();await player.locator('#video-caption').waitFor({state:'visible'});report.checks.push('the positioned caption renderer respects subtitle calibration and clearing the offset restores the active cue');
  }

  const before=await player.locator('#video').evaluate(v=>v.currentTime);
  await player.getByRole('button',{name:'网页全屏',exact:true}).click();await player.locator('.workspace.viewer-fullscreen').waitFor();if(refine)await page.locator('iframe.viewer-window-frame').waitFor();await bounds();
  if(platform==='modern')await assertCaptionPlacement(true);
  assert.equal(await player.locator('#secondary-stage').isVisible(),true);await (await control('#toggle-subtitles')).click();assert.equal(await player.locator('.transcript-pane').isVisible(),true);await (await control('#toggle-subtitles')).click();
  await page.screenshot({path:join(out,`viewer-${platform}-browser-fullscreen.png`),timeout:20000});report.checks.push(platform+': browser fullscreen escapes the embedded frame, retains both videos and allows subtitle toggling');
  assert.equal(await player.locator('#display-fullscreen').isDisabled(),false,'Fullscreen permission is delegated to the player');
  await player.getByRole('button',{name:'屏幕全屏',exact:true}).click();await player.waitForFunction(()=>document.fullscreenElement===document.querySelector('.workspace'));await bounds();
  if(platform==='modern'){await assertCaptionPlacement(true);await player.locator('#media-grid').screenshot({path:join(out,'caption-fullscreen-letterbox.png')});report.checks.push('captions remain on the actual letterboxed image in both webpage and screen fullscreen');}
  assert.equal(await player.locator('#secondary-stage').isVisible(),true);await (await control('#dual')).click();assert.equal(await player.locator('#secondary-stage').isVisible(),false);await (await control('#dual')).click();await player.waitForFunction(()=>document.getElementById('secondary-video').videoWidth>0);assert.equal(await player.evaluate(()=>document.fullscreenElement===document.querySelector('.workspace')),true);
  assert.ok((await player.locator('#video').evaluate(v=>v.currentTime))>=before);await page.screenshot({path:join(out,`viewer-${platform}-display-fullscreen.png`),timeout:20000});report.checks.push(platform+': real Fullscreen API contains the workspace; switching dual/single keeps fullscreen and playback');
  await player.getByRole('button',{name:'退出屏幕全屏',exact:true}).click();await player.waitForFunction(()=>!document.fullscreenElement);await player.locator('#browser-fullscreen').press('Escape');await player.waitForFunction(()=>!document.querySelector('.workspace').classList.contains('viewer-fullscreen'));
  assert.equal(await player.locator('.lecture-pane').isVisible(),true);assert.equal(await player.locator('.transcript-pane').isVisible(),true);if(refine)assert.equal(await page.locator('iframe.viewer-window-frame').count(),0);await player.locator('#video').evaluate(v=>v.pause());
  report.checks.push(platform+': native exit returns to browser fullscreen; Escape restores the normal layout and previous panes');
  await player.getByRole('button',{name:'屏幕全屏',exact:true}).click();await player.waitForFunction(()=>document.fullscreenElement===document.querySelector('.workspace'));await bounds();await player.getByRole('button',{name:'退出屏幕全屏',exact:true}).click();await player.waitForFunction(()=>!document.fullscreenElement&&document.getElementById('display-fullscreen').textContent==='屏幕全屏');
  assert.equal(await player.locator('.workspace.viewer-fullscreen').count(),0);assert.equal(await player.locator('.lecture-pane').isVisible(),true);assert.equal(await player.locator('.transcript-pane').isVisible(),true);
  report.checks.push(platform+': display fullscreen also starts directly from the normal page and restores both panes on exit');
  await page.screenshot({path:join(out,`viewer-${platform}-normal.png`),fullPage:true,timeout:20000});
 }
 assert.deepEqual(report.themes.modern,report.themes.legacy,'Both sites use identical player typography and colors');
 for(const width of [1920,1280,768,375]){await page.setViewportSize({width,height:1000});await player.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'host overflow '+width);}
 report.checks.push('matching modern/legacy player themes and no horizontal overflow from 375 to 1920 pixels');
 if(refine){const width=await page.locator('iframe.watch-frame').evaluate(frame=>frame.clientWidth);await player.waitForFunction(w=>Math.abs(innerWidth-w)<2,width);const height=await player.evaluate(()=>Math.max(680,Math.min(12000,Math.ceil(document.body.getBoundingClientRect().height+2))));await page.locator('iframe.watch-frame').evaluate(frame=>window.layoutHostFrame=frame);await page.waitForFunction(h=>window.layoutHostFrame?.isConnected&&Math.abs(window.layoutHostFrame.clientHeight-h)<3,height);}
 await player.evaluate(()=>{window.mobileClicks=[];document.addEventListener('click',event=>window.mobileClicks.push({id:event.target.id,text:event.target.textContent?.slice(0,40)}),true);});
 await player.getByRole('button',{name:'网页全屏',exact:true}).click();await player.locator('.workspace.viewer-fullscreen').waitFor();if(refine)await page.locator('iframe.viewer-window-frame').waitFor();await bounds();assert.equal(await player.locator('#secondary-stage').isVisible(),true);assert.ok((await player.locator('#secondary-stage').boundingBox()).height>50);await page.screenshot({path:join(out,'viewer-mobile-browser-fullscreen.png'),timeout:20000});await player.getByRole('button',{name:'退出网页全屏',exact:true}).click();
 report.checks.push('375-pixel browser fullscreen stacks both videos without overflow and keeps exit controls accessible');
 if(refine){
  const seeded=await player.evaluate(()=>chrome.runtime.sendMessage({type:'REFINE_READ',operation:'catalog',args:{type:'upsert',args:{rows:[{platform:'legacy',id:'99001',title:'旧站年份占位',term:'2019-2020（未标注学期）'},{platform:'modern',id:'99002',title:'新版年份占位',term:'2024-2025（未标注学期）'},{platform:'modern',id:'99003',title:'早期年份',term:'2020-2021-2'},{platform:'modern',id:'99004',title:'早期教学课程',term:'2021-2022试用'},{platform:'modern',id:'99005',title:'往年正常课程',term:'2025-2026-2'}]}}}));assert.equal(seeded.ok,true);
  await page.goto('https://aita.yanhekt.cn/searchContent?yh_scope=all&yh_platform=modern');await page.getByLabel('学期',{exact:true}).waitFor();
  const names=await page.getByLabel('学期',{exact:true}).locator('option').allTextContents();assert.deepEqual(names,['全部学期','2026-2027-1','2025-2026-2','2021-2022试用']);
  await page.getByLabel('学期',{exact:true}).selectOption('2021-2022试用');await page.getByRole('link',{name:'早期教学课程',exact:true}).waitFor();
  report.checks.push('modern semester dropdown excludes old-platform placeholders and pre-launch years; the retained 2021-2022 trial actually filters to its course');
 }
 assert.deepEqual(errors,[]);report.ok=true;
}catch(error){report.ok=false;report.error=String(error.stack);report.visible=await player?.locator('body').innerText().catch(()=>null);report.state=await player?.evaluate(()=>({fullscreen:document.fullscreenElement?.className,workspace:document.querySelector('.workspace').className,body:document.body.className,status:document.getElementById('playback-status').textContent,mobileClicks:window.mobileClicks})).catch(()=>null);process.exitCode=1;await page?.screenshot({path:join(out,'viewer-layout-failed.png'),timeout:10000}).catch(()=>{});}
finally{await context?.close();if(dirname(scratch)===resolve(tmpdir())&&basename(scratch).startsWith('yanhe-viewer-layout-'))await rm(scratch,{recursive:true,force:true});await writeFile(join(out,'viewer-layout-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
