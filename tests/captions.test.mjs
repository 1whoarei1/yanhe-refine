import test from 'node:test';
import assert from 'node:assert/strict';
import {captionPlacement} from '../src/watch/captions.js';
test('captions follow the actual contained image and only lift for an overlapping visible dock',()=>{
 const box={left:0,top:0,width:960,height:900},dock={left:0,right:1920,top:800,bottom:900};
 const letterboxed=captionPlacement(box,1920,1080,dock,true);assert.equal(letterboxed.frame.height,540);assert.ok(letterboxed.bottom<letterboxed.frame.bottom&&letterboxed.bottom>dock.top-200);assert.ok(letterboxed.frame.top>0);
 assert.equal(letterboxed.bottom,captionPlacement(box,1920,1080,dock,false).bottom);
 const fitted={left:0,top:0,width:960,height:540},overlap={left:0,right:960,top:444,bottom:540};const shown=captionPlacement(fitted,1920,1080,overlap,true),hidden=captionPlacement(fitted,1920,1080,overlap,false);
 assert.ok(shown.bottom<overlap.top);assert.ok(hidden.bottom>shown.bottom+40&&hidden.bottom<fitted.height);assert.equal(shown.left,hidden.left);
 const portrait=captionPlacement(fitted,1080,1920,overlap,false);assert.ok(portrait.frame.left>0&&portrait.frame.width<fitted.width);assert.equal(captionPlacement(fitted,0,0,overlap,true),null);
});
