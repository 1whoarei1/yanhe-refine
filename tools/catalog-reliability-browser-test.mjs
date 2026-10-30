import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {writeFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from 'playwright';

const bundle=await build({stdin:{contents:"export {perform,catalogOperation} from './src/catalog-worker.js';export {readImportedCatalog} from './src/watch/catalog-import.js';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/catalog.js'?'text/javascript':'text/html');res.end(req.url==='/catalog.js'?bundle.outputFiles[0].text:'<!doctype html><title>Catalog transaction fixtures</title>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
const report={mode:'isolated Edge; synthetic catalogs; real IndexedDB transactions',checks:[]};
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const result=await page.evaluate(async()=>{
  const listeners=[];globalThis.chrome={runtime:{},storage:{local:{set:async()=>{for(const fn of listeners)fn({'catalog:importRevision':{}},'local');}},onChanged:{addListener:fn=>listeners.push(fn)}}};
  const {perform,readImportedCatalog}=await import('/catalog.js');
  const course=(id,sessions)=>({id,name:'Fixture '+id,term:'2026-2027-1',teachers:[],sessions});
  const snapshot=(date,courses)=>({format:'yanhekt-session-index/v1',generatedAt:date,partial:true,source:{kind:'self-collected'},courses});
  const apply=value=>perform('import',{name:'fixture.json',buffer:new TextEncoder().encode(JSON.stringify(value)).buffer});
  const result={};await perform('init');
  await perform('upsert',{rows:[{platform:'modern',id:'100',title:'Modern fixture'},{platform:'legacy',id:'2',title:'Old indexed fixture',indexSource:'autoslides'}]});
  await apply(snapshot('2026-10-30T00:00:00Z',[course('1',['11','12']),course('2',['21'])]));
  try{await apply(snapshot('2026-10-20T00:00:00Z',[course('1',['11'])]));}catch(error){result.oldError=error.message;}
  result.afterOld={stats:await perform('stats'),sessions:(await readImportedCatalog('sessions')).coverage.sessions};
  try{await apply(snapshot(null,[course('1',['11'])]));}catch(error){result.undatedError=error.message;}
  await apply(snapshot('2026-10-31T00:00:00Z',[course('3',['31'])]));
  result.replaced=await perform('init');result.removed=await perform('get',{key:'legacy:21:2'});
  // A rejected cache read must be evicted so the next attempt actually reads IndexedDB.
  for(const fn of listeners)fn({'catalog:importRevision':{}},'local');
  const get=IDBObjectStore.prototype.get;let failRead=true;
  IDBObjectStore.prototype.get=function(...args){if(this.name==='datasets'&&failRead){failRead=false;throw Error('Synthetic transient read failure');}return get.apply(this,args);};
  try{await readImportedCatalog('sessions');}catch(error){result.readError=error.message;}
  result.recoveredRead=(await readImportedCatalog('sessions')).courses[0].id;IDBObjectStore.prototype.get=get;
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){if(this.name==='datasets')throw new DOMException('Synthetic full disk','QuotaExceededError');return put.apply(this,args);};
  try{await apply(snapshot('2026-11-01T00:00:00Z',[course('4',['41'])]));}catch(error){result.writeError=error.message;}finally{IDBObjectStore.prototype.put=put;}
  result.afterFailure={sessionCourse:(await readImportedCatalog('sessions')).courses[0].id,hasOld:Boolean(await perform('get',{key:'legacy:21:3'})),hasNew:Boolean(await perform('get',{key:'legacy:21:4'}))};
  // There must be no second database write that can split a successful import.
  const transaction=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(names,mode,...rest){if(this.name==='yanhe-desk'&&mode==='readwrite')throw Error('Second database write forbidden');return transaction.call(this,names,mode,...rest);};
  try{await apply(snapshot('2026-11-01T00:00:00Z',[course('4',['41'])]));}finally{IDBDatabase.prototype.transaction=transaction;}
  await perform('init');result.afterReload={stats:await perform('stats'),sessionCourse:(await readImportedCatalog('sessions')).courses[0].id,hasOld:Boolean(await perform('get',{key:'legacy:21:3'})),hasNew:Boolean(await perform('get',{key:'legacy:21:4'}))};
  return result;
 });
 assert.match(result.oldError,/更旧/);assert.match(result.undatedError,/更新时间/);assert.equal(result.afterOld.stats.legacy,2);assert.equal(result.afterOld.sessions,3);report.checks.push('older and undated replacements cannot downgrade an existing dated catalog');
 assert.equal(result.replaced.legacy,1);assert.equal(result.replaced.modern,1);assert.equal(result.removed,null);report.checks.push('replacement removes obsolete indexed courses, preserves modern courses and survives reloading');
 assert.ok(result.readError);assert.equal(result.recoveredRead,'3');report.checks.push('a transient IndexedDB read failure is retried rather than retained in the cache');
 assert.ok(result.writeError);assert.deepEqual(result.afterFailure,{sessionCourse:'3',hasOld:true,hasNew:false});report.checks.push('an aborted import retains both the previous session snapshot and course list');
 assert.deepEqual(result.afterReload,{stats:result.afterReload.stats,sessionCourse:'4',hasOld:false,hasNew:true});assert.equal(result.afterReload.stats.legacy,1);report.checks.push('one committed snapshot supplies both course and session data without a second database write');
 report.ok=true;
}catch(error){report.ok=false;report.error=String(error.stack);process.exitCode=1;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await mkdir('test-results',{recursive:true});await writeFile('test-results/catalog-reliability-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
