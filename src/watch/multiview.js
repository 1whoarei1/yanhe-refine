import {Companion} from './companion.js';
import {AudioRouter,chooseAudio,viewPlan,observeAudio} from './audio-routing.js';

export function mountMultiview({video,getApi,getInfo,getView,getHls,isLive,isAttached,isConnecting,getTimely,blockedViews,onStatus,onBlocked}){
 const $=id=>document.getElementById(id),secondary=$('secondary-video'),tertiary=$('tertiary-video'),audio=$('audio-video');
 const router=new AudioRouter([video,secondary,tertiary,audio]),tracks={},failures=new Set();let count=1,unobserve=null,generation=0;
 const save=values=>void chrome.storage.local.set(values).catch(()=>{});
 const streams=()=>Object.fromEntries(Object.entries(getInfo()?.streams||{}).filter(([view])=>!blockedViews.has(view)));
 const name=view=>({screen:'屏幕',classroom:'教室/主画面',student:'学生'}[view]||'当前画面');
 const desired=()=>chooseAudio($('audio-source').value==='auto'?Object.fromEntries(Object.entries(streams()).filter(([view])=>!failures.has(view))):streams(),getView(),$('audio-source').value,tracks);
 function found(view,present){if(tracks[view]===present)return;tracks[view]=present;refresh();}
 function follower(media,independent=false){return new Companion(video,media,{getApi,getInfo,getView,getHls,independent:()=>independent&&isLive()&&getTimely(),onAudio:found,onReady:()=>route(),onAudioBlocked:element=>{router.block(element);onBlocked('浏览器拦截所选来源的声音，请点击音量图标恢复声音。');status();},onError:(text,view)=>{failures.add(view);if(!independent)blockedViews.add(view);refresh();onStatus(name(view)+'：'+text,true);}});}
 const second=follower(secondary),third=follower(tertiary),voice=follower(audio,true),followers=[second,third,voice];
 function carrier(view){
  if(!view)return null;if(isLive()&&getTimely())return voice.active&&voice.view===view?audio:null;
  if(view===getView()&&isAttached())return video;
  return followers.find(controller=>controller.active&&controller.view===view)?.secondary||null;
 }
 function route(){router.apply(carrier(desired()));status();}
 function status(){
  const view=desired(),media=carrier(view);let text;
  if($('audio-source').value==='muted')text='已静音';
  else if(router.volume===0)text='音量为 0';
  else if(!view)text=Object.keys(streams()).length?(failures.size?'声音来源连接失败，可重新连接或手动选择':'可用来源均未检测到音轨'):'等待直播来源';
  else if(media&&router.blocked.has(media))text=name(view)+'声音被浏览器拦截，点击音量图标恢复声音';
  else if(failures.has(view))text=name(view)+'声音连接失败，可重新选择来源';
  else if(tracks[view]===false)text=name(view)+'没有音轨，请切换声音来源';
  else text='声音：'+name(view)+(tracks[view]===true?' · 已检测到音轨':' · 正在检测音轨');
  if($('audio-status').textContent!==text)$('audio-status').textContent=text;
 }
 function ensure(controller,view){if(!view){if(controller.active||controller.loading)controller.stop();return;}if((controller.active||controller.loading)&&controller.view===view)return;void controller.start(view);}
 function refresh(){
  const available=streams(),length=Object.keys(available).length;count=Math.min(count,Math.max(1,length),isLive()?3:2);
  const plan=viewPlan(available,getView(),count,$('secondary-view').value);
  $('dual').disabled=length<2;$('triple').disabled=!isLive()||length<3;$('triple').hidden=!isLive()||length<3;
  $('dual').setAttribute('aria-pressed',String(count===2));$('triple').setAttribute('aria-pressed',String(count===3));
  $('media-grid').classList.toggle('dual',count===2);$('media-grid').classList.toggle('triple',count===3);
  $('secondary-stage').hidden=plan.length<2;$('tertiary-stage').hidden=plan.length<3;$('secondary-view-label').hidden=count<2;$('secondary-view-label').firstChild.textContent=count===3?'右上画面 ':'副画面 ';
  for(const option of $('secondary-view').options)option.disabled=!available[option.value]||option.value===getView();
  if(plan[1])$('secondary-view').value=plan[1];$('secondary-label').textContent=name(plan[1]);$('tertiary-label').textContent=name(plan[2]);
  $('audio-label').hidden=!length;$('volume-label').hidden=!length;
  for(const option of $('audio-source').options)if(['screen','classroom','student'].includes(option.value))option.disabled=!available[option.value];
  if(!isAttached()||isConnecting()){for(const controller of followers)if(controller.active||controller.loading)controller.stop();router.apply(null);status();return;}
  const selected=desired(),hidden=selected&&!failures.has(selected)&&((isLive()&&getTimely())||!plan.includes(selected))?selected:null;
  ensure(second,plan[1]);ensure(third,plan[2]);ensure(voice,hidden);route();
 }
 function volume(value){router.setVolume(value);$('audio-volume').value=String(Math.round(router.volume*100));$('volume-value').textContent=Math.round(router.volume*100)+'%';status();}
 for(const [id,value]of [['dual',2],['triple',3]])$(id).addEventListener('click',()=>{count=count===value?1:value;refresh();});
 $('secondary-view').addEventListener('change',refresh);
 $('audio-source').addEventListener('change',()=>{failures.clear();router.unlock();refresh();for(const controller of followers)controller.sync();save({'player:audioSource':$('audio-source').value});});
 $('audio-volume').addEventListener('input',()=>{volume(Number($('audio-volume').value)/100);save({'player:volume':router.volume});});
 video.addEventListener('volumechange',()=>{if(video.volume!==router.volume)volume(video.volume);router.apply();});
 function enableSound({play=false}={}){
  $('control-volume').removeAttribute('data-audio-blocked');$('control-volume').removeAttribute('data-play-blocked');if($('audio-source').value==='muted')$('audio-source').value='auto';failures.clear();router.unlock();if(!router.volume)volume(1);refresh();
  if(play)void video.play().catch(()=>onBlocked('请点击视频上的播放按钮。'));
  for(const controller of followers)if(controller.active&&(play||!video.paused))void controller.secondary.play().catch(error=>{if(error.name==='NotAllowedError'&&controller.secondary===router.carrier){router.block(controller.secondary);onBlocked('请再次点击音量图标，允许所选来源播放声音。');status();}});
  save({'player:audioSource':$('audio-source').value});void chrome.tabs.getCurrent().then(tab=>tab?.id!=null?chrome.tabs.update(tab.id,{muted:false}):null).catch(()=>{});
 }
 function stop(){generation++;unobserve?.();unobserve=null;for(const controller of followers)controller.stop();router.reset();}
 return {refresh,stop,enableSound,diagnostics(){return {layout:count,preference:$('audio-source').value,resolvedSource:desired(),volume:router.volume,tracks:{...tracks},failures:[...failures],carrier:router.carrier?.id||null,media:[video,secondary,tertiary,audio].map(media=>({id:media.id,view:media===video?getView():followers.find(c=>c.secondary===media)?.view||null,muted:media.muted,paused:media.paused,readyState:media.readyState,decodedAudio:media.webkitAudioDecodedByteCount>0,blocked:router.blocked.has(media),error:media.error?.code||null}))};},clearAudio(){stop();for(const key of Object.keys(tracks))delete tracks[key];failures.clear();},get count(){return count;},reset(){stop();count=1;for(const key of Object.keys(tracks))delete tracks[key];failures.clear();},observePrimary(options={}){unobserve?.();const epoch=generation,view=getView();unobserve=observeAudio(video,{...options,onAudio:present=>{if(epoch===generation)found(view,present);}});},restore(saved){if(['auto','current','classroom','screen','student','muted'].includes(saved['player:audioSource']))$('audio-source').value=saved['player:audioSource'];if(Number.isFinite(saved['player:volume']))volume(saved['player:volume']);}};
}
