import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,cp,rm} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),scratch=await mkdtemp(join(tmpdir(),'yanhe-bundled-')),ext=join(scratch,'extension'),out=join(root,'test-results');
await mkdir(out,{recursive:true});await cp(resolve(process.env.EXTENSION_PATH||join(root,'extension')),ext,{recursive:true});
await rm(join(ext,'private-catalog.json'),{force:true});await rm(join(ext,'legacy-session-index.json'),{force:true});
const modern=JSON.parse(await readFile(join(ext,'课程目录/课程目录.json'),'utf8')),sessions=JSON.parse(await readFile(join(ext,'课程目录/旧版课次目录.json'),'utf8'));
const sample=sessions.courses.find(c=>c.sessions.length>1&&Number(c.sessions[1])-Number(c.sessions[0])>1);
const report={mode:'isolated Edge; actual bundled public catalogs; no real school requests',checks:[]};let context,page;
try{
 context=await chromium.launchPersistentContext(join(scratch,'profile'),{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
 await context.route('https://**/*',route=>route.fulfill({status:403,body:'Offline test: external requests disabled'}));
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),origin='chrome-extension://'+new URL(worker.url()).host;
 page=await context.newPage();await page.goto(origin+'/desk.html#/settings');
 const initial=await page.evaluate(async sample=>{
  const {SessionIndex}=await import(chrome.runtime.getURL('watch/session-index.js'));
  const index=new SessionIndex(),owner=await index.owner(sample.sessions[1]);
  const call=async(type,args={})=>{const r=await chrome.runtime.sendMessage({type:'REFINE_READ',operation:'catalog',args:{type,args}});if(!r.ok)throw Error(r.error);return r.value;};
  globalThis.catalogTestCall=call;return {owner,stats:await call('init'),lookup:await call('get',{key:'legacy:21:'+sample.id})};
 },sample);
 assert.equal(initial.stats.modern,modern.courses.length);assert.equal(initial.stats.legacy,sessions.courses.length);assert.equal(initial.owner.id,String(sample.id));assert.equal(initial.lookup.id,String(sample.id));
 report.checks.push('fresh installation exposes both full catalogs and directly resolves noncontiguous session ownership without any manual import or school login');
 const candidates=await page.evaluate(async({old,modern})=>{
  const {liveCourseCandidates}=await import(chrome.runtime.getURL('watch/live-links.js'));
  return {legacy:await liveCourseCandidates({title:old.name,teachers:old.teachers,term:old.term},'legacy'),modern:await liveCourseCandidates(modern,'modern')};
 },{old:sample,modern:modern.courses[0]});
 assert.ok(candidates.legacy.some(row=>row.id===String(sample.id)));assert.ok(candidates.modern.some(row=>row.id===String(modern.courses[0].id)));
 report.checks.push('live candidate lookup works in both directions using only public bundled catalogs, with both obsolete private filenames absent and no school requests');
 await page.locator('#import-state').filter({hasText:(modern.courses.length+sessions.courses.length).toLocaleString('en-US')}).waitFor();
 const updated=await page.evaluate(async()=>{
  const {importCatalog}=await import(chrome.runtime.getURL('watch/catalog-import.js'));
  await globalThis.catalogTestCall('upsert',{rows:[{platform:'modern',id:'100',title:'Older observed metadata'}]});
  await chrome.storage.local.set({'desk:favorites':['modern:21:100'],'progress:100:200':{time:90,view:'screen',updatedAt:1}});
  await importCatalog({schema:1,snapshot_date:'2026-11-05',courses:[{platform:'modern',id:'100',title:'Updated manual catalog'}]});
  await importCatalog({format:'yanhekt-session-index/v1',generatedAt:'2026-11-05T00:00:00Z',partial:true,source:{kind:'self-collected'},courses:[{id:'200',name:'Updated sessions',teachers:[],term:'2026-2027-1',sessions:['201','209']}]});
  const stats=await globalThis.catalogTestCall('stats');return {stats,title:(await globalThis.catalogTestCall('get',{key:'modern:21:100'})).title,records:await chrome.storage.local.get(['desk:favorites','progress:100:200'])};
 });
 assert.equal(updated.stats.modern,1);assert.equal(updated.stats.legacy,1);assert.equal(updated.title,'Updated manual catalog');assert.equal(updated.records['progress:100:200'].time,90);assert.deepEqual(updated.records['desk:favorites'],['modern:21:100']);
 const importedCandidates=await page.evaluate(async()=>{const {liveCourseCandidates}=await import(chrome.runtime.getURL('watch/live-links.js'));return {modern:await liveCourseCandidates({title:'Updated manual catalog'},'modern'),legacy:await liveCourseCandidates({title:'Updated sessions'},'legacy')};});
 assert.deepEqual(importedCandidates.modern.map(row=>row.id),['100']);assert.deepEqual(importedCandidates.legacy.map(row=>row.id),['200']);
 report.checks.push('live lookup immediately follows newer user imports through the same shared catalog reader');
 await page.reload();await page.locator('#import-state').filter({hasText:'2 门'}).waitFor();
 const restored=await page.evaluate(async()=>{const {readImportedCatalog}=await import(chrome.runtime.getURL('watch/catalog-import.js'));return {modern:(await readImportedCatalog('modern')).courses[0].title,sessions:(await readImportedCatalog('sessions')).courses[0].sessions};});
 assert.equal(restored.modern,'Updated manual catalog');assert.deepEqual(restored.sessions,['201','209']);report.checks.push('newer user imports survive reload, replace default data, and preserve favorites and progress');
 const downgrade=await page.evaluate(async()=>{const {importCatalog}=await import(chrome.runtime.getURL('watch/catalog-import.js'));try{await importCatalog({schema:1,snapshot_date:'2026-10-01',courses:[{platform:'modern',id:'300',title:'Old'}]});return false;}catch{return true;}});
 assert.equal(downgrade,true);report.checks.push('an older modern import cannot replace the newer committed catalog');
 report.ok=true;
}catch(error){report.ok=false;report.error=String(error.stack);process.exitCode=1;}
finally{await context?.close();if(dirname(scratch)===resolve(tmpdir())&&basename(scratch).startsWith('yanhe-bundled-'))await rm(scratch,{recursive:true,force:true});await writeFile(join(out,'bundled-catalog-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
