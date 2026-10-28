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

async function control(selector){
 const element=player.locator(selector),menu=await element.evaluate(node=>node.closest('.control-menu')?.id?.replace('menu-',''));
 if(menu&&await player.locator('#menu-'+menu).isHidden()){
  await player.locator('#media-grid').hover();
  if(menu==='volume')await player.locator('#control-volume').hover();else await player.locator('#control-'+menu).click();
  await player.locator('#menu-'+menu).waitFor({state:'visible'});
 }
 return element;
}

let context,page,player,available=4,mediaRequests=0,voicePlaylistRequests=0,legacyMediaRequests=0,legacyVideoTokenRequests=0;const start=Date.now()-5*60000,end=Date.now()+30*60000;
await mkdir(out,{recursive:true});
try{
 for(const view of ['screen','classroom','student','voice']){
  const args=['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=480x270:rate=25'];
  if(view!=='screen')args.push('-f','lavfi','-i','sine=frequency=440:sample_rate=48000');
  args.push('-t','24','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-g','50','-keyint_min','50','-sc_threshold','0');
  args.push(...(view!=='screen'?['-c:a','aac','-b:a','64k']:['-an']));
  args.push('-f','hls','-hls_time','2','-hls_list_size','0','-hls_segment_filename',join(scratch,view+'%03d.ts'),join(scratch,view+'.m3u8'));
  if(view==='voice'){args.splice(0,args.length,'-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=660:sample_rate=48000','-t','24','-c:a','aac','-b:a','64k','-f','hls','-hls_time','2','-hls_list_size','0','-hls_segment_filename',join(scratch,'voice%03d.ts'),join(scratch,'voice.m3u8'));}
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
  if(path.endsWith('get-course-detail'))return json({code:0,data:{title:'计算机新技术专题',realname:'黄河燕',term_name:'2026-2027-1',sub_list:[{id:'1652306',sub_title:'直播测试',sub_status:'1',type:'course_live',playback_status:'0',class_begin:Math.floor(start/1000)},{id:'1652307',sub_title:'仅学生有声',sub_status:'1',type:'course_live',playback_status:'0',class_begin:Math.floor(start/1000)},{id:'1652308',sub_title:'分离音轨',sub_status:'1',type:'course_live',playback_status:'0',class_begin:Math.floor(start/1000)},{id:'2',sub_title:'回放测试',playback_status:'1',class_begin:2}]}});
  if(path.includes('/study-auth/'))return json({code:200,data:{hasPermission:true}});
  if(path.endsWith('get-sub-info'))return json({code:0,data:url.searchParams.get('sub_id')==='2'?{duration:4,video_list:{room:{type:3,status:2,preview_url:'https://aita.yanhekt.cn/play/download.mp4'}}}:{sub_type:'course_live',sub_status:'1',live_url:{output:{m3u8:'https://clive14.yanhekt.cn/live/'+(url.searchParams.get('sub_id')==='1652307'?'screen':url.searchParams.get('sub_id')==='1652308'?'master':'classroom')+'.m3u8'},output_ppt:{m3u8:'https://clive14.yanhekt.cn/live/screen.m3u8'},output_student:{m3u8:'https://clive14.yanhekt.cn/live/student.m3u8'}}}});
  if(path.endsWith('search-trans-result'))return json({code:0,list:[]});
  if(path.endsWith('/term-list'))return json({code:1000,params:{list:[]}});
  if(path.endsWith('/structures'))return json({code:1000,params:{data:[]}});
  if(path.endsWith('/account-profile/course'))return json({code:1000,params:{result:{data:[],total:0}}});
  if(path==='/livingroom')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><meta charset=utf-8><body>Generated test page</body></html>'});
  if(url.hostname==='cbiz.yanhekt.cn'){
   if(path==='/v1/user')return json({code:0,data:{id:7,badge:0}});
   if(path==='/v1/course')return json({code:0,data:{id:73687,name_zh:'计算机新技术专题',school_year:'2026-2027',semester:1,professors:[{name:'黄河燕'}]}});
   if(path==='/v2/live/list'){assert.equal(url.searchParams.get('source_id'),'73687');return json({code:0,data:{data:[{id:795294,source_id:73687,course:{id:73687},title:'计算机新技术专题',status:1,schedule_started_at:new Date(start).toISOString(),schedule_ended_at:new Date(end).toISOString(),target:'https://clive14.yanhekt.cn/legacy-live/classroom.m3u8',target_vga:'https://clive14.yanhekt.cn/legacy-live/screen.m3u8',target_room:'https://clive14.yanhekt.cn/legacy-live/student.m3u8'}]}});}
   if(path==='/v1/live'){assert.equal(url.searchParams.get('id'),'795294');return json({code:0,data:{id:795294,course_id:73687,session_id:916000,title:'计算机新技术专题',status:1,schedule_started_at:new Date(start).toISOString(),schedule_ended_at:new Date(end).toISOString(),target:'https://clive14.yanhekt.cn/legacy-live/classroom.m3u8',target_vga:'https://clive14.yanhekt.cn/legacy-live/screen.m3u8',target_room:'https://clive14.yanhekt.cn/legacy-live/student.m3u8'}});}
   if(path==='/v1/auth/video/token'){legacyVideoTokenRequests++;return route.fulfill({status:403,body:''});}
  }
  if(path==='/home')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><meta charset=utf-8><body>Generated old login shell</body></html>'});
  if(path.startsWith('/live/')||path.startsWith('/legacy-live/')){
   mediaRequests++;if(path.startsWith('/legacy-live/')){legacyMediaRequests++;assert.equal([...url.searchParams].length,0,'old clive fixture must retain its original URL');}if(path.endsWith('/voice.m3u8'))voicePlaylistRequests++;
   if(request.method()==='HEAD')return route.fulfill({status:200,body:''});
   const file=basename(path);if(file==='master.m3u8')return route.fulfill({contentType:'application/vnd.apple.mpegurl',body:'#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="sound",NAME="voice",DEFAULT=YES,AUTOSELECT=YES,URI="voice.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=500000,CODECS="avc1.42c01e,mp4a.40.2",AUDIO="sound"\nscreen.m3u8\n'});assert.match(file,/^(screen|classroom|student|voice)(\.m3u8|\d{3}\.ts)$/);
   if(file.endsWith('.m3u8')){const view=file.slice(0,-5);return route.fulfill({contentType:'application/vnd.apple.mpegurl',body:'#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:0\n'+Array.from({length:available},(_,i)=>`#EXTINF:2.000,\n${view}${String(i).padStart(3,'0')}.ts\n`).join('')});}
   return route.fulfill({contentType:'video/mp2t',body:await readFile(join(scratch,file))});
  }
  if(path==='/play/download.mp4'){
   const fixture=join(root,refine?'../yanhe-replay-extension/tests/fixtures/download.mp4':'tests/fixtures/download.mp4'),body=await readFile(fixture),range=/bytes=(\d+)-(\d*)/.exec(request.headers()['range']||'');if(range){const first=Number(range[1]),last=range[2]?Math.min(Number(range[2]),body.length-1):body.length-1;return route.fulfill({status:206,headers:{'content-type':'video/mp4','accept-ranges':'bytes','content-range':`bytes ${first}-${last}/${body.length}`},body:body.subarray(first,last+1)});}return route.fulfill({contentType:'video/mp4',headers:{'accept-ranges':'bytes'},body});
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
 const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,page.url());
 await worker.evaluate(id=>chrome.tabs.update(id,{muted:true}),tabId);await player.locator('#video').evaluate(v=>v.volume=0);await (await control('#audio-source')).selectOption('muted');
 await (await control('#control-volume')).click();await player.waitForFunction(()=>{const v=document.getElementById('video');return !v.muted&&v.volume>0&&!v.paused;});
 assert.equal(await worker.evaluate(async id=>(await chrome.tabs.get(id)).mutedInfo.muted,tabId),false);
 report.checks.push('enable-sound gesture clears selected mute, zero volume and the extension tab mute');
 await (await control('#screen')).click();await player.waitForFunction(()=>{const a=document.getElementById('video'),b=document.getElementById('audio-video');return a.muted&&!b.muted&&b.webkitAudioDecodedByteCount>0&&!b.paused;});
 assert.equal(await player.locator('#secondary-stage').isVisible(),false);
 report.checks.push('silent screen-only view gets classroom audio through a hidden companion decoder');
 await (await control('#dual')).click();await player.waitForFunction(()=>document.getElementById('secondary-video').videoWidth>0&&!document.getElementById('secondary-video').muted);assert.equal(await player.locator('#secondary-stage').isVisible(),true);
 await (await control('#audio-source')).selectOption('screen');assert.deepEqual(await player.evaluate(()=>['video','secondary-video'].map(id=>document.getElementById(id).muted)),[false,true]);
 await (await control('#audio-source')).selectOption('muted');assert.deepEqual(await player.evaluate(()=>['video','secondary-video'].map(id=>document.getElementById(id).muted)),[true,true]);
 await (await control('#audio-source')).selectOption('classroom');assert.deepEqual(await player.evaluate(()=>['video','secondary-video'].map(id=>document.getElementById(id).muted)),[true,false]);
 report.checks.push('dual view and explicit screen/classroom/muted choices route only the selected sound');
 await player.locator('#secondary-video').evaluate(v=>{window.savedSecondaryPlay=v.play;v.play=()=>Promise.reject(new DOMException('generated autoplay rejection','NotAllowedError'));v.pause();});
 await (await control('#audio-source')).selectOption('classroom');await player.locator('#control-volume[data-audio-blocked=true]').waitFor();
 assert.equal(await player.locator('#dual').getAttribute('aria-pressed'),'true');
 await player.locator('#secondary-video').evaluate(v=>v.play=window.savedSecondaryPlay);await (await control('#control-volume')).click();
 await player.waitForFunction(()=>{const b=document.getElementById('secondary-video');return !b.paused&&!b.muted&&!document.getElementById('control-volume').hasAttribute('data-audio-blocked')&&!document.getElementById('playback-status').textContent.includes('浏览器暂未允许声音');});
 report.checks.push('autoplay sound rejection remains visible and the enable-sound gesture recovers without dropping dual view');
 await player.evaluate(()=>document.getElementById('control-volume').addEventListener('click',()=>{const context=window.testAudio=new AudioContext(),analyser=window.testAnalyser=context.createAnalyser(),gain=context.createGain();gain.gain.value=0;context.createMediaElementSource(document.getElementById('secondary-video')).connect(analyser);analyser.connect(gain).connect(context.destination);void context.resume();},{once:true}));
 await (await control('#control-volume')).click();await (await control('#control-volume')).click();await player.waitForFunction(()=>{const samples=new Float32Array(window.testAnalyser.fftSize);window.testAnalyser.getFloatTimeDomainData(samples);return window.audioRms=Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length)>.005;});
 report.classroomAudioSignal=true;report.checks.push('the classroom decoder yields a nonzero audio waveform, with the test output muted by a zero-gain analysis graph');


 await (await control('#triple')).click();await player.waitForFunction(()=>['video','secondary-video','tertiary-video'].every(id=>document.getElementById(id).videoWidth>0));
 await (await control('#audio-source')).selectOption('student');await player.waitForFunction(()=>['video','secondary-video','tertiary-video','audio-video'].filter(id=>!document.getElementById(id).muted).join(',')==='tertiary-video');
 await player.locator('#audio-volume').evaluate(input=>{input.value='25';input.dispatchEvent(new Event('input',{bubbles:true}));});assert.ok(await player.evaluate(()=>['video','secondary-video','tertiary-video','audio-video'].every(id=>document.getElementById(id).volume===.25)));
 await player.getByRole('button',{name:'网页全屏',exact:true}).click();await player.locator('.workspace.viewer-fullscreen').waitFor();assert.equal(await player.locator('#tertiary-stage').isVisible(),true);
 await player.getByRole('button',{name:'屏幕全屏',exact:true}).click();await player.waitForFunction(()=>document.fullscreenElement===document.querySelector('.workspace'));assert.equal(await player.locator('#tertiary-stage').isVisible(),true);await player.getByRole('button',{name:'退出屏幕全屏',exact:true}).click();await player.waitForFunction(()=>!document.fullscreenElement);await player.getByRole('button',{name:'退出网页全屏',exact:true}).click();
 report.checks.push('three decoded views and global volume retain exactly one student audio source in both fullscreen modes');
 async function assertThreeLayout(){const boxes=await player.evaluate(()=>['video','secondary-video','tertiary-video'].map(id=>document.getElementById(id).parentElement.getBoundingClientRect().toJSON()));const [main,top,bottom]=boxes;assert.ok(main.width>top.width*1.8&&main.height>top.height*1.8,JSON.stringify(boxes));assert.ok(Math.abs(main.top-top.top)<2&&Math.abs(main.bottom-bottom.bottom)<2,JSON.stringify(boxes));assert.ok(Math.abs(top.left-bottom.left)<2&&top.bottom<=bottom.top&&main.right<top.left,JSON.stringify(boxes));}
 await assertThreeLayout();await player.locator('#media-grid').screenshot({path:join(out,'three-stream-layout.png'),timeout:20000});await player.getByRole('button',{name:'网页全屏',exact:true}).click();await player.locator('.workspace.viewer-fullscreen').waitFor();await assertThreeLayout();await player.getByRole('button',{name:'屏幕全屏',exact:true}).click();await player.waitForFunction(()=>document.fullscreenElement===document.querySelector('.workspace'));await assertThreeLayout();await player.getByRole('button',{name:'退出屏幕全屏',exact:true}).click();await player.waitForFunction(()=>!document.fullscreenElement);await player.getByRole('button',{name:'退出网页全屏',exact:true}).click();
 report.checks.push('normal, browser-fullscreen and display-fullscreen triple layouts all put one large view left and two stacked views right');

 await (await control('#student')).click();await player.waitForFunction(()=>document.getElementById('video').webkitAudioDecodedByteCount>0&&!document.getElementById('video').muted);assert.equal(await player.locator('#triple').getAttribute('aria-pressed'),'true');
 await (await control('#screen')).click();await player.waitForFunction(()=>document.getElementById('video').videoWidth>0);await (await control('#dual')).click();await (await control('#secondary-view')).selectOption('student');await (await control('#audio-source')).selectOption('classroom');
 await player.waitForFunction(()=>{const v=document.getElementById('audio-video');return !v.muted&&v.webkitAudioDecodedByteCount>0&&!v.paused;});assert.equal(await player.locator('#tertiary-stage').isVisible(),false);
 report.checks.push('switching the main view preserves triple mode; dual screen/student can use a hidden classroom sound source');
 await player.locator('#video').evaluate(v=>v.pause());await (await control('#timely-mode')).click();await player.locator('#video').scrollIntoViewIfNeeded();
 await player.waitForFunction(()=>{const v=document.getElementById('video');return v.buffered.length&&v.paused&&v.buffered.end(v.buffered.length-1)-v.currentTime<.08&&window.renderedFrame>=v.buffered.end(v.buffered.length-1)-.1;});
 const first=await player.locator('#video').evaluate(v=>({time:v.currentTime,end:v.buffered.end(v.buffered.length-1),rendered:window.renderedFrame,paused:v.paused}));report.firstLatestFrame=first;
 available=6;
 await player.waitForFunction(before=>{const v=document.getElementById('video'),end=v.buffered.length?v.buffered.end(v.buffered.length-1):0;return end>before+3&&v.paused&&end-v.currentTime<.08&&window.renderedFrame>=end-.1;},first.end);
 report.nextLatestFrame=await player.locator('#video').evaluate(v=>({time:v.currentTime,end:v.buffered.end(v.buffered.length-1),rendered:window.renderedFrame,paused:v.paused}));
 report.checks.push('timely mode renders the last downloaded frame, follows a newly appended live segment, and preserves pause');
 await (await control('#timely-mode')).click();const stopped=await player.locator('#video').evaluate(v=>({time:v.currentTime,end:v.buffered.end(v.buffered.length-1)}));available=7;
 await player.waitForFunction(before=>{const v=document.getElementById('video');return v.buffered.length&&v.buffered.end(v.buffered.length-1)>before+1;},stopped.end);
 assert.ok(Math.abs(await player.locator('#video').evaluate(v=>v.currentTime)-stopped.time)<.05);
 report.checks.push('disabling timely mode stops automatic frame jumps while new data continues to buffer');
 await (await control('#timely-mode')).click();await player.getByRole('button',{name:'回放',exact:true}).click();await player.getByRole('button',{name:/回放测试/}).click();await player.locator('#play:not([disabled])').waitFor();
 assert.equal(await player.locator('#timely-mode').isVisible(),false);await player.locator('#play').click();await player.waitForFunction(()=>{const v=document.getElementById('video');return v.currentTime>.15&&v.currentTime<2;});await player.locator('#video').evaluate(v=>v.pause());
 report.checks.push('a saved timely preference never seeks replay playback to its end');

 await player.getByRole('button',{name:'直播',exact:true}).click();await player.getByRole('button',{name:/仅学生有声/}).click();await (await control('#audio-source')).selectOption('auto');await player.locator('#play:not([disabled])').click();
 await player.waitForFunction(()=>document.getElementById('audio-status').textContent.includes('学生 · 已检测到音轨'));assert.ok(await player.evaluate(()=>['video','secondary-video','tertiary-video'].every(id=>document.getElementById(id).muted)&&!document.getElementById('audio-video').muted));
 report.checks.push('automatic audio skips a silent main camera and locates the student-only audio track');
 await player.getByRole('button',{name:/分离音轨/}).click();await player.locator('#play:not([disabled])').click();await player.waitForFunction(()=>document.getElementById('video').webkitAudioDecodedByteCount>0);assert.ok(voicePlaylistRequests>0);
 report.checks.push('the full HLS build fetches and decodes an external audio playlist');
 await page.goto('about:blank');const requestsBefore=mediaRequests;
 await page.goto(refine?'https://aita.yanhekt.cn/livingroom?course_id=102154&sub_id=1652306&tenant_code=21':`chrome-extension://${id}/player.html?course=102154&sub_id=1652306`);
 if(refine){await page.frameLocator('iframe.watch-frame').locator('#play').waitFor();player=page.frames().find(f=>f.url().includes('/watch/player.html'));}else player=page;
 await player.locator('#play:not([disabled])').waitFor();assert.equal(await player.locator('#timely-mode').getAttribute('aria-pressed'),'true');assert.equal(mediaRequests,requestsBefore);
 report.checks.push('the timely preference survives navigation without requesting media before a new user action');
 await (await control('#timely-mode')).click();await (await control('#timely-mode')).click();await player.locator('#video').scrollIntoViewIfNeeded();
 await player.waitForFunction(()=>{const v=document.getElementById('video'),end=v.buffered.length?v.buffered.end(v.buffered.length-1):0;return end>10&&v.videoWidth>0&&end-v.currentTime<.1&&window.renderedFrame>=end-.1&&document.getElementById('timely-status').textContent==='最新缓存帧';});
 report.checks.push('enabling timely mode before ordinary play connects the live source and displays its newest downloaded frame');


 await player.waitForFunction(()=>{const v=document.getElementById('audio-video');return v.webkitAudioDecodedByteCount>0&&!v.paused&&!v.muted;});const soundBefore=await player.locator('#audio-video').evaluate(v=>{window.voiceSeeks=0;v.addEventListener('seeking',()=>window.voiceSeeks++);return v.currentTime;});
 await player.locator('#video').evaluate(v=>v.currentTime=8.5);await player.waitForTimeout(250);await player.locator('#video').evaluate(v=>v.currentTime=13);await player.waitForTimeout(300);
 const soundAfter=await player.locator('#audio-video').evaluate(v=>v.currentTime);assert.ok(soundAfter>soundBefore&&soundAfter-soundBefore<1.5);assert.equal(await player.evaluate(()=>window.voiceSeeks),0);
 report.checks.push('sign-in frame jumps do not seek or interrupt the independently advancing audio clock');
 const oldLogin=await context.newPage();await oldLogin.goto('https://www.yanhekt.cn/home?yh_native=1');await oldLogin.evaluate(()=>localStorage.setItem('auth',JSON.stringify({token:'d'.repeat(32),login:true})));await page.bringToFront();
 await worker.evaluate(()=>chrome.storage.local.set({'player:liveCourseLinks':[{modern:'102154',legacy:'73687'},{modern:'102154',legacy:'73688'}]}));await page.reload();if(refine){await page.frameLocator('iframe.watch-frame').locator('#play').waitFor();player=page.frames().find(f=>f.url().includes('/watch/player.html'));}else player=page;
 await player.locator('#play:not([disabled])').waitFor();await player.waitForFunction(()=>document.getElementById('live-course-candidate').options.length===3);assert.equal(await player.locator('#switch-live-platform').isDisabled(),true);assert.equal(await player.locator('#live-course-candidate').inputValue(),'');report.checks.push('multiple course candidates never preselect the first course or enable an ambiguous switch');await player.locator('#play').click();await player.waitForFunction(()=>document.getElementById('video').videoWidth>0);
 await (await control('#live-platform-tools')).evaluate(details=>details.open=true);await (await control('#alternate-live-url')).fill('https://www.yanhekt.cn/course/73687?yh_native=1');await player.locator('#link-live-form button').click();await player.locator('#active-live-platform').filter({hasText:'旧站'}).waitFor();await player.waitForFunction(()=>document.getElementById('video').videoWidth>0);
 await player.waitForFunction(()=>{const v=document.getElementById('audio-video');return v.webkitAudioDecodedByteCount>0&&!v.muted&&!v.paused;});assert.ok(legacyMediaRequests>0);assert.equal(legacyVideoTokenRequests,0);assert.match(await player.locator('#course-meta').innerText(),/102154/);
 const links=await worker.evaluate(()=>chrome.storage.local.get('player:liveCourseLinks'));assert.ok(links['player:liveCourseLinks'].some(row=>row.modern==='102154'&&row.legacy==='73687'));
 await (await control('#switch-live-platform')).click();await player.locator('#active-live-platform').filter({hasText:'新站'}).waitFor();await player.waitForFunction(()=>document.getElementById('video').videoWidth>0);await oldLogin.close();
 report.checks.push('the supplied cross-platform course pair resolves a separate old live ID, uses its own old media URLs without a replay token, and switches back without changing the logical course ID');
 await player.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.fixtureDiagnostics=value}}));await (await control('#copy-playback-diagnostics')).click();const diagnosis=await player.evaluate(()=>JSON.parse(window.fixtureDiagnostics));assert.equal(diagnosis.version,manifest.version);
assert.equal(diagnosis.media.length,4);assert.equal(diagnosis.course.id,'102154');assert.equal(diagnosis.liveTarget,null);assert.ok(!/https?:|Bearer|Xvideo|_token/.test(JSON.stringify(diagnosis)));report.checks.push('copied diagnostics report runtime version and routing state without media URLs or credentials');


 // Exercise the actual compact control bar rather than exposing hidden menu content to the test.
 await (await control('#audio-source')).waitFor({state:'visible'});
 assert.equal(await player.locator('.playback-tools').count(),0);assert.equal(await player.locator('#video').evaluate(v=>v.controls),false);
 await player.locator('#control-settings').click();assert.equal(await player.locator('#menu-settings').isVisible(),false);await player.locator('#triple').click();
 await player.waitForFunction(()=>['video','secondary-video','tertiary-video'].every(id=>document.getElementById(id).videoWidth>0));await assertThreeLayout();
 await player.locator('#media-grid').hover();await player.locator('#media-grid').screenshot({path:join(out,'compact-controls-three-view.png')});await player.locator('.player-control-dock').screenshot({path:join(out,'compact-controls-toolbar.png')});
 report.checks.push('one in-video toolbar replaces native controls and external playback rows; header pane/download actions stay outside and multiview has direct buttons');
 if(await player.locator('#video').evaluate(v=>v.paused))await player.locator('#control-play').click();
 await player.locator('#control-settings').evaluate(node=>node.blur());await player.locator('#media-grid').hover({position:{x:20,y:20}});
 await player.locator('#media-grid.controls-idle').waitFor();await player.locator('#media-grid').hover({position:{x:30,y:30}});assert.equal(await player.locator('#media-grid.controls-idle').count(),0);
 await player.locator('#control-settings').press('Enter');assert.equal(await player.locator('#menu-settings').isVisible(),true);await player.locator('#control-settings').press('Escape');assert.equal(await player.locator('#menu-settings').isVisible(),false);
 report.checks.push('playing controls hide after inactivity, reveal on pointer movement and support keyboard menus with Escape');
 await player.getByRole('button',{name:'回放',exact:true}).click();await player.getByRole('button',{name:/回放测试/}).click();await player.locator('#play:not([disabled])').waitFor();assert.equal(await player.locator('#triple').isVisible(),false);assert.equal(await player.locator('#download-video').isVisible(),true);await player.locator('#control-play').click();
 await player.waitForFunction(()=>document.getElementById('video').currentTime>.1);await player.locator('#control-play').click();assert.equal(await player.locator('#video').evaluate(v=>v.paused),true);
 const seekBox=await player.locator('#control-seek').boundingBox();await player.locator('#control-seek').click({position:{x:seekBox.width*.6,y:seekBox.height/2}});await player.waitForFunction(()=>document.getElementById('video').currentTime>1.8&&document.getElementById('video').currentTime<2.8);
 await player.locator('#control-speed').click();await player.locator('#speed').selectOption('2');assert.equal(await player.locator('#video').evaluate(v=>v.playbackRate),2);assert.equal(await player.locator('#menu-speed').isVisible(),false);
 await player.locator('#control-volume').click();await player.locator('#control-volume').click();assert.equal(await player.locator('#video').evaluate(v=>v.paused),true);
 await player.locator('#media-grid').press('ArrowLeft');assert.ok(await player.locator('#video').evaluate(v=>v.currentTime<.1));
 report.checks.push('custom play/pause, real range-input seeking, speed changes and keyboard rewind work; toggling sound preserves pause');
 await page.setViewportSize({width:375,height:850});await player.waitForFunction(()=>innerWidth<400);await player.locator('#media-grid').hover();
 const compact=await player.evaluate(()=>{const surface=document.getElementById('media-grid').getBoundingClientRect();return [...document.querySelectorAll('.player-control-row>button,.volume-area>button')].filter(node=>getComputedStyle(node).display!=='none'&&!node.hidden).map(node=>{const box=node.getBoundingClientRect();return {id:node.id,fits:box.left>=surface.left&&box.right<=surface.right};});});assert.ok(compact.every(row=>row.fits),JSON.stringify(compact));
 await player.locator('#control-settings').click();await player.locator('#menu-settings').waitFor({state:'visible'});const menuBox=await player.locator('#menu-settings').boundingBox(),surfaceBox=await player.locator('#media-grid').boundingBox();assert.ok(menuBox.y>=surfaceBox.y&&menuBox.x>=surfaceBox.x&&menuBox.x+menuBox.width<=surfaceBox.x+surfaceBox.width+1);
 await player.locator('#control-settings').press('Escape');await player.locator('#media-grid').screenshot({path:join(out,'compact-controls-mobile.png')});
 report.checks.push('all essential toolbar icons and the scrollable settings menu stay inside the 375-pixel player');

 assert.deepEqual(errors,[]);report.ok=true;
}catch(error){await page?.screenshot({path:join(out,'three-stream-failed.png'),timeout:10000}).catch(()=>{});report.ok=false;report.error=String(error.stack);process.exitCode=1;report.visible=await player?.locator('body').innerText().catch(()=>null);report.media=await player?.evaluate(()=>['video','secondary-video'].map(id=>{const v=document.getElementById(id);return {id,time:v.currentTime,paused:v.paused,seeking:v.seeking,ready:v.readyState,visibility:document.visibilityState,rect:v.getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight],buffered:Array.from({length:v.buffered.length},(_,i)=>[v.buffered.start(i),v.buffered.end(i)]),rendered:window.renderedFrame};})).catch(()=>null);}
finally{await context?.close();if(dirname(scratch)===resolve(tmpdir())&&basename(scratch).startsWith('yanhe-live-features-'))await rm(scratch,{recursive:true,force:true});await writeFile(join(out,'three-stream-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
