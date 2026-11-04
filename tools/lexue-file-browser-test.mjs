import assert from 'node:assert/strict';
import {mkdir,mkdtemp,cp,rm,writeFile} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {installMoodleFileFixture} from './moodle-file-fixture.mjs';
const root=process.cwd(),scratch=await mkdtemp(join(tmpdir(),'yanhe-lexue-file-')),ext=join(scratch,'extension'),report={mode:'isolated Edge; synthetic final file-response metadata; no real account requests',requests:[],failures:[]};let context;
await cp(resolve(process.env.EXTENSION_PATH||'extension'),ext,{recursive:true});
await installMoodleFileFixture(ext);
try{
 context=await chromium.launchPersistentContext(join(scratch,'profile'),{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
 context.on('requestfailed',request=>report.failures.push({path:new URL(request.url()).pathname,error:request.failure()?.errorText}));
 await context.route('https://**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;report.requests.push(path);const html=body=>route.fulfill({contentType:'text/html',body:'<html><body class="course-20290"><main id="region-main">'+body+'</main></body></html>'});
  if(url.hostname!=='lexue.bit.edu.cn')return route.fulfill({status:403,body:'Offline fixture'});
  if(path==='/my/')return html('<script>M.cfg={"wwwroot":"https://lexue.bit.edu.cn","sesskey":"fixture123"};</script>');
  if(path==='/lib/ajax/service.php')return route.fulfill({contentType:'application/json',body:JSON.stringify([{data:{courses:[{id:20290,fullname:'操作系统',visible:true}],nextoffset:1}}])});
  if(path==='/course/view.php')return html('<li id="module-9001" class="activity modtype_assign"><div class="activityinstance"><a href="/mod/resource/view.php?id=9001"><span class="instancename">实验报告模板</span></a></div></li>');
  if(path==='/mod/resource/view.php')return route.fulfill({status:302,headers:{Location:'https://lexue.bit.edu.cn/pluginfile.php/1901/mod_resource/content/0/report.docx?forcedownload=1'},body:''});
  if(path.startsWith('/pluginfile.php/'))return route.fulfill({status:206,contentType:'text/html',headers:{'Content-Range':'bytes 0-0/23','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent('实验报告模板.doc')},body:'P'});
  throw Error('Unexpected fixture path '+path);
 });
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),page=await context.newPage();await page.goto('chrome-extension://'+new URL(worker.url()).host+'/desk.html#/settings');
 const result=await page.evaluate(async()=>chrome.runtime.sendMessage({type:'REFINE_READ',operation:'lexue',args:{method:'material',args:[20290,9001]}}));
 report.result=result;assert.equal(result.ok,true);assert.equal(result.value.attachments[0].name,'实验报告模板.doc');report.resourceReads=await worker.evaluate(()=>globalThis.fixtureResourceReads);assert.equal(report.resourceReads[0].range,'bytes=0-0');report.ok=true;
}catch(error){report.ok=false;report.error=String(error.stack);process.exitCode=1;}
finally{await context?.close();if(dirname(scratch)===resolve(tmpdir())&&basename(scratch).startsWith('yanhe-lexue-file-'))await rm(scratch,{recursive:true,force:true});await mkdir(join(root,'test-results'),{recursive:true});await writeFile(join(root,'test-results/lexue-file-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
