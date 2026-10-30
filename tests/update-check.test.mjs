import test from 'node:test';
import assert from 'node:assert/strict';
import {compareVersions,releaseUpdate,checkForUpdate,RELEASE_API,RELEASE_REPO} from '../src/update-check.js';
const release=(tag='v0.10.6')=>({tag_name:tag,draft:false,prerelease:false,assets:[]});
const asset=(name,updated_at='2026-10-30T10:00:00Z')=>({name,state:'uploaded',updated_at,browser_download_url:RELEASE_REPO+'/releases/download/v0.10.6/'+name});
test('release comparisons use numeric components and recognize local versions ahead of the published release',()=>{
 assert.equal(compareVersions('0.10.0','0.9.14'),1);assert.equal(compareVersions('0.10.5','0.10.5.0'),0);assert.equal(compareVersions('0.10.9','0.10.10'),-1);
 assert.equal(releaseUpdate(release(),'0.10.5').available,true);assert.equal(releaseUpdate(release(),'0.10.6').available,false);assert.equal(releaseUpdate(release(),'0.11.0').ahead,true);
 for(const tag of ['v0.11.0-beta','latest','0.10.evil'])assert.throws(()=>releaseUpdate(release(tag),'0.10.5'));
 assert.throws(()=>releaseUpdate({...release(),prerelease:true},'0.10.5'));assert.throws(()=>releaseUpdate({...release(),draft:true},'0.10.5'));
});
test('download choices stay inside the correct repository, release and version; dated packages are supported',()=>{
 const data={...release(),html_url:'https://evil.invalid/',assets:[asset('yanhe-refine-0.10.60.zip'),asset('yanhe-refine-0.10.6.zip','2026-10-29T00:00:00Z'),asset('yanhe-refine-0.10.6-20261030.zip'),asset('yanhe-refine-0.10.6-personal.zip'),{...asset('yanhe-refine-0.10.6-20261031.zip'),browser_download_url:'https://evil.invalid/package.zip'}]};
 const result=releaseUpdate(data,'0.10.5');assert.equal(result.releaseUrl,RELEASE_REPO+'/releases/tag/v0.10.6');assert.equal(result.downloadUrl,RELEASE_REPO+'/releases/download/v0.10.6/yanhe-refine-0.10.6-20261030.zip');
 assert.equal(releaseUpdate(release(),'0.10.5').downloadUrl,null);
});
test('update checks fetch only public release metadata with no credentials or classroom information',async()=>{
 const result=await checkForUpdate('0.10.5',{fetcher:async(url,options)=>{assert.equal(url,RELEASE_API);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.headers.Authorization,undefined);assert.equal(options.body,undefined);return Response.json(release());}});assert.equal(result.available,true);
});
test('network, rate-limit and invalid responses remain retryable failures rather than claiming no update',async()=>{
 for(const [response,message]of [[new Response('',{status:403}),/受限/],[new Response('',{status:429}),/受限/],[new Response('',{status:404}),/正式发布/],[new Response('<html>'),/无法识别/]])await assert.rejects(checkForUpdate('0.10.5',{fetcher:async()=>response}),message);
 await assert.rejects(checkForUpdate('0.10.5',{fetcher:async()=>{throw new TypeError('offline');}}),/连接失败/);
 assert.equal((await checkForUpdate('0.10.5',{fetcher:async()=>Response.json(release())})).available,true);
});
