import test from 'node:test';
import assert from 'node:assert/strict';
import {PlatformConnections,SessionRecovery,PLATFORM_ENTRIES} from '../src/platform-connections.js';
import {connectionStatus} from '../src/connection-status.js';
import {readAuthTabs} from '../src/watch/tab-auth.js';
import {LmsReader} from '../src/lms-reader.js';
const auth=()=>Object.assign(new Error('请登录平台'),{code:'AUTH_REQUIRED'});
const event=()=>{const listeners=new Set();return {addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn),emit:(...args)=>{for(const fn of listeners)fn(...args);},get size(){return listeners.size;}};};

test('a frozen authentication tab has a deadline and cannot prevent another valid tab',async()=>{
 const rows=await readAuthTabs({query:async()=>[{id:1},{id:2}],sendMessage:id=>id===1?new Promise(()=>{}):Promise.resolve({token:'valid'})},'https://www.yanhekt.cn',{type:'READ_LEGACY_AUTH'},{timeout:5});assert.deepEqual(rows,[{token:'valid'}]);
});

test('lightweight connection checks are independent and a frozen platform cannot leave a permanent spinner',async()=>{
 const checked=new PlatformConnections({timeout:10,probe:async source=>source==='legacy'?new Promise(()=>{}):true,recovery:{run:()=>{throw Error('network timeouts must not open login tabs');}}});
 const result=await Promise.all(Object.keys(PLATFORM_ENTRIES).map(source=>checked.check(source,{force:true})));
 assert.deepEqual(result.map(r=>r.state),['connected','error','connected','connected']);assert.match(result[1].error.message,/超时/);assert.equal(checked.flights.size,0);
});

test('an existing SSO session can renew quietly before a login error is shown, with duplicate checks coalesced',async()=>{
 let valid=false,opened=0,probes=0;const checked=new PlatformConnections({probe:async()=>{probes++;if(!valid)throw auth();},recovery:{run:async(_source,probe)=>{opened++;valid=true;return probe();}}});
 const a=checked.check('lms',{force:true}),b=checked.check('lms',{force:true});assert.equal(a,b);assert.equal((await a).connected,true);assert.equal(opened,1);assert.equal(probes,2);
 await checked.check('lms');assert.equal(probes,2);
});

test('network or permission failures do not become logged-out states or trigger SSO renewals',async()=>{
 let recoveries=0;for(const message of ['新乐学返回 HTTP 403','Failed to fetch']){const checked=new PlatformConnections({probe:async()=>{throw Error(message);},recovery:{run:async()=>recoveries++}});assert.equal((await checked.check('lms',{force:true})).state,'error');}assert.equal(recoveries,0);
 const unavailable=new PlatformConnections({probe:async()=>{throw Object.assign(Error('暂未获取登录状态'),{code:'SESSION_UNAVAILABLE'});},recovery:{run:async()=>{throw Object.assign(Error('请打开原站验证'),{code:'SESSION_UNAVAILABLE'});}}});
 const result=await unavailable.check('legacy');assert.equal(result.state,'verification');assert.equal(connectionStatus(result).label,'需验证');
});

test('a background validation page stays inactive, preserves site mode and is always closed',async()=>{
 const updated=event(),removed=event(),closed=[],created=[];const tabs={onUpdated:updated,onRemoved:removed,create:async options=>{created.push(options);return {id:41};},get:async()=>({id:41,status:'complete',url:PLATFORM_ENTRIES.legacy}),remove:async id=>closed.push(id)};
 const recovery=new SessionRecovery({tabs,timeout:20});assert.equal(await recovery.run('legacy',async()=>true),true);assert.equal(created[0].active,false);assert.equal(new URL(created[0].url).searchParams.get('yh_native'),'1');assert.equal(new URL(created[0].url).searchParams.has('yh_mode'),false);assert.deepEqual(closed,[41]);assert.equal(updated.size,0);assert.equal(removed.size,0);
 await assert.rejects(recovery.run('legacy',async()=>{throw auth();}),/登录/);assert.deepEqual(closed,[41,41]);
});

test('background SSO timeout closes only its own page and removes all event listeners',async()=>{
 const updated=event(),removed=event(),closed=[];const recovery=new SessionRecovery({timeout:5,tabs:{onUpdated:updated,onRemoved:removed,create:async()=>({id:42}),get:async()=>({id:42,status:'loading',url:'https://sso.bit.edu.cn/pending'}),remove:async id=>closed.push(id)}});
 await assert.rejects(recovery.run('lms',async()=>true),/超时/);assert.deepEqual(closed,[42]);assert.equal(updated.size,0);assert.equal(removed.size,0);
});

test('an opaque LMS login redirect is distinguishable from a network error without following it',async()=>{
 const reader=new LmsReader(async(_url,options)=>{assert.equal(options.redirect,'manual');const r=new Response(null);Object.defineProperty(r,'type',{value:'opaqueredirect'});return r;});
 await assert.rejects(reader.read({kind:'connection'}),error=>error.code==='AUTH_REQUIRED');
 const connected=new LmsReader(async url=>{assert.equal(new URL(url).pathname,'/api/my-courses');return new Response(JSON.stringify({courses:[{id:1,academic_year:{id:81},semester:{id:902}}]}),{headers:{'content-type':'application/json'}});});assert.deepEqual(await connected.read({kind:'connection'}),{connected:true});
});
