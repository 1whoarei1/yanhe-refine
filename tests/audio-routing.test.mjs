import test from 'node:test';
import assert from 'node:assert/strict';
import {viewPlan,chooseAudio,AudioRouter} from '../src/watch/audio-routing.js';
import {Companion} from '../src/watch/companion.js';
const streams={screen:'screen',classroom:'room',student:'students'};
test('three sources remain distinct and dual view can choose the student camera',()=>{
 assert.deepEqual(viewPlan(streams,'screen',2,'student'),['screen','student']);
 assert.deepEqual(viewPlan(streams,'student',3,'student'),['student','screen','classroom']);
 assert.deepEqual(viewPlan({classroom:'room'},'screen',3),['classroom']);
});
test('a newly selected decoder refreshes its own media credentials before the HEAD probe',async()=>{
 class Media extends EventTarget{constructor(){super();this.muted=true;this.volume=1;this.paused=true;this.playbackRate=1;this.readyState=0;this.currentTime=0;}pause(){this.paused=true;}load(){}removeAttribute(){} }
 let prepared=false;const url='https://cvideo.yanhekt.cn/test.mp4',api={async prepareMedia(_signal,source){assert.equal(source,url);prepared=true;},async probeMedia(){assert.equal(prepared,true);return {ok:true};},sign:value=>value};
 const source=new Companion(new Media(),new Media(),{getApi:()=>api,getInfo:()=>({streams:{classroom:url}}),getView:()=> 'screen',getHls:()=>null,onError:text=>assert.fail(text)});
 await source.start('classroom');assert.equal(source.active,true);source.stop();
});
test('automatic audio follows confirmed tracks instead of assuming the main camera has sound',()=>{
 assert.equal(chooseAudio(streams,'classroom','auto',{classroom:false,student:true,screen:false}),'student');
 assert.equal(chooseAudio(streams,'classroom','auto',{classroom:false,screen:false}),'student');
 assert.equal(chooseAudio(streams,'classroom','auto',{classroom:false,student:false,screen:false}),null);
 assert.equal(chooseAudio(streams,'classroom','classroom',{classroom:false,student:true}),'classroom');
 assert.equal(chooseAudio(streams,'classroom','student'),'student');
});
test('source changes never briefly mix two decoders and preserve the global volume',()=>{
 const media=Array.from({length:4},()=>{let muted=true;return {volume:1,get muted(){return muted;},set muted(value){muted=value;assert.ok(media.filter(m=>!m.muted).length<=1);}};});
 const router=new AudioRouter(media);router.setVolume(.35);
 for(const source of [media[2],media[0],media[3],media[1]]){router.apply(source);assert.deepEqual(media.map(m=>!m.muted),media.map(m=>m===source));assert.ok(media.every(m=>m.volume===.35));}
 router.block(media[1]);assert.ok(media.every(m=>m.muted));router.unlock();assert.equal(media[1].muted,false);router.reset();assert.ok(media.every(m=>m.muted));
});
