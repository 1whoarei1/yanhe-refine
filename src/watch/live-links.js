import {parseCourse} from './core.js';
import {YanheApi} from './api.js';
import {LegacyYanheApi} from './legacy-api.js';

const valid=id=>/^\d{1,12}$/.test(String(id||''));
const normal=text=>String(text||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
const term=value=>normal(value).replace(/[–—/]/g,'-').replace(/学年/g,'').replace(/第一学期/g,'-1').replace(/第二学期/g,'-2').replace(/第三学期/g,'-3').replace(/-+/g,'-');
const teachers=row=>(Array.isArray(row.teachers)?row.teachers:[row.teacher||'']).flatMap(value=>String(value).split(/[、,，;；/]+/)).map(normal).filter(Boolean);
export function sameCourse(a,b){
 if(!normal(a.title||a.name)||normal(a.title||a.name)!==normal(b.title||b.name))return false;
 if(a.term&&b.term&&term(a.term)!==term(b.term))return false;
 const x=teachers(a),y=teachers(b);return !x.length||!y.length||x.some(name=>y.includes(name));
}
export function liveTimestamp(value){
 if(!value)return 0;if(Number.isFinite(Number(value))){const number=Number(value);return number<1e12?number*1000:number;}
 const text=String(value).replace(' ','T');return Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(text)?text:text+'+08:00')||0;
}
export function matchingLive(rows,start){
 const active=rows.filter(row=>row.mode==='live'),time=liveTimestamp(start);
 const matches=time?active.filter(row=>Math.abs(liveTimestamp(row.start)-time)<=15*60*1000):active;
 if(matches.length!==1)throw new Error(matches.length?'存在多个同时段直播，请粘贴具体直播链接。':'对应平台当前没有与本课次同时间的直播。');
 return matches[0];
}
export function cleanLinks(value){return Array.isArray(value)?value.filter(row=>row&&typeof row==='object'&&valid(row.modern)&&valid(row.legacy)).slice(-100).map(row=>({modern:String(row.modern),legacy:String(row.legacy)})):[];}

// Course links persist; the live lesson is resolved afresh on every switch.
// No relationship between numeric IDs, stream URLs or login tokens is assumed.
export function mountLiveLinks({getContext,onSwitch}){
 const $=id=>document.getElementById(id);let key='',epoch=0,controller=null,choices=[],other=null,active=false,busy=false;
 const platform=()=>getContext().course?.legacy?'legacy':'modern';
 const label=value=>value==='legacy'?'旧站':'新站';
 const say=text=>$('live-platform-status').textContent=text;
 function render(){const context=getContext();$('live-platform-tools').hidden=!context.live;$('switch-live-platform').disabled=busy||(!active&&!other);$('switch-live-platform').textContent=active?'切回'+label(platform())+'直播':'切换到'+label(platform()==='modern'?'legacy':'modern')+'直播';$('active-live-platform').textContent='当前直播来源：'+label(active?(platform()==='modern'?'legacy':'modern'):platform());}
 function reset(){epoch++;controller?.abort();controller=null;key='';choices=[];other=null;active=false;busy=false;render();}
 async function storePair(peer,context){const current=String(context.course.id),base=context.course.legacy?'legacy':'modern',row={modern:base==='modern'?current:String(peer),legacy:base==='legacy'?current:String(peer)};const saved=await chrome.storage.local.get('player:liveCourseLinks'),links=cleanLinks(saved['player:liveCourseLinks']).filter(item=>item.modern!==row.modern||item.legacy!==row.legacy);links.push(row);await chrome.storage.local.set({'player:liveCourseLinks':links.slice(-100)});}
 async function resolvePeer(ref,signal){
  const context=getContext(),legacy=Boolean(ref.legacy),api=legacy?new LegacyYanheApi():new YanheApi();
  await api.authenticate({signal});if(legacy)ref=await api.resolve(ref,signal);
  const course=legacy?await api.describeCourse(ref.id,signal):await api.course(ref.id,signal);
  if(!sameCourse(context.course,course)){api.reset();throw new Error('课程名称、教师或学期不一致，请核对关联链接。');}
  signal.throwIfAborted();await storePair(course.id,context);signal.throwIfAborted();other={id:String(course.id),legacy,title:course.title};
  const rows=legacy?await api.liveList(course.id,signal):course.lives||[];
  const explicit=legacy&&ref.liveId?'live:'+ref.liveId:!legacy&&ref.subId?ref.subId:null;
  const lesson=explicit?rows.find(row=>row.id===explicit)||{id:explicit}:matchingLive(rows,context.lecture?.start);
  const info=await api.lecture(course.id,lesson.id,signal);if(info.mode!=='live'){api.reset();throw new Error('关联课程已保存；对应课次当前不在直播。');}
  return {api,info,target:{legacy,courseId:String(course.id),lessonId:String(lesson.id)}};
 }
 async function switchSource(ref){
  if(busy)return;const serial=epoch,context=getContext();busy=true;render();say('正在核对对应课次与直播状态…');
  try{
   if(active&&!ref){const info=await context.api.lecture(context.course.id,context.lecture.id,controller.signal);if(info.mode!=='live')throw new Error('原平台此课次当前不在直播。');if(serial!==epoch)return;await onSwitch({api:null,target:null,info});active=false;}
   else{const peer=ref||{id:other.id||undefined,liveId:other.liveId,sessionId:other.sessionId,subId:other.subId,legacy:other.legacy},result=await resolvePeer(peer,controller.signal);if(serial!==epoch){result.api.reset();return;}await onSwitch(result);active=true;}
   say('按课程元数据与上课时间关联；两站课次 ID 分别保存。');
  }catch(error){if(serial===epoch&&error.name!=='AbortError')say(error.message);}
  finally{if(serial===epoch){busy=false;render();}}
 }
 $('switch-live-platform').addEventListener('click',()=>void switchSource());
 $('live-course-candidate').addEventListener('change',()=>{const value=$('live-course-candidate').value;other=value===''?null:choices[Number(value)]||null;render();});
 $('link-live-form').addEventListener('submit',event=>{event.preventDefault();try{const ref=parseCourse($('alternate-live-url').value);if(Boolean(ref.legacy)===Boolean(getContext().course.legacy))throw new Error('请填写另一个平台的课程或直播链接。');void switchSource(ref);}catch(error){say(error.message);}});
 async function refresh(){
  const context=getContext();render();if(!context.live||!context.course||!context.lecture)return;
  const next=platform()+':'+context.course.id+':'+context.lecture.id;if(next===key)return;
  reset();key=next;const serial=epoch;controller=new AbortController();const peerPlatform=platform()==='modern'?'legacy':'modern';
  say('正在查找同课的另一平台入口…');
  try{
   const saved=await chrome.storage.local.get('player:liveCourseLinks'),pairs=cleanLinks(saved['player:liveCourseLinks']);
   choices=pairs.filter(row=>row[platform()]===String(context.course.id)).map(row=>({id:row[peerPlatform],legacy:peerPlatform==='legacy',title:context.course.title}));
   if(!choices.length){
    const file=peerPlatform==='legacy'?'legacy-session-index.json':'private-catalog.json';
    try{const response=await fetch(chrome.runtime.getURL(file));if(response.ok){const data=await response.json();choices=(data.courses||[]).filter(row=>sameCourse(context.course,row)).slice(0,8).map(row=>({id:String(row.id),legacy:peerPlatform==='legacy',title:row.title||row.name}));}}catch{}
   }
   if(!choices.length){const tabs=await chrome.tabs.query({url:peerPlatform==='legacy'?'https://www.yanhekt.cn/*':'https://aita.yanhekt.cn/*'});for(const tab of tabs.slice(0,8)){try{const ref=parseCourse(tab.url),identity=String(ref.id||ref.liveId||ref.sessionId||'');if(identity&&Boolean(ref.legacy)===(peerPlatform==='legacy')&&!choices.some(row=>String(row.id||row.liveId||row.sessionId)===identity))choices.push({...ref,id:ref.id?String(ref.id):undefined,legacy:Boolean(ref.legacy),title:'已打开的'+label(peerPlatform)+'入口 '+identity});}catch{}}}
   if(serial!==epoch)return;
   const select=$('live-course-candidate');select.replaceChildren();if(choices.length>1){const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='多个课程候选，请选择或粘贴具体链接';placeholder.disabled=true;placeholder.selected=true;select.append(placeholder);}for(const [index,row]of choices.entries()){const option=document.createElement('option');option.value=String(index);option.textContent=row.title+' · '+(row.id||row.liveId||row.sessionId);select.append(option);}select.hidden=choices.length<2;
   other=choices.length===1?choices[0]:null;say(choices.length>1?'存在多个课程候选，需要显式选择；也可粘贴具体直播链接。':other?'发现另一平台课程候选；点击切换时核对课程与当前课次。':'可粘贴另一站的课程或直播链接，关联后保留在本浏览器。');render();
  }catch(error){if(serial===epoch&&error.name!=='AbortError')say('可手动粘贴另一平台的课程或直播链接。');}
 }
 return {refresh,reset};
}
