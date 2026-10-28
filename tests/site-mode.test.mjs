import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {SITE_MODE_KEY,modeIntent,siteMode,readSiteMode} from '../src/site-mode.js';
import {nativeHref,refineEntryHref,siteRoute,isPlatformPage} from '../src/site-routes.js';

function preference(){const data={},writes=[];return {data,writes,storage:{get:async key=>({[key]:data[key]}),set:async values=>{Object.assign(data,values);writes.push(values);}}};}
test('choosing native persists through unrelated entry links on both classroom sites until choosing refine',async()=>{
 const {storage,data}=preference();
 assert.equal(await readSiteMode('https://aita.yanhekt.cn/portal/#/',storage),'refine');
 assert.equal(await readSiteMode(nativeHref('https://aita.yanhekt.cn/coursedetail?course_id=102178',{remember:true}),storage),'native');
 for(const url of ['https://aita.yanhekt.cn/portal/#/','https://aita.yanhekt.cn/searchContent?title=视觉','https://www.yanhekt.cn/session/71990','https://www.yanhekt.cn/home'])assert.equal(await readSiteMode(url,storage),'native');
 assert.equal(data[SITE_MODE_KEY],'native');
 assert.equal(await readSiteMode(refineEntryHref('https://www.yanhekt.cn/session/71990?yh_native=1'),storage),'refine');
 assert.equal(data[SITE_MODE_KEY],'refine');assert.equal(await readSiteMode('https://aita.yanhekt.cn/portal/#/',storage),'refine');
});
test('one-page native login links and unrelated sites cannot change the saved mode',async()=>{
 const {storage,data,writes}=preference();data[SITE_MODE_KEY]='refine';
 assert.equal(await readSiteMode(nativeHref('https://aita.yanhekt.cn/portal/#/'),storage),'native');
 assert.equal(data[SITE_MODE_KEY],'refine');assert.equal(writes.length,0);
 for(const url of ['https://evil.example/?yh_mode=native','https://aita.yanhekt.cn.evil.example/?yh_mode=native','https://user:pass@www.yanhekt.cn/home?yh_mode=native','https://lexue.bit.edu.cn/my/?yh_mode=native'])assert.equal(modeIntent(url),null);
 assert.equal(siteMode('https://aita.yanhekt.cn/portal/#/','invalid'),'refine');
});
test('explicit return links keep course/session context and unsupported old pages return to the old-site entry',()=>{
 const native=nativeHref('https://www.yanhekt.cn/session/71990?yh_tab=materials',{remember:true});
 assert.equal(new URL(native).pathname,'/session/71990');assert.equal(modeIntent(native),'native');assert.equal(siteRoute(native),null);
 const refined=refineEntryHref(native);assert.equal(new URL(refined).pathname,'/session/71990');assert.equal(modeIntent(refined),'refine');assert.equal(new URL(refined).searchParams.get('yh_tab'),'materials');
 assert.equal(new URL(refineEntryHref('https://www.yanhekt.cn/liveCourse')).pathname,'/home');
 assert.equal(new URL(refineEntryHref('https://aita.yanhekt.cn/login?token=secret')).searchParams.has('token'),false);
});
test('toolbar checks the actual rendered view when a native entry URL has no one-page opt-out marker',async()=>{
 let action,view='native';const updates=[],choices=[];
 const chrome={runtime:{id:'fixture',onInstalled:{addListener(){}},onStartup:{addListener(){}},onMessage:{addListener(){}}},action:{onClicked:{addListener:fn=>action=fn}},tabs:{sendMessage:async()=>({mode:view}),update:async(id,args)=>updates.push({id,...args}),create:async args=>updates.push(args)}};
 const source=readFileSync(new URL('../src/background.js',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'');
 runInNewContext(source,{chrome,URL,nativeHref,refineEntryHref,isPlatformPage,readSiteMode:async raw=>{choices.push(modeIntent(raw));return 'native';}});
 await action({id:5,url:'https://aita.yanhekt.cn/coursedetail?course_id=102178'});
 assert.equal(modeIntent(updates[0].url),'refine');
 view='refine';await action({id:5,url:'https://www.yanhekt.cn/session/71990'});
 assert.equal(modeIntent(updates[1].url),'native');assert.deepEqual(choices,['refine','native']);
});
