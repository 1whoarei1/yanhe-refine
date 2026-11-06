import {parseCourse} from './core.js';
import {YanheApi} from './api.js';
import {LegacyYanheApi} from './legacy-api.js';
import {readImportedCatalog} from './catalog-import.js';
import {sharedCatalog} from './catalog-client.js';
import {sameCourse,liveTimestamp,liveDay,sameLiveTime,matchingLivePeers} from './live-match.js';
import {SessionRecovery} from './session-recovery.js';

export {sameCourse,liveTimestamp} from './live-match.js';

const valid=id=>/^\d{1,12}$/.test(String(id||''));
export function matchingLive(rows,start){
 const active=rows.filter(row=>row.mode==='live'),time=liveTimestamp(start);
 const matches=time?active.filter(row=>Math.abs(liveTimestamp(row.start)-time)<=15*60*1000):active;
 if(matches.length!==1)throw new Error(matches.length?'存在多个同时段直播，请粘贴具体直播链接。':'对应平台当前没有与本课次同时间的直播。');
 return matches[0];
}
export function cleanLinks(value){return Array.isArray(value)?value.filter(row=>row&&typeof row==='object'&&valid(row.modern)&&valid(row.legacy)).slice(-100).map(row=>({modern:String(row.modern),legacy:String(row.legacy)})):[];}

export async function liveCourseCandidates(course,peerPlatform,{readCatalog=readImportedCatalog,signal}={}){
 if(!['legacy','modern'].includes(peerPlatform))throw new Error('平台无效');signal?.throwIfAborted();
 if(readCatalog===readImportedCatalog){
  const identity={title:course.title||course.name,term:course.term,teacher:course.teacher,teachers:course.teachers};
  const result=await sharedCatalog('liveCandidates',[identity,peerPlatform],signal);if(result.shared)return result.value;
 }
 const data=await readCatalog(peerPlatform==='legacy'?'sessions':'modern');signal?.throwIfAborted();
 return (data?.courses||[]).filter(row=>valid(row.id)&&sameCourse(course,row)).slice(0,8).map(row=>({id:String(row.id),legacy:peerPlatform==='legacy',title:row.title||row.name}));
}

export async function accountLiveCandidates(context,api,signal){
 const current={...context.lecture,...context.info,start:context.info?.start||context.lecture?.start};
 const rows=await api.currentLives(liveDay(current.start),signal);signal?.throwIfAborted();
 const candidates=rows.filter(row=>sameCourse(context.course,row)&&sameLiveTime(current,row.info));
 // A student's daily schedule is small. Leave unusually large candidate sets for explicit selection.
 if(candidates.length>8)return candidates.map(row=>({...row,match:'pending'}));
 const checked=await Promise.all(candidates.map(async row=>{
  if(row.legacy)return row;
  try{return {...row,info:await api.lecture(row.id,row.subId,signal)};}
  catch{signal?.throwIfAborted();return {...row,unverified:true,match:'pending'};}
 }));
 signal?.throwIfAborted();
 // Failed detail reads remain visible so they cannot turn an ambiguous set into a false unique match.
 const matches=matchingLivePeers(context,checked.filter(row=>!row.unverified));
 return [...matches,...checked.filter(row=>row.unverified)];
}

async function authenticatePeer(api,signal){
 try{await api.authenticate({signal});}
 catch(error){
  if(error.code!=='SESSION_UNAVAILABLE')throw error;
  // Old-site credentials live in its own localStorage, which requires a site tab to read.
  await new SessionRecovery().run('legacy',()=>api.authenticate({signal}),signal);
 }
}

// Course links persist; the live lesson is resolved afresh on every switch.
// Course IDs and authentication remain independent across the platforms.
export function mountLiveLinks({getContext,onSwitch,onChoose}){
 const $=id=>document.getElementById(id);let key='',epoch=0,controller=null,choices=[],other=null,active=false,busy=false;
 const platform=()=>getContext().course?.legacy?'legacy':'modern';
 const label=value=>value==='legacy'?'旧站':'新站';
 const say=text=>$('live-platform-status').textContent=text;
 function render(){
  const context=getContext(),live=context.info?.mode==='live',button=$('switch-live-platform');
  const current=(active?(platform()==='modern'?'legacy':'modern'):platform())==='legacy'?'旧延河':'新延河';
  $('live-platform-tools').hidden=!context.live;$('duration').hidden=live;button.hidden=!live;button.disabled=busy;
  button.textContent='直播来源 · '+current+(busy?'（切换中…）':'');button.setAttribute('aria-busy',String(busy));
  button.title=active?'切回'+label(platform())+'直播':other?'切换到'+label(platform()==='modern'?'legacy':'modern')+'直播':'选择另一平台的直播来源';
  $('active-live-platform').textContent=current;
 }
 function reset(){epoch++;controller?.abort();controller=null;key='';choices=[];other=null;active=false;busy=false;render();}
 async function storePair(peer,context){const current=String(context.course.id),base=context.course.legacy?'legacy':'modern',row={modern:base==='modern'?current:String(peer),legacy:base==='legacy'?current:String(peer)};const saved=await chrome.storage.local.get('player:liveCourseLinks'),links=cleanLinks(saved['player:liveCourseLinks']).filter(item=>item.modern!==row.modern||item.legacy!==row.legacy);links.push(row);await chrome.storage.local.set({'player:liveCourseLinks':links.slice(-100)});}
 async function resolvePeer(ref,signal){
  const context=getContext(),legacy=Boolean(ref.legacy),api=legacy?new LegacyYanheApi():new YanheApi();
  try{
   await authenticatePeer(api,signal);if(legacy)ref=await api.resolve(ref,signal);
   const course=legacy?(ref.liveId?await api.liveCourse(ref,signal):await api.describeCourse(ref.id,signal)):await api.course(ref.id,signal);
   if(!sameCourse(context.course,course))throw new Error('课程名称、教师或学期不一致，请核对关联链接。');
   const explicit=legacy&&ref.liveId?'live:'+ref.liveId:!legacy&&ref.subId?ref.subId:null;
   const rows=explicit?[]:legacy?await api.liveList(course.id,signal):course.lives||[];
   const lesson=explicit?{id:explicit}:matchingLive(rows,context.info?.start||context.lecture?.start);
   const info=await api.lecture(course.id,lesson.id,signal);if(info.mode!=='live')throw new Error('对应课次当前不在直播。');
   if(ref.match&&!matchingLivePeers(context,[{...course,info}]).length)throw new Error('对应直播已变化，请刷新页面重新检测。');
   signal.throwIfAborted();await storePair(course.id,context);signal.throwIfAborted();
   other={...ref,id:String(course.id),legacy,title:course.title};
   return {api,info,target:{legacy,courseId:String(course.id),lessonId:String(lesson.id)}};
  }catch(error){api.reset();throw error;}
 }
 async function switchSource(ref){
  if(busy)return;const serial=epoch,context=getContext();busy=true;render();say('正在核对对应课次与直播状态…');
  try{
   if(active&&!ref){const info=await context.api.lecture(context.course.id,context.lecture.id,controller.signal);if(info.mode!=='live')throw new Error('原平台此课次当前不在直播。');if(serial!==epoch)return;await onSwitch({api:null,target:null,info});active=false;}
   else{const result=await resolvePeer(ref||other,controller.signal);if(serial!==epoch){result.api.reset();return;}await onSwitch(result);active=true;}
   say('已切换直播来源。');
  }catch(error){if(serial===epoch&&error.name!=='AbortError')say(error.message);}
  finally{if(serial===epoch){busy=false;render();}}
 }
 $('switch-live-platform').addEventListener('click',()=>{if(busy)return;if(active||other)void switchSource();else onChoose();});
 $('live-course-candidate').addEventListener('change',()=>{const value=$('live-course-candidate').value;other=value===''?null:choices[Number(value)]||null;render();});
 $('link-live-form').addEventListener('submit',event=>{event.preventDefault();try{const ref=parseCourse($('alternate-live-url').value);if(Boolean(ref.legacy)===Boolean(getContext().course.legacy))throw new Error('请填写另一个平台的课程或直播链接。');void switchSource(ref);}catch(error){say(error.message);}});
 async function refresh(){
  const context=getContext();render();if(!context.live||!context.course||!context.lecture)return;
  const next=platform()+':'+context.course.id+':'+context.lecture.id;if(next===key)return;
  reset();key=next;const serial=epoch;controller=new AbortController();const peerPlatform=platform()==='modern'?'legacy':'modern';
  say('正在查找同课的另一平台入口…');
  try{
   const signal=controller.signal,peerApi=peerPlatform==='legacy'?new LegacyYanheApi():new YanheApi();let found=[];
   try{await authenticatePeer(peerApi,signal);found=await accountLiveCandidates(context,peerApi,signal);}catch{signal.throwIfAborted();}finally{peerApi.reset();}
   if(!found.length){
    const saved=await chrome.storage.local.get('player:liveCourseLinks'),pairs=cleanLinks(saved['player:liveCourseLinks']);signal.throwIfAborted();
    found=pairs.filter(row=>row[platform()]===String(context.course.id)).map(row=>({id:row[peerPlatform],legacy:peerPlatform==='legacy',title:context.course.title}));
   }
   if(!found.length){
    try{const catalogRows=await liveCourseCandidates(context.course,peerPlatform,{signal});signal.throwIfAborted();found=catalogRows;}catch{signal.throwIfAborted();}
   }
   if(!found.length){const tabs=await chrome.tabs.query({url:peerPlatform==='legacy'?'https://www.yanhekt.cn/*':'https://aita.yanhekt.cn/*'});for(const tab of tabs.slice(0,8)){try{const ref=parseCourse(tab.url),identity=String(ref.id||ref.liveId||ref.sessionId||'');if(identity&&Boolean(ref.legacy)===(peerPlatform==='legacy')&&!found.some(row=>String(row.id||row.liveId||row.sessionId)===identity))found.push({...ref,id:ref.id?String(ref.id):undefined,legacy:Boolean(ref.legacy),title:'已打开的'+label(peerPlatform)+'入口 '+identity});}catch{}}}
   signal.throwIfAborted();if(serial!==epoch)return;choices=found;
   const select=$('live-course-candidate');select.replaceChildren();if(choices.length>1){const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='多个课程候选，请选择或粘贴具体链接';placeholder.disabled=true;placeholder.selected=true;select.append(placeholder);}for(const [index,row]of choices.entries()){const option=document.createElement('option');option.value=String(index);option.textContent=[row.title,row.id||row.sessionId,row.liveId?'直播 '+row.liveId:row.subId?'课次 '+row.subId:''].filter(Boolean).join(' · ');select.append(option);}select.hidden=choices.length<2;
   other=choices.length===1?choices[0]:null;say(choices.length>1?'找到多个候选，请选择对应直播。':other?.match==='stream'?'已自动匹配同一视频源，可直接切换。':other?.match==='schedule'?'已按课程、教师和上课时间匹配，可直接切换。':other?'发现另一平台课程候选；点击切换时核对当前课次。':'可粘贴另一站的课程或直播链接。');render();
  }catch(error){if(serial===epoch&&error.name!=='AbortError')say('可手动粘贴另一平台的课程或直播链接。');}
 }
 return {refresh,reset};
}
