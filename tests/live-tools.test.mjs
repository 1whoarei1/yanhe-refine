import test from 'node:test';
import assert from 'node:assert/strict';
import {latestBufferedFrame,audioView} from '../src/watch/live-tools.js';
const media=(buffered,seekable=[])=>({buffered:{length:buffered.length,start:i=>buffered[i][0],end:i=>buffered[i][1]},seekable:{length:seekable.length,start:i=>seekable[i][0],end:i=>seekable[i][1]}});
test('latest frame comes from downloaded data even when the live window is ahead',()=>{
 assert.deepEqual(latestBufferedFrame(media([[20,28]],[[10,40]])),{time:27.96,start:20,end:28});
 assert.equal(latestBufferedFrame(media([],[[10,40]])),null);
});
test('discontinuous buffers, short fragments and disappearing media are safe',()=>{
 assert.deepEqual(latestBufferedFrame(media([[0,2],[8,9]])),{time:8.96,start:8,end:9});
 assert.deepEqual(latestBufferedFrame(media([[8,8.0001]])),{time:8,start:8,end:8.0001});
 assert.equal(latestBufferedFrame(media([[0,Infinity],[NaN,12],[8,8]])),null);
 assert.equal(latestBufferedFrame({get buffered(){throw new Error('detached');}}),null);
});
test('automatic sound uses the classroom even when the visible stream is the screen',()=>{
 const streams={screen:'screen',classroom:'room',student:'students'};
 assert.equal(audioView(streams,'screen'),'classroom');
 assert.equal(audioView(streams,'screen','current'),'screen');
 assert.equal(audioView(streams,'classroom','screen'),'screen');
 assert.equal(audioView(streams,'screen','muted'),null);
 assert.equal(audioView({screen:'screen'},'screen','classroom'),'screen');
 assert.equal(audioView({student:'students'},'student'),'student');
 assert.equal(audioView({},'screen'),null);
});
