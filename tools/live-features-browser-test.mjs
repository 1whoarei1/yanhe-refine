// Generated moving pictures and a sine track only. No campus media or accounts.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {existsSync,statSync} from 'node:fs';
import {resolve,dirname,basename,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),refine=JSON.parse(await readFile(join(root,'package.json'),'utf8')).name==='yanhe-refine';
const ext=resolve(process.env.EXTENSION_PATH||join(root,'extension')),scratch=await mkdtemp(join(tmpdir(),'yanhe-live-features-')),out=join(root,'test-results');
const configured=process.env.FFMPEG||(existsSync('D:/software_entity/ffmpeg/bin/ffmpeg.exe')?'D:/software_entity/ffmpeg/bin/ffmpeg.exe':'ffmpeg');
const ffmpeg=existsSync(configured)&&statSync(configured).isDirectory()?join(configured,'ffmpeg.exe'):configured;
const executable=process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const manifest=JSON.parse(await readFile(join(ext,'manifest.json'),'utf8'));
const report={version:manifest.version,mode:'isolated browser, generated HLS video and AAC sine audio',realLiveVerified:false,checks:[]};
let context,page,player,available=4,mediaRequests=0;
await mkdir(out,{recursive:true});
try{
 for(const view of ['screen','classroom']){
  const args=['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=480x270:rate=25'];
  if(view==='classroom')args.push('-f','lavfi','-i','sine=frequency=440:sample_rate=48000');
  args.push('-t','24','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-g','50','-keyint_min','50','-sc_threshold','0');
  args.push(...(view==='classroom'?['-c:a','aac','-b:a','64k']:['-an']));
  args.push('-f','hls','-hls_time','2','-hls_list_size','0','-hls_segment_filename',join(scratch,view+'%03d.ts'),join(scratch,view+'.m3u8'));
  const result=spawnSync(ffmpeg,args,{encoding:'utf8'});assert.equal(result.status,0,result.error?.message||result.stderr);
 }
 context=await chromium.launchPersistentContext(join(scratch,'profile'),{executablePath:existsSync(executable)?executable:undefined,...(!existsSync(executable)?{channel:'chromium'}:{}),headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`],viewport:{width:1440,height:1000}});
 context.setDefaultTimeout(20000);
 report.browserVersion=context.browser()?.version();
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 await context.addCookies([{name:'_token',value:'eyJfixture.live.signature',domain:'aita.yanhekt.cn',path:'/',secure:true}]);
 await context.route('https://**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  if(path.endsWith('infosimple'))return json({code:200,params:{id:7,tenant_id:21,phone:'13000000000',account:'fixture'}});
  if(path.endsWith('get-course-detail'))return json({code:0,data:{title:'直播画面与声音测试',realname:'测试教师',sub_list:[{id:'1652306',sub_title:'直播测试',sub_status:'1',type:'course_live',playback_status:'0',class_begin:1},{id:'2',sub_title:'回放测试',playback_status:'1',class_begin:2}]}});
  if(path.includes('/study-auth/'))return json({code:200,data:{hasPermission:true}});
  if(path.endsWith('get-sub-info'))return json({code:0,data:url.searchParams.get('sub_id')==='2'?{duration:4,video_list:{room:{type:3,status:2,preview_url:'https://aita.yanhekt.cn/play/download.mp4'}}}:{sub_type:'course_live',sub_status:'1',live_url:{output:{m3u8:'https://clive14.yanhekt.cn/live/classroom.m3u8'},output_ppt:{m3u8:'https://clive14.yanhekt.cn/live/screen.m3u8'}}}});
  if(path.endsWith('search-trans-result'))return json({code:0,list:[]});
  if(path.endsWith('/term-list'))return json({code:1000,params:{list:[]}});
  if(path.endsWith('/structures'))return json({code:1000,params:{data:[]}});
  if(path.endsWith('/account-profile/course'))return json({code:1000,params:{result:{data:[],total:0}}});
  if(path==='/livingroom')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><meta charset=utf-8><body>Generated test page</body></html>'});
  if(path.startsWith('/live/')){
   mediaRequests++;
   if(request.method()==='HEAD')return route.fulfill({status:200,body:''});
   const file=basename(path);assert.match(file,/^(screen|classroom)(\.m3u8|\d{3}\.ts)$/);
   if(file.endsWith('.m3u8')){const view=file.slice(0,-5);return route.fulfill({contentType:'application/vnd.apple.mpegurl',body:'#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:0\n'+Array.from({length:available},(_,i)=>`#EXTINF:2.000,\n${view}${String(i).padStart(3,'0')}.ts\n`).join('')});}
   return route.fulfill({contentType:'video/mp2t',body:await readFile(join(scratch,file))});
  }
  if(path==='/play/download.mp4'){
   const fixture=join(root,refine?'../yanhe-replay-extension/tests/fixtures/download.mp4':'tests/fixtures/download.mp4');return route.fulfill({contentType:'video/mp4',body:await readFile(fixture)});
  }
  return route.fulfill({status:404,body:''});
 });
 page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>addEventListener('DOMContentLoaded',()=>{const video=document.getElementById('video');if(video)video.requestVideoFrameCallback(function frame(_,metadata){window.renderedFrame=metadata.mediaTime;video.requestVideoFrameCallback(frame);});}));
 await page.goto(refine?'https://aita.yanhekt.cn/livingroom?course_id=102154&sub_id=1652306&tenant_code=21':`chrome-extension://${id}/player.html?course=102154&sub_id=1652306`);
 if(refine){await page.frameLocator('iframe.watch-frame').locator('#play').waitFor();player=page.frames().find(f=>f.url().includes('/watch/player.html'));}else player=page;
 await player.locator('#play:not([disabled])').waitFor();await player.locator('#play').click();
 await player.waitForFunction(()=>{const v=document.getElementById('video');return v.currentTime>.2&&v.webkitAudioDecodedByteCount>0;});
 assert.equal(await player.locator('#audio-source').inputValue(),'auto');assert.equal(await player.locator('#video').evaluate(v=>v.muted),false);
 report.checks.push('default live classroom stream really decodes generated AAC audio');
 const openSettings=async()=>{if(!await player.locator('#menu-settings').isVisible()){await player.locator('#media-grid').hover();await player.locator('#control-settings').click();}};
 const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,page.url());
 await worker.evaluate(id=>chrome.tabs.update(id,{muted:true}),tabId);await player.locator('#video').evaluate(v=>v.volume=0);await openSettings();await player.locator('#audio-source').selectOption('muted');
 await player.locator('#control-volume').click();await player.waitForFunction(()=>{const v=document.getElementById('video');return !v.muted&&v.volume>0&&!v.paused;});
 assert.equal(await worker.evaluate(async id=>(await chrome.tabs.get(id)).mutedInfo.muted,tabId),false);
 report.checks.push('enable-sound gesture clears selected mute, zero volume and the extension tab mute');
 await openSettings();await player.locator('#screen').click();await player.waitForFunction(()=>{const a=document.getElementById('video'),b=document.getElementById('audio-video');return a.muted&&!b.muted&&b.webkitAudioDecodedByteCount>0&&!b.paused;});
 assert.equal(await player.locator('#secondary-stage').isVisible(),false);
 report.checks.push('silent screen-only view gets classroom audio through a hidden companion decoder');
 await player.locator('#dual').click();await player.waitForFunction(()=>document.getElementById('secondary-video').videoWidth>0&&!document.getElementById('secondary-video').muted);assert.equal(await player.locator('#secondary-stage').isVisible(),true);
 await openSettings();await player.locator('#audio-source').selectOption('screen');assert.deepEqual(await player.evaluate(()=>['video','secondary-video'].map(id=>document.getElementById(id).muted)),[false,true]);
 await openSettings();await player.locator('#audio-source').selectOption('muted');assert.deepEqual(await player.evaluate(()=>['video','secondary-video'].map(id=>document.getElementById(id).muted)),[true,true]);
 await openSettings();await player.locator('#audio-source').selectOption('classroom');assert.deepEqual(await player.evaluate(()=>['video','secondary-video'].map(id=>document.getElementById(id).muted)),[true,false]);
 report.checks.push('dual view and explicit screen/classroom/muted choices route only the selected sound');
 await player.locator('#secondary-video').evaluate(v=>{window.savedSecondaryPlay=v.play;v.play=()=>Promise.reject(new DOMException('generated autoplay rejection','NotAllowedError'));v.pause();});
 await openSettings();await player.locator('#audio-source').selectOption('classroom');await player.locator('#control-volume[data-audio-blocked=true]').waitFor();
 assert.equal(await player.locator('#dual').getAttribute('aria-pressed'),'true');
 await player.locator('#secondary-video').evaluate(v=>v.play=window.savedSecondaryPlay);await player.locator('#control-volume').click();
 await player.waitForFunction(()=>{const b=document.getElementById('secondary-video');return !b.paused&&!b.muted&&!document.getElementById('control-volume').hasAttribute('data-audio-blocked')&&!document.getElementById('playback-status').textContent.includes('浏览器暂未允许声音');});
 report.checks.push('autoplay sound rejection remains visible and the enable-sound gesture recovers without dropping dual view');
 await openSettings();await player.locator('#audio-source').selectOption('muted');
 await player.evaluate(()=>document.getElementById('control-volume').addEventListener('click',()=>{const context=window.testAudio=new AudioContext(),analyser=window.testAnalyser=context.createAnalyser(),gain=context.createGain();gain.gain.value=0;context.createMediaElementSource(document.getElementById('secondary-video')).connect(analyser);analyser.connect(gain).connect(context.destination);void context.resume();},{once:true}));
 await player.locator('#control-volume').click();await player.waitForFunction(()=>{const samples=new Float32Array(window.testAnalyser.fftSize);window.testAnalyser.getFloatTimeDomainData(samples);return window.audioRms=Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length)>.005;});
 report.classroomAudioSignal=true;report.checks.push('the classroom decoder yields a nonzero audio waveform, with the test output muted by a zero-gain analysis graph');

 await player.locator('#video').evaluate(v=>v.pause());await openSettings();await player.locator('#timely-mode').click();await player.locator('#video').scrollIntoViewIfNeeded();
 await player.waitForFunction(()=>{const v=document.getElementById('video');return v.buffered.length&&v.paused&&v.buffered.end(v.buffered.length-1)-v.currentTime<.08&&window.renderedFrame>=v.buffered.end(v.buffered.length-1)-.1;});
 const first=await player.locator('#video').evaluate(v=>({time:v.currentTime,end:v.buffered.end(v.buffered.length-1),rendered:window.renderedFrame,paused:v.paused}));report.firstLatestFrame=first;
 available=6;
 await player.waitForFunction(before=>{const v=document.getElementById('video'),end=v.buffered.length?v.buffered.end(v.buffered.length-1):0;return end>before+3&&v.paused&&end-v.currentTime<.08&&window.renderedFrame>=end-.1;},first.end);
 report.nextLatestFrame=await player.locator('#video').evaluate(v=>({time:v.currentTime,end:v.buffered.end(v.buffered.length-1),rendered:window.renderedFrame,paused:v.paused}));
 report.checks.push('timely mode renders the last downloaded frame, follows a newly appended live segment, and preserves pause');
 await openSettings();await player.locator('#timely-mode').click();const stopped=await player.locator('#video').evaluate(v=>({time:v.currentTime,end:v.buffered.end(v.buffered.length-1)}));available=7;
 await player.waitForFunction(before=>{const v=document.getElementById('video');return v.buffered.length&&v.buffered.end(v.buffered.length-1)>before+1;},stopped.end);
 assert.ok(Math.abs(await player.locator('#video').evaluate(v=>v.currentTime)-stopped.time)<.05);
 report.checks.push('disabling timely mode stops automatic frame jumps while new data continues to buffer');
 await openSettings();await player.locator('#timely-mode').click();await player.getByRole('button',{name:'回放',exact:true}).click();await player.getByRole('button',{name:/回放测试/}).click();await player.locator('#play:not([disabled])').waitFor();
 assert.equal(await player.locator('#timely-mode').isVisible(),false);await player.locator('#play').click();await player.waitForFunction(()=>{const v=document.getElementById('video');return v.currentTime>.15&&v.currentTime<2;});await player.locator('#video').evaluate(v=>v.pause());
 report.checks.push('a saved timely preference never seeks replay playback to its end');
 const requestsBefore=mediaRequests;
 await page.goto(refine?'https://aita.yanhekt.cn/livingroom?course_id=102154&sub_id=1652306&tenant_code=21':`chrome-extension://${id}/player.html?course=102154&sub_id=1652306`);
 if(refine){await page.frameLocator('iframe.watch-frame').locator('#play').waitFor();player=page.frames().find(f=>f.url().includes('/watch/player.html'));}else player=page;
 await player.locator('#play:not([disabled])').waitFor();assert.equal(await player.locator('#timely-mode').getAttribute('aria-pressed'),'true');assert.equal(mediaRequests,requestsBefore);
 report.checks.push('the timely preference survives navigation without requesting media before a new user action');
 await openSettings();await player.locator('#timely-mode').click();await openSettings();await player.locator('#timely-mode').click();await player.locator('#video').scrollIntoViewIfNeeded();
 await player.waitForFunction(()=>{const v=document.getElementById('video'),end=v.buffered.length?v.buffered.end(v.buffered.length-1):0;return end>10&&v.videoWidth>0&&end-v.currentTime<.1&&window.renderedFrame>=end-.1&&document.getElementById('timely-status').textContent==='最新缓存帧';});
 report.checks.push('enabling timely mode before ordinary play connects the live source and displays its newest downloaded frame');

 assert.deepEqual(errors,[]);report.ok=true;
}catch(error){await page?.screenshot({path:join(out,'live-features-failed.png'),timeout:10000}).catch(()=>{});report.ok=false;report.error=String(error.stack);process.exitCode=1;report.visible=await player?.locator('body').innerText().catch(()=>null);report.media=await player?.evaluate(()=>['video','secondary-video'].map(id=>{const v=document.getElementById(id);return {id,time:v.currentTime,paused:v.paused,seeking:v.seeking,ready:v.readyState,visibility:document.visibilityState,rect:v.getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight],buffered:Array.from({length:v.buffered.length},(_,i)=>[v.buffered.start(i),v.buffered.end(i)]),rendered:window.renderedFrame};})).catch(()=>null);}
finally{await context?.close();if(dirname(scratch)===resolve(tmpdir())&&basename(scratch).startsWith('yanhe-live-features-'))await rm(scratch,{recursive:true,force:true});await writeFile(join(out,'live-features-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
