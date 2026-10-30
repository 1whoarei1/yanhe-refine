import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm,cp} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),temp=await mkdtemp(join(tmpdir(),'yanhe-mode-test-')),extension=join(temp,'extension'),profile=join(temp,'profile'),output=join(root,'test-results');
await cp(resolve(process.env.EXTENSION_PATH||join(root,'extension')),extension,{recursive:true});await writeFile(join(extension,'build-info.json'),JSON.stringify({version:JSON.parse(await readFile(join(root,'package.json'),'utf8')).version,catalog:null}));
await mkdir(output,{recursive:true});
const report={version:JSON.parse(await readFile(join(root,'package.json'),'utf8')).version,mode:'isolated Edge; synthetic native pages; no real platform requests',checks:[]};let context;
const html='<!doctype html><html><head><meta charset="utf-8"></head><body><h1>原站功能</h1><input aria-label="原站输入"><a href="https://aita.yanhekt.cn/workbenchAi?tenant_code=21">原站入口</a><a href="https://aita.yanhekt.cn/coursedetail?course_id=110118" target="_blank">新标签课程</a><a href="https://www.yanhekt.cn/home">旧站入口</a><a href="https://aita.yanhekt.cn/searchContent?title=视觉">新版入口</a><button id="spa" onclick="history.pushState({},\'\',\'/personal/#/myStudy/myCourse\')">原站内部导航</button></body></html>';
async function launch(){
 const browser=await chromium.launchPersistentContext(profile,{executablePath:process.env.BROWSER_EXECUTABLE||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1280,height:900}});
 await browser.route('https://**/*',route=>{const u=new URL(route.request().url());const legacyRedirect=u.hostname==='www.yanhekt.cn'&&['/','/home'].includes(u.pathname)&&u.searchParams.get('yh_native')==='1';return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:legacyRedirect?'<!doctype html><script>location.replace("/profile/myCourse")</script>':['aita.yanhekt.cn','www.yanhekt.cn'].includes(u.hostname)?html:'<!doctype html><html>Unavailable fixture</html>'});});
 return browser;
}
const native=async page=>{await page.getByRole('heading',{name:'原站功能',exact:true}).waitFor();await page.getByRole('link',{name:'返回延河课堂焕新版'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.dataset.refine),undefined);assert.equal(await page.evaluate(()=>document.documentElement.hasAttribute('data-refine-pending')),false);};
const refined=async page=>{await page.waitForFunction(()=>document.documentElement.dataset.refine==='active');await page.getByRole('link',{name:'恢复原版',exact:true}).waitFor();};
async function actualView(page){const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');return worker.evaluate(async url=>{const tabs=await chrome.tabs.query({url:['https://aita.yanhekt.cn/*','https://www.yanhekt.cn/*']});const tab=tabs.find(value=>value.url===url);if(!tab)throw new Error('Fixture tab not found');return chrome.tabs.sendMessage(tab.id,{type:'REFINE_GET_VIEW'});},page.url());}
try{
 context=await launch();let page=await context.newPage();await page.goto('https://aita.yanhekt.cn/portal/#/');await refined(page);
 await page.getByRole('link',{name:'恢复原版',exact:true}).click();await native(page);
 await page.getByRole('textbox',{name:'原站输入'}).fill('原站保持可操作');
 await page.getByRole('link',{name:'原站入口',exact:true}).click();await native(page);assert.equal(new URL(page.url()).searchParams.has('yh_native'),false);
 assert.equal((await actualView(page)).mode,'native');
 await page.reload();await native(page);await page.getByRole('button',{name:'原站内部导航'}).click();await native(page);
 const [opened]=await Promise.all([context.waitForEvent('page'),page.getByRole('link',{name:'新标签课程',exact:true}).click()]);await native(opened);await opened.close();
 await page.getByRole('link',{name:'旧站入口',exact:true}).click();await native(page);await page.getByRole('link',{name:'新版入口',exact:true}).click();await native(page);
 report.checks.push('restoring native survives unmarked entry links, refresh, SPA navigation, new tabs and switching between both platform origins');
 await context.close();context=await launch();page=await context.newPage();await page.goto('https://www.yanhekt.cn/home');await native(page);report.checks.push('native preference survives a browser restart in the same isolated profile');
 await page.getByRole('link',{name:'返回延河课堂焕新版'}).click();await refined(page);
 assert.equal((await actualView(page)).mode,'refine');report.checks.push('toolbar view queries reach real content scripts and distinguish native/refine after navigating to an unmarked URL');
 const other=await context.newPage();await other.goto('https://aita.yanhekt.cn/portal/#/');await refined(other);report.checks.push('explicit return restores Refine and clears the native preference for subsequent entry pages');await other.close();
 await page.goto('https://aita.yanhekt.cn/portal/?yh_native=1#/');await native(page);await page.goto('https://aita.yanhekt.cn/portal/#/');await refined(page);report.checks.push('one-page native login links do not permanently change the chosen viewing mode');
 await page.goto('https://aita.yanhekt.cn/personal/?yh_view=settings');await refined(page);
 for(const name of ['新延河','旧延河','新乐学','旧乐学'])assert.equal(await page.getByRole('link',{name,exact:true}).count(),1);
 assert.match(await page.locator('#connection-status').innerText(),/新延河[\s\S]*旧延河/);
 await page.getByRole('link',{name:'旧延河',exact:true}).click();await native(page);
 assert.equal(new URL(page.url()).pathname,'/profile/myCourse');assert.equal(new URL(page.url()).search,'');
 await page.getByRole('textbox',{name:'原站输入'}).fill('旧课堂登录保持原站');
 await page.getByRole('link',{name:'旧站入口',exact:true}).click();await native(page);
 report.checks.push('the legacy classroom login entry remains native after a redirect drops query parameters and subsequent native navigation');
 await page.getByRole('link',{name:'返回延河课堂焕新版'}).click();await refined(page);
 await page.goto('https://aita.yanhekt.cn/portal/#/');await refined(page);
 report.checks.push('returning from legacy login restores Refine on both classroom sites');
 await page.getByRole('link',{name:'恢复原版',exact:true}).click();await native(page);await page.screenshot({path:join(output,'site-native-mode.png'),fullPage:true});report.ok=true;
}catch(error){report.ok=false;report.error=String(error.stack);process.exitCode=1;if(context){report.pages=await Promise.all(context.pages().map(p=>p.evaluate(()=>({url:location.href,view:document.documentElement.dataset.refine,pending:document.documentElement.hasAttribute('data-refine-pending'),text:document.body?.innerText.slice(0,1600)})).catch(()=>null)));const worker=context.serviceWorkers()[0];if(worker)report.preference=await worker.evaluate(()=>chrome.storage.local.get('refine:siteMode')).catch(()=>null);await context.pages().at(-1)?.screenshot({path:join(output,'site-mode-failed.png'),fullPage:true}).catch(()=>{});}}
finally{if(context)await context.close();if(dirname(resolve(temp))===resolve(tmpdir())&&basename(temp).startsWith('yanhe-mode-test-'))await rm(temp,{recursive:true,force:true});await writeFile(join(output,'site-mode-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
