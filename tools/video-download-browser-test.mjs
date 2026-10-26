import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm,stat} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),extension=join(root,'extension'),fixtures=join(root,'tests/fixtures'),out=join(root,'test-results');
const temp=await mkdtemp(join(tmpdir(),'yanhe-video-test-')),report={realLectureDownloaded:false,mode:'isolated Edge; synthetic authenticated APIs and audio/video; real streaming writes to browser-private disk; folder-picker boundary substituted',checks:[]};
report.version=JSON.parse(await readFile(join(extension,'manifest.json'),'utf8')).version;
async function executable(name,configured){const value=configured||'D:\\software_entity\\ffmpeg\\bin\\'+name+'.exe';return (await stat(value).catch(()=>null))?.isDirectory()?join(value,name+(process.platform==='win32'?'.exe':'')):value;}
const ffprobe=await executable('ffprobe',process.env.FFPROBE),ffmpeg=await executable('ffmpeg',process.env.FFMPEG);
await mkdir(out,{recursive:true});let context,manager;
try{
 context=await chromium.launchPersistentContext(join(temp,'profile'),{executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1100,height:900}});
 // Substitute only the interactive directory picker. All file handles, writes and aborts use Chromium's filesystem implementation.
 await context.addInitScript(()=>{if(location.pathname.endsWith('/watch/download.html'))window.showDirectoryPicker=async()=>{const root=await navigator.storage.getDirectory();return root.getDirectoryHandle('fixture-downloads',{create:true});};});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 const token='download-fixture-token',serialized=`a:2:{i:0;s:6:"_token";i:1;s:${token.length}:"${token}";}`;
 await context.addCookies([{name:'_token',value:encodeURIComponent(serialized),domain:'aita.yanhekt.cn',path:'/',secure:true,httpOnly:true,sameSite:'None'}]);
 let missing=true,slow=false;const mediaRequests=[],errors=[];
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route('https://**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname;
  assert.equal(req.method(),'GET');const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  if(path==='/userapi/v1/infosimple')return json({code:200,params:{id:7,tenant_id:21,phone:'13000000000',account:'fixture'}});
  if(path.endsWith('/get-course-detail'))return json({code:0,data:{id:100,title:'下载测试课程',realname:'测试教师',term_name:'2026-2027-1',sub_list:[200,201,202].map(n=>({id:n,sub_title:'第'+n+'讲',playback_status:'1',type:'course_live',class_begin:n}))}});
  if(path.endsWith('/get-sub-info')){
   const sub=u.searchParams.get('sub_id');return json({code:0,data:sub==='204'?{sub_type:'course_live',sub_status:'1'}:{duration:4,video_list:sub==='201'?{room:{type:3,status:2,preview_url:'https://aita.yanhekt.cn/play/missing.m3u8'}}:sub==='202'?{screen:{type:2,status:2,preview_url:'https://aita.yanhekt.cn/play/slow.mp4'}}:{screen:{type:2,status:2,preview_url:'https://aita.yanhekt.cn/play/download.mp4'},room:{type:3,status:2,preview_url:'https://aita.yanhekt.cn/play/download.m3u8'}}}});
  }
  if(path.endsWith('/search-trans-result'))return json({code:0,list:[]});
  if(path.startsWith('/play/')){
   mediaRequests.push(path);const name=basename(path);
   if(name==='missing.m3u8')return route.fulfill({contentType:'application/vnd.apple.mpegurl',body:'#EXTM3U\n#EXTINF:4,\nmissing.ts\n#EXT-X-ENDLIST'});
   if(name==='missing.ts')return missing?route.fulfill({status:404,body:''}):route.fulfill({contentType:'video/mp2t',body:await readFile(join(fixtures,'download000.ts'))});
   if(name==='slow.mp4'){if(slow)await new Promise(r=>setTimeout(r,1500));return route.fulfill({contentType:'video/mp4',body:await readFile(join(fixtures,'download.mp4'))}).catch(()=>{});}
   assert.match(name,/^download(?:\.mp4|\.m3u8|\d{3}\.ts)$/);return route.fulfill({contentType:name.endsWith('m3u8')?'application/vnd.apple.mpegurl':name.endsWith('mp4')?'video/mp4':'video/mp2t',body:await readFile(join(fixtures,name))});
  }
  throw new Error('Unexpected fixture request '+path);
 });
 const player=await context.newPage();await player.goto(`chrome-extension://${id}/watch/player.html?course=100`);await player.locator('.lecture-item').first().waitFor();
 assert.equal(await player.getByRole('button',{name:'下载视频'}).isDisabled(),true);await player.locator('.lecture-item').first().click();await player.waitForFunction(()=>!document.getElementById('download-video').disabled);
 assert.equal(mediaRequests.length,0);const newPage=context.waitForEvent('page');await player.getByRole('button',{name:'下载视频'}).click();manager=await newPage;await manager.locator('.channel').first().waitFor();
 assert.equal(await manager.getByLabel('屏幕画面',{exact:true}).isChecked(),true);assert.equal(await manager.getByLabel('教室画面',{exact:true}).isChecked(),false);assert.equal(mediaRequests.length,0);
 await manager.getByRole('button',{name:'选择文件夹并下载'}).click();await manager.getByText('下载完成',{exact:true}).waitFor({timeout:30000});
 assert.ok(mediaRequests.every(p=>p.endsWith('.mp4')));
 const listFiles=async page=>page.evaluate(async()=>{const root=await navigator.storage.getDirectory(),result=[];async function walk(dir,prefix=''){for await(const [name,entry]of dir.entries()){if(entry.kind==='directory')await walk(entry,prefix+name+'/');else{const file=await entry.getFile(),bytes=new Uint8Array(await file.arrayBuffer());let raw='';for(let i=0;i<bytes.length;i+=16384)raw+=String.fromCharCode(...bytes.subarray(i,i+16384));result.push({path:prefix+name,size:file.size,encoded:btoa(raw)});}}}await walk(root);return result;});
 let files=await listFiles(manager);assert.equal(files.length,1);const downloaded=Buffer.from(files[0].encoded,'base64');assert.deepEqual(downloaded,await readFile(join(fixtures,'download.mp4')));
 report.checks.push('player entry defaults to the current view; opening the page requests no video; selected MP4 saves exact original audio/video bytes');
 await manager.getByLabel('全部画面',{exact:true}).check();await manager.getByRole('button',{name:'继续下载未完成画面'}).click();await manager.locator('.channel.done').nth(1).waitFor({timeout:30000});
 files=await listFiles(manager);assert.equal(files.length,2);const ts=files.find(f=>f.path.endsWith('.ts'));assert.ok(ts);const merged=Buffer.from(ts.encoded,'base64'),parts=await Promise.all(['download000.ts','download001.ts'].map(n=>readFile(join(fixtures,n))));assert.deepEqual(merged,Buffer.concat(parts));
 const output=join(temp,'merged.ts');await writeFile(output,merged);
 const probe=spawnSync(ffprobe,['-v','error','-show_entries','stream=codec_type','-show_entries','format=duration','-of','json',output],{encoding:'utf8'});assert.equal(probe.status,0,probe.error?.message);const media=JSON.parse(probe.stdout);assert.ok(media.streams.some(s=>s.codec_type==='video'));assert.ok(media.streams.some(s=>s.codec_type==='audio'));assert.ok(Number(media.format.duration)>=3.8);
 const decode=spawnSync(ffmpeg,['-v','error','-i',output,'-f','null','-'],{encoding:'utf8'});assert.equal(decode.status,0,decode.error?.message);assert.equal(decode.stderr,'');
 report.checks.push('all views save separately; completed views are not downloaded again; HLS output matches every segment and fully decodes with both audio and video');
 await manager.screenshot({path:join(out,'video-download.png'),fullPage:true});await manager.setViewportSize({width:375,height:850});assert.equal(await manager.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await manager.screenshot({path:join(out,'video-download-mobile.png'),fullPage:true});
 const second=await context.newPage();await second.goto(`chrome-extension://${id}/watch/download.html?course=100&lecture=200&view=all`);await second.locator('.channel').first().waitFor();await second.getByRole('button',{name:'选择文件夹并下载'}).click();await second.getByText('下载完成',{exact:true}).waitFor();assert.equal((await listFiles(second)).length,4);await second.close();
 report.checks.push('desktop/mobile download layout fits; existing recordings are preserved with unique filenames');
 await manager.goto(`chrome-extension://${id}/watch/download.html?course=100&lecture=201`);await manager.locator('.channel').waitFor();await manager.getByRole('button',{name:'选择文件夹并下载'}).click();await manager.getByText('下载失败',{exact:true}).waitFor();assert.equal((await listFiles(manager)).length,4);
 missing=false;await manager.getByRole('button',{name:'选择文件夹并下载'}).click();await manager.getByText('下载完成',{exact:true}).waitFor();assert.equal((await listFiles(manager)).length,5);
 await manager.goto(`chrome-extension://${id}/watch/download.html?course=100&lecture=202`);await manager.locator('.channel').waitFor();slow=true;const request=manager.waitForRequest(r=>r.url().includes('/play/slow.mp4'));await manager.getByRole('button',{name:'选择文件夹并下载'}).click();await request;await manager.getByRole('button',{name:'停止下载'}).click();await manager.getByText('已停止',{exact:true}).first().waitFor();assert.equal((await listFiles(manager)).length,5);
 report.checks.push('a missing segment cannot become a completed video; retry works; cancellation removes the unfinished file');
 await manager.goto(`chrome-extension://${id}/watch/download.html?course=100&lecture=204`);await manager.getByText('未找到可下载的回放课次',{exact:true}).waitFor();assert.equal(await manager.locator('#start').isVisible(),false);
 assert.deepEqual(errors,[]);report.checks.push('live-only sessions are not treated as downloadable completed recordings');report.ok=true;
}catch(e){report.ok=false;report.error=String(e.stack).replace(/https?:\/\/\S+/g,'[url]');process.exitCode=1;if(manager)await manager.screenshot({path:join(out,'video-download-failed.png'),fullPage:true}).catch(()=>{});}
finally{if(context)await context.close();if(dirname(resolve(temp))===resolve(tmpdir())&&basename(temp).startsWith('yanhe-video-test-'))await rm(temp,{recursive:true,force:true});await writeFile(join(out,'video-download-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
