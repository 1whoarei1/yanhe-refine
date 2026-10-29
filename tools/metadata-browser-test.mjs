import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,cp,rm} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),scratch=await mkdtemp(join(tmpdir(),'yanhe-metadata-')),ext=join(scratch,'extension'),out=join(root,'test-results');
await cp(resolve(process.env.EXTENSION_PATH||join(root,'extension')),ext,{recursive:true});await mkdir(out,{recursive:true});
const version=JSON.parse(await readFile(join(ext,'manifest.json'),'utf8')).version;await writeFile(join(ext,'build-info.json'),JSON.stringify({version,catalog:null}));
const report={version,mode:'isolated Edge; synthetic LMS metadata; no media or assignment writes',checks:[]};let context,page;
try{
 context=await chromium.launchPersistentContext(join(scratch,'profile'),{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`],viewport:{width:1440,height:1000}});context.setDefaultTimeout(20000);
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),extensionId=new URL(worker.url()).host,errors=[];
 await context.addCookies([{name:'_token',value:'eyJfixture.metadata.signature',domain:'aita.yanhekt.cn',path:'/',secure:true}]);
 await context.route('https://**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;assert.equal(request.method(),'GET');const json=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(path.endsWith('infosimple'))return json({code:200,params:{id:7,tenant_id:21,account:'fixture',phone:'fixture'}});
  if(path.endsWith('/account-profile/course'))return json({code:1000,params:{result:{data:[{id:100,title:'数据课程',term_name:'2026-2027-1',realname:'示例教师',zhiyuan_id:401},...['2025-2026（未标注学期）','2024-2025（未标记学期）','2023-2024','2020-2021-2'].map((term_name,i)=>({id:101+i,title:'未知学期的课程 '+i,term_name,realname:'示例教师'}))],total:5}}});
  if(path.endsWith('/get-course-detail'))return json({code:0,data:{id:100,title:'数据课程',realname:'示例教师',term_name:'2026-2027-1',sub_list:[]}});
  if(path.endsWith('/get-course-resource'))return json({code:0,data:[]});
  if(url.hostname==='zy-eclass.bit.edu.cn'){
   if(path==='/api/my-courses')return json({courses:[{id:401,name:'数据课程',academic_year:{id:55,name:'2026-2027'},semester:{id:91,name:'第一学期'}},{id:402,name:'往年课程',academic_year:{name:'2025-2026'},semester:{name:'第二学期'}},{id:403,name:'资料不完整的课程',academic_year:{id:6},semester:{id:9}}]});
   if(path==='/api/my-academic-years')return json({academic_years:[{id:55,name:'2026-2027'}]});
   if(path==='/api/my-semesters-all')return json({semesters:[{id:91,name:'第一学期',academic_year_id:55}]});
   if(path.endsWith('courseware-activities'))return json([]);
   if(path.endsWith('homework-activities'))return json({homework_activities:[],page:1,pages:1});
   if(path.endsWith('submission-status'))return json({homework_activities:[]});
   throw Error('Unexpected LMS metadata path '+path);
  }
  if(url.hostname==='lexue.bit.edu.cn')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Login</body></html>'});
  if(['aita.yanhekt.cn','www.yanhekt.cn'].includes(url.hostname))return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Native shell</body></html>'});
  throw Error('Unexpected host '+url.hostname);
 });
 await worker.evaluate(async()=>{
  const request=indexedDB.open('yanhe-desk',1);request.onupgradeneeded=()=>{request.result.createObjectStore('courses',{keyPath:'key'});request.result.createObjectStore('meta');};
  const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const tx=db.transaction('courses','readwrite'),store=tx.objectStore('courses');
  store.put({key:'modern:21:100',id:'100',tenant:'21',title:'数据课程',teacher:'示例教师',teachers:['示例教师'],platform:'modern',term:'2026-2027-1',search:'数据课程 示例教师 100',url:'https://aita.yanhekt.cn/coursedetail?course_id=100'});
  store.put({key:'legacy:21:900001',id:'900001',tenant:'21',title:'历史课程',teacher:'示例教师',teachers:['示例教师'],platform:'legacy',term:'[object Object]-[object Object]',search:'历史课程',url:'https://www.yanhekt.cn/course/900001'});
  for(const [id,term]of [['900002','2024-2025（未标记学期）'],['900003','2023-2024'],['900004','2020-2021-2']])store.put({key:'legacy:21:'+id,id,tenant:'21',title:'旧版历史课程 '+id,teacher:'示例教师',teachers:['示例教师'],platform:'legacy',term,search:'历史课程',url:'https://www.yanhekt.cn/course/'+id});
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 });
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto('https://aita.yanhekt.cn/searchContent?yh_scope=all');await page.getByLabel('学期',{exact:true}).waitFor();
 const repaired=await worker.evaluate(async()=>{const request=indexedDB.open('yanhe-desk',1);const db=await new Promise(resolve=>request.onsuccess=()=>resolve(request.result));const get=db.transaction('courses').objectStore('courses').get('legacy:21:900001');return new Promise(resolve=>get.onsuccess=()=>{const row=get.result;db.close();resolve({id:row.id,title:row.title,term:row.term});});});
 assert.deepEqual(repaired,{id:'900001',title:'历史课程',term:''});report.checks.push('a previously persisted object-string term is repaired without removing its course');
 await page.goto('https://aita.yanhekt.cn/coursedetail?course_id=100&yh_tab=materials');await page.getByLabel('关联乐学课程',{exact:true}).locator('option[value="401"]').waitFor({state:'attached'});
 const options=await page.getByLabel('关联乐学课程',{exact:true}).locator('option').allTextContents();assert.ok(options.some(label=>label.includes('数据课程')&&label.includes('2026-2027-1')));assert.ok(options.every(label=>!label.includes('[object')));assert.equal(await page.getByLabel('关联乐学课程',{exact:true}).inputValue(),'401');
 report.checks.push('structured LMS year/semester fields render real labels in the course picker and retain the correct official course association');
 await page.goto('https://aita.yanhekt.cn/personal/?yh_view=materials&yh_term=%5Bobject+Object%5D-%5Bobject+Object%5D');await page.getByRole('heading',{name:'资料',exact:true}).waitFor();await page.getByLabel('学期',{exact:true}).locator('option[value="2026-2027-1"]').waitFor({state:'attached'});
 assert.equal(await page.getByLabel('学期',{exact:true}).inputValue(),'');assert.ok((await page.getByLabel('学期',{exact:true}).locator('option').allTextContents()).every(label=>!label.includes('[object')&&!/未标记|未标注|^2023-2024$/.test(label)));report.checks.push('material semester filters reject old object-string query values without hiding courses or producing junk options');
 await page.goto('https://aita.yanhekt.cn/personal/?yh_view=tasks&yh_term=2024-2025%EF%BC%88%E6%9C%AA%E6%A0%87%E8%AE%B0%E5%AD%A6%E6%9C%9F%EF%BC%89');await page.getByRole('heading',{name:'待办',exact:true}).waitFor();await page.getByLabel('学期',{exact:true}).locator('option[value="2026-2027-1"]').waitFor({state:'attached'});assert.equal(await page.getByLabel('学期',{exact:true}).inputValue(),'');assert.ok((await page.getByLabel('学期',{exact:true}).locator('option').allTextContents()).every(label=>!/\[object|未标记|未标注/.test(label)));
 await page.goto('https://aita.yanhekt.cn/personal/?yh_view=courses&yh_scope=favorites');await page.getByLabel('平台',{exact:true}).waitFor();assert.equal(await page.getByLabel('平台',{exact:true}).inputValue(),'all');const allTerms=await page.getByLabel('学期',{exact:true}).locator('option').allTextContents();assert.deepEqual(allTerms,['全部学期','2026-2027-1','2020-2021-2']);
 report.checks.push('course all-platform, material and task menus all exclude unmarked/unspecified and bare-year options while preserving valid old history');
 const metrics=[];
 for(const origin of ['https://aita.yanhekt.cn','https://www.yanhekt.cn']){
  await page.goto(origin+'/personal/?yh_view=courses&yh_scope=all&yh_platform=modern');await page.getByLabel('学期',{exact:true}).waitFor();const tab=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,page.url());await worker.evaluate(id=>chrome.tabs.setZoom(id,1),tab);
  metrics.push(await page.locator('#yanhe-refine').evaluate(host=>{const root=host.shadowRoot,side=root.querySelector('.sidebar'),brand=root.querySelector('.brand'),top=root.querySelector('.topbar');return {sidebar:side.getBoundingClientRect().width,brand:getComputedStyle(brand).fontSize,topbar:top.getBoundingClientRect().height,font:getComputedStyle(host).fontSize};}));
 }
 assert.deepEqual(metrics[0],metrics[1]);report.identicalAt100Percent=metrics;report.checks.push('both official origins render identical sidebar, brand, topbar and base text sizes at the same 100% browser zoom');
 assert.deepEqual(errors,[]);report.ok=true;await page.screenshot({path:join(out,'metadata-clean-filters.png'),fullPage:true});
}catch(error){report.ok=false;report.error=String(error.stack);process.exitCode=1;await page?.screenshot({path:join(out,'metadata-failed.png')}).catch(()=>{});}
finally{await context?.close();if(dirname(scratch)===resolve(tmpdir())&&basename(scratch).startsWith('yanhe-metadata-'))await rm(scratch,{recursive:true,force:true});await writeFile(join(out,'metadata-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
