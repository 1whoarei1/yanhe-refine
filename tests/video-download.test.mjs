import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {ReplayDownloader,parsePlaylist,replayViews,downloadRequest,sequenceIv,fileStem} from '../src/watch/media-download.js';
const origin='https://cvideo.yanhekt.cn/play/';
const source=origin+'index.m3u8';
const api={sign:url=>url,authenticate:async()=>{},prepareMedia:async()=>{}};
const bytes=(...values)=>new Uint8Array(values);
function sink(){return {chunks:[],closed:false,aborted:false,async write(data){this.chunks.push(new Uint8Array(data));},async close(){this.closed=true;},async abort(){this.aborted=true;},result(){return Buffer.concat(this.chunks);}};}
const playlist=(...lines)=>['#EXTM3U',...lines,'#EXT-X-ENDLIST'].join('\n');

test('download context retains the old/new identity and exposes only replay channels',()=>{
 assert.equal(downloadRequest(new URLSearchParams('course=1&lecture=2:3&platform=legacy&view=all')).view,'all');
 assert.throws(()=>downloadRequest(new URLSearchParams('course=1&lecture=live:2&platform=legacy')));
 assert.throws(()=>downloadRequest(new URLSearchParams('course=../../&lecture=2')));
 assert.deepEqual(replayViews({mode:'live',streams:{screen:source}}),[]);
 assert.deepEqual(replayViews({streams:{screen:source,classroom:source,other:source}}),['screen','classroom']);
 assert.equal(fileStem('../CON:video.'),'.._CON_video');assert.equal(fileStem('CON'),'_CON');
});
test('HLS resolves relative paths, selects highest-quality variants and keeps separate audio explicit',()=>{
 const plan=parsePlaylist('#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="audio.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=100\nlow.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=200,AUDIO="audio"\nhigh.m3u8',source);
 assert.equal(plan.variants[0].url,origin+'high.m3u8');assert.equal(plan.audio[0].URI,'audio.m3u8');
 assert.throws(()=>parsePlaylist(playlist('#EXTINF:1,','https://evil.test/x.ts'),source),/域名/);
});
test('HLS validates complete VODs, implicit byte ranges and large media-sequence IVs',()=>{
 const plan=parsePlaylist(playlist('#EXT-X-MEDIA-SEQUENCE:9007199254740993','#EXT-X-KEY:METHOD=AES-128,URI="key"','#EXTINF:2,','#EXT-X-BYTERANGE:3@1','segments.ts','#EXTINF:2,','#EXT-X-BYTERANGE:2','segments.ts'),source);
 assert.deepEqual(plan.segments.map(s=>s.range),[{start:1,end:3},{start:4,end:5}]);assert.equal(plan.duration,4);
 assert.deepEqual(plan.segments[0].key.iv,sequenceIv(9007199254740993n));assert.deepEqual(plan.segments[1].key.iv,sequenceIv(9007199254740994n));
 for(const text of ['#EXTM3U\n#EXTINF:1,\na.ts',playlist('#EXT-X-GAP','a.ts'),playlist('#EXT-X-BYTERANGE:2','a.ts'),playlist('#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key"','a.ts'),playlist('#EXT-X-MAP:URI="a.mp4"','a.m4s','#EXT-X-MAP:URI="b.mp4"','b.m4s')])assert.throws(()=>parsePlaylist(text,source));
});
test('streamed MP4 output is complete, signed afresh and closed only after all bytes are written',async()=>{
 const calls=[],writer=sink(),downloader=new ReplayDownloader({...api,sign:url=>url+'?signed=fixture'},{fetcher:async url=>{calls.push(url);return new Response(bytes(1,2,3,4),{headers:{'content-length':'4'}});}});
 const plan=await downloader.plan(origin+'video.mp4');await downloader.save(plan,writer);
 assert.deepEqual(writer.result(),Buffer.from([1,2,3,4]));assert.equal(writer.closed,true);assert.equal(writer.aborted,false);assert.match(calls[0],/signed=fixture/);
});
test('VOD downloads combine initialization and all ordered fragments into a playable-container file',async()=>{
 const map=new Map([[source,playlist('#EXT-X-MAP:URI="init.mp4"','#EXTINF:1,','0.m4s','#EXTINF:1,','1.m4s')],[origin+'init.mp4',bytes(0,1)],[origin+'0.m4s',bytes(2,3)],[origin+'1.m4s',bytes(4,5)]]);
 const engine=new ReplayDownloader(api,{fetcher:async url=>new Response(map.get(url))}),plan=await engine.plan(source),writer=sink(),progress=[];
 assert.equal(plan.extension,'mp4');await engine.save(plan,writer,{onProgress:p=>progress.push(p)});
 assert.deepEqual(writer.result(),Buffer.from([0,1,2,3,4,5]));assert.equal(progress.at(-1).completed,2);assert.equal(writer.closed,true);
});
test('standard AES-128 segments decrypt with the sequence IV without storing keys in output',async()=>{
 const raw=bytes(...Array.from({length:16},(_,i)=>i)),plain=Buffer.from('synthetic video bytes'),key=await webcrypto.subtle.importKey('raw',raw,'AES-CBC',false,['encrypt']);
 const encrypted=await webcrypto.subtle.encrypt({name:'AES-CBC',iv:sequenceIv(7)},key,plain);
 const engine=new ReplayDownloader(api,{crypto:webcrypto,fetcher:async url=>new Response(url.endsWith('/key')?raw:new Uint8Array(encrypted))});
 const plan=parsePlaylist(playlist('#EXT-X-MEDIA-SEQUENCE:7','#EXT-X-KEY:METHOD=AES-128,URI="key"','#EXTINF:1,','0.ts'),source),writer=sink();
 await engine.save(plan,writer);assert.deepEqual(writer.result(),plain);assert.equal(writer.closed,true);
});
test('a missing segment aborts the file instead of reporting a partial recording complete',async()=>{
 const engine=new ReplayDownloader(api,{fetcher:async url=>url.endsWith('missing.ts')?new Response('',{status:404}):new Response(bytes(1,2))}),writer=sink();
 const plan=parsePlaylist(playlist('#EXTINF:1,','0.ts','#EXTINF:1,','missing.ts'),source);
 await assert.rejects(engine.save(plan,writer),/404/);assert.equal(writer.aborted,true);assert.equal(writer.closed,false);
});
test('truncated byte-range responses and ignored ranges cannot corrupt merged output',async()=>{
 const plan=parsePlaylist(playlist('#EXT-X-BYTERANGE:4@0','all.ts'),source);
 const engine=new ReplayDownloader(api,{fetcher:async()=>new Response(bytes(1,2),{status:206,headers:{'content-range':'bytes 0-3/4'}})}),writer=sink();
 await assert.rejects(engine.save(plan,writer),/不完整/);assert.equal(writer.closed,false);
 const ignored=new ReplayDownloader(api,{fetcher:async()=>new Response(bytes(1,2,3,4))});await assert.rejects(ignored.save(plan,sink()),/分段范围/);
});
test('cancel interrupts streaming writes and never closes a partial file as completed',async()=>{
 const controller=new AbortController(),writer=sink();writer.write=async function(data){this.chunks.push(data);controller.abort();};
 const engine=new ReplayDownloader(api,{fetcher:async()=>new Response(bytes(1,2,3))});await assert.rejects(engine.save({url:origin+'test.mp4'},writer,{signal:controller.signal}));
 assert.equal(writer.aborted,true);assert.equal(writer.closed,false);
});
test('expired authentication gets one normal refresh; a repeated denial still fails',async()=>{
 let refreshed=0,requests=0;const engine=new ReplayDownloader({...api,authenticate:async options=>{assert.equal(options.force,true);refreshed++;}},{fetcher:async()=>{requests++;return new Response('',{status:403});}});
 await assert.rejects(engine.save({url:origin+'test.mp4'},sink()),/403/);assert.equal(refreshed,1);assert.equal(requests,2);
});
