import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(await readFile(join(root,'package.json'),'utf8')).version;
const extension=join(root,'dist','yanhe-refine-'+version),catalog=join(extension,'课程目录','课程目录.json');
const expected=JSON.parse(await readFile(catalog,'utf8')).counts;
assert.equal(expected.legacy,0,'public import catalogue must contain modern courses only');
const temp=await mkdtemp(join(tmpdir(),'yanhe-catalog-test-')),report={version,network:'blocked',checks:[]};
let context;
try{
 context=await chromium.launchPersistentContext(join(temp,'profile'),{executablePath:process.env.BROWSER_EXECUTABLE||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1280,height:960}});
 await context.route(/^https?:\/\//,r=>r.abort());
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 const id=new URL(worker.url()).host,page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`chrome-extension://${id}/desk.html#/settings`);
 await page.locator('#import-state').filter({hasText:'0 门'}).waitFor();
 assert.equal(await worker.evaluate(async()=>Boolean((await chrome.storage.local.get('desk:seed'))['desk:seed'])),false);
 report.checks.push('public extension starts with an empty catalogue and does not auto-import bundled data');
 await page.locator('#catalog-file').setInputFiles(catalog);
 await page.locator('#import-state').filter({hasText:expected.total.toLocaleString('en-US')+' 门'}).waitFor({timeout:60000});
 assert.deepEqual(errors,[]);report.checks.push(`settings file picker successfully imported all ${expected.total} course records`);
 await page.reload();await page.locator('#import-state').filter({hasText:expected.total.toLocaleString('en-US')+' 门'}).waitFor();
 const label=await page.locator('.setting-row').first().innerText();assert.ok(label.includes(expected.modern.toLocaleString('en-US'))&&label.includes(expected.legacy.toLocaleString('en-US')));
 const metadata=await worker.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('yanhe-desk');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('courses'),store=tx.objectStore('courses'),all=store.getAll();all.onsuccess=()=>resolve({count:all.result.length,modern:all.result.filter(r=>r.platform==='modern').length,legacy:all.result.filter(r=>r.platform==='legacy').length});};}));
 assert.deepEqual(metadata,{count:expected.total,modern:expected.modern,legacy:expected.legacy});
 await page.getByRole('searchbox',{name:'搜索课程、教师或链接'}).fill('110118');await page.getByRole('searchbox',{name:'搜索课程、教师或链接'}).press('Enter');
 await page.locator('[data-course-key="modern:21:110118"]').waitFor();
 assert.equal(await page.locator('[data-course-key^="legacy:"]').count(),0);
 report.checks.push('import survives reload, offline school-wide search works and no legacy course is imported');
 await page.getByRole('link',{name:'设置',exact:true}).click();await page.locator('#import-state').waitFor();
 await page.screenshot({path:join(root,'test-results','catalog-import.png'),fullPage:true});
 assert.deepEqual(errors,[]);report.ok=true;
}catch(e){report.ok=false;report.error=String(e.stack);process.exitCode=1;}
finally{
 if(context)await context.close();
 if(dirname(resolve(temp))===resolve(tmpdir())&&basename(temp).startsWith('yanhe-catalog-test-'))await rm(temp,{recursive:true,force:true});
 await mkdir(join(root,'test-results'),{recursive:true});await writeFile(join(root,'test-results','catalog-import-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
