import {courseKey,normalizeCourse,matchesCourse,isModernTerm,termLabel,hasSpecificTerm,courseTermOptions} from './catalog-core.js';
import {explain,parseCourse} from './watch/core.js';
import {safeRecords} from './records.js';

import {RemoteCatalog,RemoteSources,RemoteLms,RemoteLexue} from './remote-client.js';
import {nativeHref,referenceRoute} from './site-routes.js';
import iconMarkup from './ui-icons.svg';
import {courseworkUi} from './coursework-ui.js';
import {TeachingCourses} from './teaching-courses.js';
import {currentTeachingTerm} from './teaching-terms.js';
import {bindingSource,resolveBinding,setBinding,setBindingSource,safeBindings} from './course-bindings.js';
import {CourseworkCache} from './coursework-cache.js';

export function startDesk({root=document,currentRoute=()=>location.hash.slice(1)||'/today',navigate,replaceRoute,hrefForRoute=value=>value,site=false}={}){
const $=id=>root.querySelector('#'+id),main=$('content');
let sidebarChanged=false;
function sidebarCollapsed(value){const button=$('toggle-sidebar');root.querySelector('.sidebar').hidden=value;root.querySelector('.shell').classList.toggle('sidebar-collapsed',value);button.setAttribute('aria-expanded',String(!value));button.setAttribute('aria-label',value?'显示侧边栏':'隐藏侧边栏');button.title=value?'显示侧边栏':'隐藏侧边栏';}
$('toggle-sidebar').addEventListener('click',()=>{sidebarChanged=true;const value=!root.querySelector('.sidebar').hidden;sidebarCollapsed(value);void chrome.storage.local.set({'desk:sidebarCollapsed':value}).catch(()=>{});});
const sources=new RemoteSources(),lms=new RemoteLms(),lexue=new RemoteLexue(),catalog=new RemoteCatalog();
const teaching=new TeachingCourses({lms,lexue});
const symbols=new DOMParser().parseFromString(iconMarkup,'image/svg+xml');

const state={epoch:0,stats:{count:0,terms:[],colleges:[]},favorites:new Set(),mappings:{},bindings:{},my:null,oldMy:null,lms:null,tasks:new Map(),materials:new Map(),details:new Map(),diagnostics:[],date:dayKey(),lastSearch:'#/courses',version:'0.6.0',refresh:false};
const taskCache=new CourseworkCache(state.tasks),materialCache=new CourseworkCache(state.materials);
let toastTimer;const cleanups=[];
const coursework=courseworkUi({root,lms,lexue,node,button,link,loading,empty,toast,deadline,onSubmitted:row=>{for(const rows of state.tasks.values())for(const task of rows)if(task.source===row.source&&task.id===row.id&&task.courseId===row.courseId)task.state='submitted';void render();}});
function toast(value){$('toast').textContent=value;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}
function diagnostic(name,error){const message=explain(error);state.diagnostics.unshift(`${name}：${message}`);state.diagnostics=state.diagnostics.slice(0,20);return message;}
function node(tag,attrs={},...children){const el=document.createElement(tag);for(const [k,v]of Object.entries(attrs)){if(v==null)continue;if(k==='class')el.className=v;else if(k==='onclick'||k==='onchange'||k==='onsubmit'||k==='oninput')el.addEventListener(k.slice(2),v);else if(k==='text')el.textContent=v;else el.setAttribute(k,k==='href'&&String(v).startsWith('#/')?hrefForRoute(v):String(v));}for(const c of children.flat(Infinity))if(c!=null)el.append(typeof c==='string'||typeof c==='number'?document.createTextNode(String(c)):c);return el;}
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),symbol=symbols.getElementById(name);svg.setAttribute('aria-hidden','true');svg.setAttribute('viewBox',symbol?.getAttribute('viewBox')||'0 0 24 24');if(symbol)svg.append(...Array.from(symbol.childNodes).map(n=>n.cloneNode(true)));return svg;}
function link(label,href,cls=''){if(site&&/^https:\/\/(aita|www)\.yanhekt\.cn/.test(href))href=nativeHref(href,{remember:label==='原站'});return node('a',{href,class:cls,...(href.startsWith('https:')?{target:site&&/yanhekt\.cn/.test(href)?'_self':'_blank',rel:'noreferrer'}:{})},label);}
function button(label,action,cls='',attrs={}){return node('button',{type:'button',class:cls,onclick:action,...attrs},label);}
function loading(label='正在读取…'){return node('div',{class:'loading'},label);}
function empty(label,actions=[]){return node('div',{class:'empty'},label,actions.length?node('div',{class:'inline-tools'},actions):null);}
function route(){const raw=currentRoute();const [path,query='']=raw.split('?');return {parts:path.split('/').filter(Boolean),params:new URLSearchParams(query)};}
function go(hash,replace=false){if(navigate){navigate(hash,replace);return;}if(location.hash===hash)void render();else if(replace)location.replace(hash);else location.hash=hash;}
function routeTo(course,tab='watch',sub=course.sessionId){const index=course.indexSource==='autoslides'?'&index_source=autoslides':'';if(course.platform==='legacy'&&/^\d{1,12}$/.test(sub||''))return `#/session/legacy/${sub}?tab=${tab}${index}`;return `#/course/${course.platform}/${course.id}?tab=${tab}${sub?'&sub='+encodeURIComponent(sub):''}${index}`;}
function heading(title,sub,tools=[]){return node('div',{class:'page-heading'},node('div',{},node('h1',{},title),sub?node('p',{class:'muted'},sub):null),node('div',{class:'heading-tools'},tools));}
function tabs(items,active){return node('div',{class:'tabs',role:'tablist'},items.map(([id,label,href])=>node('a',{href,role:'tab','aria-selected':id===active?'true':'false',class:id===active?'active':''},label)));}
function select(label,options,value,onchange){const el=node('select',{'aria-label':label,onchange:e=>onchange(e.target.value)},options.map(([v,t])=>node('option',{value:v},t)));el.value=value;return el;}
function dayKey(value=Date.now()){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);const get=k=>p.find(x=>x.type===k)?.value;return `${get('year')}-${get('month')}-${get('day')}`;}
function dateTitle(value){return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long'}).format(new Date(value+'T12:00:00+08:00'));}
function time(value){return value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(value):'—';}
function deadline(value){return value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(value):'无截止时间';}
function formatPosition(seconds){const n=Math.max(0,Math.floor(seconds||0));return n>=3600?`${Math.floor(n/3600)}:${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`:`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
function pageInfo(value){state.classroomConnection=value?'connected':'error';$('account-link').classList.toggle('connected',Boolean(value));$('account-link').querySelector('span').textContent=value?'已连接':'课堂读取失败';}
async function ensureMy(force=false){if(state.my&&!force)return state.my;if(state.myFlight)return state.myFlight;state.myFlight=(async()=>{try{const rows=await sources.modern.enrolled();state.my=rows;void catalog.call('upsert',{rows}).catch(e=>diagnostic('课程缓存',e));pageInfo(true);return rows;}catch(e){pageInfo(false);throw e;}finally{state.myFlight=null;}})();return state.myFlight;}
async function ensureOld(force=false){if(state.oldMy&&!force)return state.oldMy;try{const rows=await sources.legacy.enrolled();state.oldMy=rows;state.oldClassroomConnection='connected';void catalog.call('upsert',{rows}).catch(()=>{});return rows;}catch(error){state.oldClassroomConnection='error';throw error;}}
const teachingKey=course=>(course.source==='lexue'?'lexue:':'lms:')+course.id;
const mappingKey=course=>course.source==='lexue'?'lexue:'+course.id:course.id;
const teachingName=course=>course.source==='lexue'?'旧乐学':'新乐学';
async function ensureLms(force=false,source){if(force||state.refresh)for(const cache of [taskCache,materialCache])for(const id of source?[source]:['lms','lexue'])cache.invalidate(id);const data=await teaching.load({force:force||state.refresh,source});state.lms=data.rows;state.lmsStatus=data.status;state.lmsErrors=data.errors;if(source&&data.status[source==='lexue'?1:0]===false)throw data.errors[source==='lexue'?1:0]||new Error('乐学读取失败');if(data.status.every(ok=>ok===false))throw new Error('请先登录新乐学或旧乐学');return data.rows;}
function teachingRetry(source,epoch){const label='重新读取'+(source==='lexue'?'旧乐学':'新乐学'),retry=button('刷新',async()=>{retry.disabled=true;try{await ensureLms(true,source);}catch(e){diagnostic('乐学连接',e);}if(epoch===state.epoch)void render();},'text-button',{'aria-label':label,title:label});return retry;}
function teachingConnection(source,epoch){const old=source==='lexue';return empty(node('div',{},node('span',{role:'status'},(old?'旧乐学':'新乐学')+'未连接'),node('small',{},state.lmsErrors?.[old?1:0]?.message||(old?'旧乐学需要独立登录，任务尚未同步':'任务尚未同步'))),[link('登录'+(old?'旧乐学':'新乐学'),old?'https://lexue.bit.edu.cn/login/index.php':'https://zy-eclass.bit.edu.cn/user/courses#/','button-link'),teachingRetry(source,epoch)]);}
function currentTeachingCourses(courses){const term=currentTeachingTerm();return courses.filter(course=>course.term===term);}
async function pool(rows,limit,fn,onDone){const output=[];let next=0;await Promise.all(Array.from({length:Math.min(limit,rows.length)},async()=>{while(next<rows.length){const index=next++;try{output[index]={ok:true,value:await fn(rows[index])};}catch(error){output[index]={ok:false,error};}onDone?.(output.filter(Boolean));}}));return output;}
function loginActions(kind='modern'){const url=kind==='lms'?'https://zy-eclass.bit.edu.cn/user/courses#/':kind==='legacy'?'https://www.yanhekt.cn/':'https://aita.yanhekt.cn/portal/#/';return [link('登录'+(kind==='lms'?'新乐学':kind==='legacy'?'旧版课堂':'延河课堂'),url,'button-link'),button('刷新',()=>void render(),'text-button')];}
function favoriteButton(course){const el=button(icon('star'),async()=>{const selected=!state.favorites.has(course.key);selected?state.favorites.add(course.key):state.favorites.delete(course.key);try{await chrome.storage.local.set({'desk:favorites':[...state.favorites]});el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));}catch{selected?state.favorites.delete(course.key):state.favorites.add(course.key);toast('收藏未保存');}},'icon-button favorite'+(state.favorites.has(course.key)?' selected':''),{'aria-label':'收藏'+course.title,'aria-pressed':String(state.favorites.has(course.key)),title:'收藏'});return el;}
function courseRow(course){return node('div',{class:'course-row','data-course-key':course.key},node('div',{},link(course.title,routeTo(course),'course-title'),node('div',{class:'course-college'},node('span',{},course.college||'课程'),node('span',{class:'course-mobile-meta'},[course.term,course.platform==='legacy'?'旧版':'新版'].filter(Boolean).join(' · ')))),button(course.teacher||'未标注',()=>go('#/courses?scope=all&platform='+course.platform+'&term='+encodeURIComponent(course.term)+'&q='+encodeURIComponent(course.teacher||course.title)),'teacher-button'),node('span',{class:'term'},course.term||'未标注学期'),node('span',{class:'source-label'},course.platform==='legacy'?'旧版':'新版'),favoriteButton(course));}
function courseList(rows){return node('div',{class:'course-list'},rows.map(courseRow));}
function setPage(epoch,...children){if(epoch!==state.epoch)return false;main.replaceChildren(...children.flat());return true;}
function taskState(task){return task.state==='submitted'?['已交','submitted']:task.state==='pending'?[task.closed&&!task.makeUp?'已截止':'未交',task.closed&&!task.makeUp?'closed':'pending']:['待同步',''];}
function pendingTask(task){return ['pending','unknown'].includes(task.state)&&(!task.deadline||task.deadline>Date.now())&&!(task.closed&&!task.makeUp);}
function upcomingTasks(rows){return rows.filter(pendingTask).sort((a,b)=>(a.deadline||Infinity)-(b.deadline||Infinity)).slice(0,4);}
async function recentCourses(){const data=await chrome.storage.local.get(null);const items=Object.entries(data).flatMap(([k,v])=>{const m=k.match(/^progress:(?:(legacy):)?(\d+):([\d:]+)$/);return m&&v&&Number.isFinite(v.time)&&v.time>0?[{platform:m[1]?'legacy':'modern',id:m[2],sub:m[3].split(':')[0],...v}]:[];}).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
 const seen=new Set(),result=[];for(const row of items){const key=courseKey(row.platform,row.id);if(seen.has(key))continue;seen.add(key);const meta=await catalog.call('get',{key});result.push({...row,course:meta||normalizeCourse({id:row.id,title:'课程 '+row.id,platform:row.platform})});if(result.length===4)break;}return result;}

async function todayPage(epoch){
 const date=state.date;const controls=node('div',{class:'date-navigation'},button('‹',()=>{state.date=dayKey(Date.parse(date+'T12:00:00+08:00')-86400000);void render();},'',{'aria-label':'前一天'}),node('input',{type:'date',value:date,'aria-label':'课表日期',onchange:e=>{if(e.target.value){state.date=e.target.value;void render();}}}),button('›',()=>{state.date=dayKey(Date.parse(date+'T12:00:00+08:00')+86400000);void render();},'',{'aria-label':'后一天'}));
 const schedule=node('div',{class:'schedule'},loading()),recent=node('div',{},loading());
 const taskPreview=node('div',{},empty('查看课程作业',[link('打开待办','#/tasks','text-button')]));
 setPage(epoch,heading('今天',dateTitle(date),[controls]),node('div',{class:'grid-today'},node('section',{},node('div',{class:'section-heading'},node('h2',{},'课程安排'),node('span',{class:'muted'},'北京时间')),schedule),node('div',{},node('section',{class:'resume-block'},node('div',{class:'section-heading'},node('h2',{},'继续学习'),link('最近','#/courses?scope=recent')),recent),node('section',{},node('div',{class:'section-heading'},node('h2',{},'近期作业'),link('全部','#/tasks')),taskPreview))));
 void recentCourses().then(rows=>{if(epoch!==state.epoch)return;recent.replaceChildren(...(rows.length?rows.map(r=>node('a',{href:routeTo(r.course,'watch',r.sub),class:'resume-row'},node('span',{class:'course-mark'},icon('courses')),node('div',{class:'row-main'},node('h3',{},r.course.title),node('small',{},`${formatPosition(r.time)}　${r.course.term||''}`)),icon('play'))):[empty('从课程开始观看',[link('查看课程','#/courses','text-button')]) ]));});
 const currentKeys=new Set(currentTeachingCourses(state.lms||[]).map(teachingKey));
 const known=upcomingTasks([...state.tasks.entries()].filter(([key])=>currentKeys.has(key)).flatMap(([,rows])=>rows));
 if(known.length)taskPreview.replaceChildren(...known.map(t=>node('div',{class:'task-mini'},button(t.title,()=>void coursework.task({...t,source:t.source||'lms'}),'row-title'),node('small',{},t.courseTitle,node('time',{},deadline(t.deadline))))));
 void (async()=>{try{const courses=await ensureLms(),unresolved=courses.filter(c=>c.source==='lms'&&!hasSpecificTerm(c.term)).length;const data=await dataset('tasks',currentTeachingCourses(courses));if(epoch!==state.epoch)return;const rows=upcomingTasks(data.rows);taskPreview.replaceChildren(...(rows.length?rows.map(t=>node('div',{class:'task-mini'},button(t.title,()=>void coursework.task({...t,source:t.source||'lms'}),'row-title'),node('small',{},t.courseTitle,t.state==='unknown'?' · 待同步':'',node('time',{},deadline(t.deadline))))):[empty(unresolved?'学期信息未完整读取，暂时无法确认当前学期待办':data.failed?'部分作业未同步':'暂无未交作业')]),...(unresolved?[node('p',{class:'inline-notice inline-tools'},`${unresolved} 门新乐学课程的学期尚未识别，待办可能不完整`,teachingRetry('lms',epoch))]:[]),...(data.partial?[node('p',{class:'inline-notice'},'部分作业详情未同步')]:[]),...(data.failed?[node('p',{class:'inline-notice'},'部分课程任务未同步，请刷新重试')]:[]),...['lms','lexue'].filter((source,i)=>state.lmsStatus?.[i]===false).map(source=>teachingConnection(source,epoch)));}catch(e){diagnostic('近期作业',e);if(epoch===state.epoch)taskPreview.replaceChildren(empty('乐学未连接',[...loginActions('lms'),link('登录旧乐学','https://lexue.bit.edu.cn/login/index.php','text-button')]));}})();
 try{const mine=await ensureMy();
  if(epoch===state.epoch&&mine.length){const latest=mine.map(c=>c.term).sort().at(-1),shelf=node('section',{class:'today-courses'},node('div',{class:'section-heading'},node('h2',{},'我的课程'),link('全部','#/courses')),node('div',{class:'today-course-grid'},mine.filter(c=>c.term===latest).slice(0,8).map(c=>node('a',{class:'resume-row',href:routeTo(c)},node('span',{class:'course-mark'},icon('courses')),node('div',{class:'row-main'},node('h3',{},c.title),node('small',{},c.teacher))))));main.append(shelf);}
  const rows=await sources.modern.today(date);if(epoch!==state.epoch)return;
  schedule.replaceChildren(...(rows.length?rows.map(c=>{const active=c.status==='1'&&(!c.end||c.end>Date.now()-1800000);const upcoming=c.start&&c.start>Date.now();return node('article',{class:'lesson'},node('div',{class:'lesson-time'},node('strong',{},time(c.start)),node('span',{},time(c.end))),node('div',{class:'lesson-body'+(active?' live':'')},node('h3',{},link(c.title,routeTo(c))),node('p',{},[c.teacher,c.room].filter(Boolean).join('　')),node('div',{class:'lesson-bottom'},node('span',{class:'state'+(active?' live':'')},active?'直播中':upcoming?'未开始':'已结束'),link(active?'观看直播':'进入课程',routeTo(c,'watch',c.subId),active?'button-link primary':'button-link'))));}):[empty('今天没有课程',[link('查找课程','#/courses?scope=all','text-button')]) ]));
 }catch(e){diagnostic('课表',e);if(epoch===state.epoch)schedule.replaceChildren(empty('连接课堂',[...loginActions()]));}
}

function courseHash(values){const p=new URLSearchParams(values);return '#/courses'+(p.size?'?'+p.toString():'');}
async function coursesPage(epoch,params){
 const scope=params.get('scope')||'my',q=params.get('q')||'',platform=scope==='all'?(params.get('platform')==='legacy'?'legacy':'modern'):['modern','legacy'].includes(params.get('platform'))?params.get('platform'):'all',term=hasSpecificTerm(params.get('term'))&&(platform!=='modern'||isModernTerm(params.get('term')))?termLabel(params.get('term')):'',teacher=params.get('teacher')||'',college=params.get('college')||'',page=Math.max(1,Number(params.get('page'))||1);
 state.lastSearch='#'+currentRoute();if((root.activeElement||document.activeElement)!==$('global-query'))$('global-query').value=q;
 const values={scope,q,platform,term,teacher,college};const change=(name,value)=>go(courseHash({...values,[name]:value,page:1}));
 const indexMode=scope==='all'&&platform==='legacy';
 const filterTerms=state.stats.termsByPlatform?.[platform]||(platform==='modern'?state.stats.terms.filter(isModernTerm):state.stats.terms);
 const termFilter=select('学期',[['',indexMode?'选择学期':'全部学期'],...(indexMode?[]:filterTerms).map(t=>[t,t])],term,v=>change('term',v));
 const filter=node('div',{class:'filters'},select('平台',scope==='all'?[['modern','新版'],['legacy','旧版']]:[['all','全部平台'],['modern','新版'],['legacy','旧版']],platform,v=>go(courseHash({...values,platform:v,term:'',college:'',page:1}))),termFilter,indexMode?link('课程索引站','https://share.ruc.edu.kg/','text-button'):select('学院',[['','全部学院'],...state.stats.colleges.map(t=>[t,t])],college,v=>change('college',v)));
 const results=node('div',{},loading()),caption=node('div',{class:'list-heading'},node('span',{},'课程'),node('span',{},''));
 const pageNode=node('div',{class:'pagination'}),teaching=node('section',{class:'section-space'});
 setPage(epoch,heading('课程','',[scope==='all'&&/^\d{1,12}$/.test(q)?link('打开旧版课次 '+q,`#/session/legacy/${q}?tab=watch`,'button-link'):null,link('导入目录','#/settings','button-link')]),tabs([['my','我的课程',courseHash({scope:'my'})],['all','全校课程',courseHash({scope:'all'})],['favorites','收藏',courseHash({scope:'favorites'})],['recent','最近',courseHash({scope:'recent'})]],scope),filter,caption,results,pageNode,teaching);
 if(scope==='my'&&platform==='all')void ensureLms().then(courses=>{if(epoch!==state.epoch)return;const rows=courses.filter(c=>c.source==='lexue'&&(!term||c.term===term)&&(!q||c.title.toLowerCase().includes(q.toLowerCase()))&&(!college||c.department===college)&&!teacher);if(rows.length)teaching.replaceChildren(node('h2',{},'旧乐学课程'),node('div',{class:'more-links'},rows.map(c=>link(c.title,`#/materials?course=${teachingKey(c)}&term=${c.term}`))));}).catch(()=>{});
 let rows=[],total=0,partial='';
 if(scope==='my'){
  try{const my=platform==='legacy'?await ensureOld():platform==='modern'?await ensureMy():await Promise.allSettled([ensureMy(),ensureOld()]).then(results=>{if(results.every(r=>r.status==='rejected'))throw results[0].reason;return results.flatMap(r=>r.status==='fulfilled'?r.value:[]);});rows=my.filter(r=>matchesCourse(r,{q,platform,term,teacher,college}));total=rows.length;rows=rows.slice((page-1)*40,page*40);}catch(e){diagnostic('所学课程',e);if(epoch===state.epoch)results.replaceChildren(empty('连接课堂',loginActions()));return;}
 }else if(scope==='favorites'){
  rows=(await Promise.all([...state.favorites].map(key=>catalog.call('get',{key})))).filter(Boolean).filter(r=>matchesCourse(r,{q,platform,term,teacher,college}));total=rows.length;rows=rows.slice((page-1)*40,page*40);
 }else if(scope==='recent'){
  rows=(await recentCourses()).map(r=>r.course).filter(r=>matchesCourse(r,{q,platform,term,teacher,college}));total=rows.length;
 }else if(indexMode){
  try{const meta=await sources.index.terms();if(epoch!==state.epoch)return;const validTerms=meta.terms.filter(hasSpecificTerm),chosen=term||validTerms[0]||'';values.term=chosen;const field=termFilter.matches('select')?termFilter:termFilter.querySelector('select');field.replaceChildren(new Option('选择学期',''),...validTerms.map(t=>new Option(t,t)));field.value=chosen;
   const result=await sources.index.search(q||teacher,{page,term:chosen});rows=result.rows;total=result.total;partial=`旧版课程索引 · 尚未完整${result.reportedTotal>total?' · 共匹配 '+result.reportedTotal+' 门，仅返回前 '+total+' 门':''}${result.truncated?' · 候选范围受限':''}`;if(rows.length)await catalog.call('upsert',{rows}).catch(()=>{});
  }catch(e){if(epoch===state.epoch){caption.lastChild.textContent='索引读取失败';results.replaceChildren(empty(e.message,[link('打开索引站','https://share.ruc.edu.kg/','button-link'),button('重试',()=>void render(),'text-button')]));}return;}
 }else{
  const query={q,platform,term,teacher,college,offset:(page-1)*40,limit:40};
  const cached=await catalog.call('search',query);
  rows=cached.rows;total=cached.total;
  if(!total||q||teacher){
   if(rows.length&&epoch===state.epoch){results.replaceChildren(courseList(rows));caption.lastChild.textContent=`${total.toLocaleString()} 门`;}
   try{const remote=await sources.modern.search(q||teacher,page,{term,college});pageInfo(true);
    if(remote.rows.length){void catalog.call('upsert',{rows:remote.rows}).catch(()=>{});if(!total){rows=remote.rows;total=remote.total;}else{const merged=new Map([...rows,...remote.rows].map(r=>[r.key,r]));rows=[...merged.values()].slice(0,40);}}
   }catch(e){diagnostic('新版搜索',e);partial='目录结果';}
  }
 }
 if(epoch!==state.epoch)return;
 caption.lastChild.textContent=[`${total.toLocaleString()} 门`,partial].filter(Boolean).join('　');
 results.replaceChildren(rows.length?courseList(rows):empty(q?'没有匹配课程':scope==='favorites'?'还没有收藏':scope==='recent'?'还没有观看记录':indexMode?'请输入课程名或教师；索引尚未完整':platform==='legacy'?'暂无旧版课程':'暂无课程',[indexMode?link('打开索引站','https://share.ruc.edu.kg/','text-button'):link('全校找课','#/courses?scope=all','text-button')]));
 if(total>40)pageNode.append(button('上一页',()=>go(courseHash({...values,page:page-1})),'',page===1?{disabled:''}:{}),node('span',{},`${page} / ${Math.max(1,Math.ceil(total/40))}`),button('下一页',()=>go(courseHash({...values,page:page+1})),'',page*40>=total?{disabled:''}:{}));
}

async function detailCourse(platform,id){
 const key=courseKey(platform,id);if(state.details.has(key))return state.details.get(key);
 const cached=await catalog.call('get',{key});
 const actual=await sources.detail(platform,id,{force:state.refresh,indexed:cached?.indexSource==='autoslides'});const course=normalizeCourse({...cached,...actual,code:actual.code||cached?.code,college:actual.college||cached?.college,lmsId:actual.lmsId||cached?.lmsId});
 const full={...course,replays:actual.replays,lives:actual.lives};state.details.set(key,full);await catalog.call('upsert',{rows:[course]});return full;
}
async function sessionPage(epoch,platform,id,params){
 if(platform!=='legacy'||!/^\d{1,12}$/.test(id)){setPage(epoch,empty('课次地址无效'));return;}
 try{
  const ref=await sources.resolve('https://www.yanhekt.cn/session/'+id);
  if(epoch!==state.epoch)return;
  if(!ref.legacy||ref.sessionId!==id)throw new Error('旧站返回的课次身份不一致');
  await coursePage(epoch,'legacy',ref.id,params,id);
 }catch(e){diagnostic('旧版课次',e);setPage(epoch,empty(explain(e),loginActions('legacy')));}
}
async function coursePage(epoch,platform,id,params,targetSession){
 if(!['legacy','modern'].includes(platform)||!/^\d{1,12}$/.test(id)){setPage(epoch,empty('课程地址无效'));return;}
 const tab=params.get('tab')||'watch',key=courseKey(platform,id);let sessionId=platform==='legacy'&&/^\d{1,12}$/.test(targetSession||params.get('sub')||'')?targetSession||params.get('sub'):null;
 const withTarget=value=>sessionId?{...value,sessionId}:value;
 let course=withTarget(await catalog.call('get',{key})||normalizeCourse({platform,id,title:'课程 '+id}));
 if(platform==='legacy'&&params.get('index_source')==='autoslides')course={...course,indexSource:'autoslides'};
 const title=node('div',{}),area=node('div',{}),originalLink=link('原站',sessionId?'https://www.yanhekt.cn/session/'+sessionId:course.url,'button-link'),toolbar=node('div',{class:'inline-tools'},favoriteButton(course),originalLink);
 const head=()=>{title.replaceChildren(link('‹ 课程',state.lastSearch,'course-route-back'),node('h1',{},course.title),node('div',{class:'course-meta'},node('span',{},course.teacher),node('span',{},course.term),node('span',{class:'source-label'},platform==='legacy'?'旧版':'新版'),sessionId?node('span',{},'课次 '+sessionId):null));};head();
 const makeTabs=()=>tabs([['watch','观看',routeTo(course)],['history','同师往年',routeTo(course,'history')],['peers','同课老师',routeTo(course,'peers')],['materials','资料与任务',routeTo(course,'materials')]],tab),navigation=node('div',{},makeTabs());
 setPage(epoch,node('div',{class:'page-heading course-heading'},title,toolbar),navigation,area);
 if(tab==='watch'){
  const src=new URL(chrome.runtime.getURL('watch/player.html'));src.searchParams.set(platform==='legacy'?'legacy':'course',id);src.searchParams.set('embedded','1');if(course.indexSource==='autoslides')src.searchParams.set('index_source','autoslides');
  if(state.refresh)src.searchParams.set('refresh','1');
  const legacyLive=params.get('live');if(platform==='legacy'&&/^\d{1,12}$/.test(legacyLive||'')){src.searchParams.delete('legacy');src.searchParams.set('legacy_live',legacyLive);}
  const sub=sessionId||params.get('sub');if(!legacyLive&&sub&&/^\d{1,12}$/.test(sub)){if(platform==='legacy'){src.searchParams.delete('legacy');src.searchParams.set('legacy_session',sub);}else src.searchParams.set('sub_id',sub);}
  const frame=node('iframe',{src:src.href,class:'watch-frame',title:'课程播放器',allow:'autoplay; fullscreen; clipboard-write','allowfullscreen':''});
  const controller=new AbortController();cleanups.push(()=>controller.abort());
  window.addEventListener('message',event=>{
   if(event.source!==frame.contentWindow||event.origin!==new URL(chrome.runtime.getURL('')).origin)return;
   if(event.data?.type==='REFINE_VIEW_MODE'&&['browser','normal'].includes(event.data.mode)){frame.classList.toggle('viewer-window-frame',event.data.mode==='browser');}
   if(event.data?.type==='REFINE_PLAYER_SIZE'&&!frame.classList.contains('viewer-window-frame')&&Number.isFinite(event.data.height)&&event.data.height>=200&&event.data.height<=12000)frame.style.height=event.data.height+'px';
   if(event.data?.type==='REFINE_COURSE'&&String(event.data.course?.id)===id){const incoming=normalizeCourse({...course,...event.data.course,platform});if(incoming&&epoch===state.epoch){course=withTarget(incoming);head();void catalog.call('upsert',{rows:[incoming]}).catch(()=>{});}}
   if(event.data?.type==='REFINE_SESSION'&&epoch===state.epoch&&platform==='legacy'&&String(event.data.courseId)===id&&/^\d{1,12}$/.test(event.data.sessionId||'')&&event.data.sessionId!==sessionId){
    sessionId=event.data.sessionId;course=withTarget(course);head();navigation.replaceChildren(makeTabs());
    const target='https://www.yanhekt.cn/session/'+sessionId;originalLink.href=site?nativeHref(target,{remember:true}):target;
    if(replaceRoute)replaceRoute(routeTo(course));else history.replaceState(null,'',routeTo(course));
   }
  },{signal:controller.signal});area.append(frame);return;
 }else area.append(loading());
 try{course=withTarget(await detailCourse(platform,id));if(epoch!==state.epoch)return;head();}catch(e){diagnostic('课程详情',e);if(tab!=='watch'&&epoch===state.epoch&&!course.teacher){area.replaceChildren(empty('连接课堂',loginActions(platform)));return;}}
 if(epoch!==state.epoch)return;
 if(tab==='history'||tab==='peers'){
  const teacher=params.get('teacher')||course.teachers[0]||'';let related=await catalog.call('related',{course:{...course,teachers:teacher?[teacher]:course.teachers},kind:tab==='history'?'teacher':'title',platform:'modern',limit:100});
  if(tab==='history'&&platform==='modern')try{const recommendations=await sources.modern.otherTeacherCourses(id);related=[...new Map([...related,...recommendations.filter(r=>r.teachers.includes(teacher))].map(r=>[r.key,r])).values()];await catalog.call('upsert',{rows:recommendations});}catch(e){diagnostic('相关课程',e);}
  related=related.filter(r=>r.platform==='modern'&&r.key!==key&&(tab!=='history'||!course.term||!r.term||r.term<course.term)).sort((a,b)=>b.term.localeCompare(a.term));
  if(epoch!==state.epoch)return;
  area.replaceChildren(...(course.teachers.length>1&&tab==='history'?[node('div',{class:'teacher-chips'},course.teachers.map(t=>button(t,()=>go(routeTo(course,'history')+'&teacher='+encodeURIComponent(t)),t===teacher?'active':'')))]:[]),related.length?courseList(related):empty(tab==='history'?'暂无往年课程':'暂无同课课程'),node('div',{class:'section-space'},link(tab==='history'?'查找同师课程':'搜索这门课','#/courses?scope=all&q='+encodeURIComponent(tab==='history'?teacher:course.title),'text-button')));
 }else if(tab==='materials')await courseMaterials(epoch,course,area,params);
}

async function dataset(kind,ids,force=false,onProgress){
 const cache=kind==='tasks'?taskCache:materialCache;
 const summary=results=>({rows:results.flatMap(r=>r.ok?r.value:[]),failed:results.filter(r=>!r.ok).length,partial:results.filter(r=>r.ok&&r.value.some(row=>row.detailError)).length,completed:results.length,total:ids.length});
 const results=await pool(ids,3,course=>{const client=course.source==='lexue'?lexue:lms;return cache.read(course,()=>kind==='tasks'?client.homeworks(course.id):client.materials(course.id),force);},onProgress?results=>onProgress(summary(results)):undefined);
 results.filter(r=>!r.ok).forEach(r=>diagnostic(kind==='tasks'?'作业':'资料',r.error));return summary(results);
}

async function classroomMaterials(courses,force=false){
 const results=await pool(courses,3,async course=>{const key='modern:'+course.key;if(state.materials.has(key)&&!force)return state.materials.get(key);const rows=(await sources.modern.materials(course.id)).map(r=>({...r,courseTitle:course.title}));state.materials.set(key,rows);return rows;});
 const failed=results.filter(r=>!r.ok);failed.forEach(r=>diagnostic('课堂资料',r.error));return {rows:results.flatMap(r=>r.ok?r.value:[]),failed:failed.length};
}
async function courseMaterials(epoch,course,area,params){
 const source=bindingSource(course,state.bindings,state.mappings,params.get('source'));
 const sourceIndex=source==='lexue'?1:0,name=source==='lexue'?'旧乐学':'新乐学';
 const platform=select('乐学平台',[['lms','新乐学'],['lexue','旧乐学']],source,value=>{if(epoch!==state.epoch)return;setBindingSource(state.bindings,course,value);void chrome.storage.local.set({'desk:bindings':state.bindings}).catch(e=>diagnostic('课程关联',e));go(routeTo(course,'materials')+'&source='+value);});
 const associated=node('div',{class:'inline-tools'},platform);
 area.replaceChildren(associated,loading());
 let mine=[];try{mine=await ensureLms();}catch(e){diagnostic('乐学连接',e);}
 if(epoch!==state.epoch)return;
 const my=state.my||await ensureMy().catch(()=>[]),official=my.find(c=>c.key===course.key)?.lmsId;
 if(epoch!==state.epoch)return;
 const candidates=mine.filter(c=>c.source===source),resolved=resolveBinding(course,source,candidates,{bindings:state.bindings,legacy:state.mappings,official:official||course.lmsId}),target=resolved.target;
 if(target&&resolved.origin!=='saved'){setBinding(state.bindings,course,source,target);void chrome.storage.local.set({'desk:bindings':state.bindings}).catch(e=>diagnostic('课程关联',e));}
 const picker=select('关联乐学课程',[['','选择'+name+'课程'],...candidates.map(c=>[mappingKey(c),c.title+'　'+c.term])],target?mappingKey(target):'',async value=>{if(epoch!==state.epoch)return;const chosen=candidates.find(c=>mappingKey(c)===value);setBinding(state.bindings,course,source,chosen||null);await chrome.storage.local.set({'desk:bindings':state.bindings});if(epoch===state.epoch)void render();});
 picker.disabled=state.lmsStatus?.[sourceIndex]!==true;associated.append(picker);if(!picker.disabled)associated.append(teachingRetry(source,epoch));
 if(target)associated.append(node('details',{class:'course-tools'},node('summary',{},'更多'),node('div',{class:'inline-tools'},target.source==='lexue'?[link('旧乐学课程',target.url)]:[['课程信息','outline'],['全部活动','content#/'],['班级成员','enrollments'],['点名记录','rollcall'],['课堂报告','inclass-report#/'],['成绩','score'],['学习分析','my-stat'],['应用中心','extensions'],['考核评价','evaluation']].map(([title,path])=>link(title,`https://zy-eclass.bit.edu.cn/course/${target.id}/${path}`)))));
 const lmsRows=target?await dataset('materials',[target],state.refresh):{rows:[],failed:0};
 let modern=[];if(course.platform==='modern')try{modern=(await sources.modern.materials(course.id)).map(r=>({...r,courseTitle:course.title}));}catch(e){diagnostic('课堂资料',e);}
 if(epoch!==state.epoch)return;
 const materials=[...modern,...lmsRows.rows],connected=state.lmsStatus?.[sourceIndex]===true;
 const unavailable=!connected?teachingConnection(source,epoch):lmsRows.failed?empty(name+'资料读取失败',[teachingRetry(source,epoch),link('原站',target.url,'button-link')]):!target?empty(resolved.blocked?'历史关联与当前课程不符，请重新选择':candidates.length?'请选择'+name+'课程':name+'暂无课程'):null;
 area.replaceChildren(associated,node('div',{class:'section-space'},node('div',{class:'section-heading'},node('h2',{},'课程资料'),coursework.allButton(materials,course.title)),unavailable,materials.length?materialList(materials):unavailable?null:materialList(materials)));
 if(target){const tasks=await dataset('tasks',[target],state.refresh);if(epoch===state.epoch)area.append(node('div',{class:'section-space'},node('h2',{},'课程任务'),tasks.failed?empty(name+'作业读取失败',[teachingRetry(source,epoch)]):tasks.rows.length?taskList(tasks.rows):empty('暂无已发布作业')));}
}
function taskList(rows){return node('div',{},rows.map(t=>{const label=taskState(t);return node('div',{class:'task-row'+(t.deadline&&t.deadline<Date.now()&&t.state!=='submitted'?' overdue':'')},node('div',{},node('h3',{},button(t.title,()=>void coursework.task({...t,source:t.source||'lms'}),'row-title')),node('small',{},t.courseTitle,t.source==='lexue'?' · 旧乐学':'',t.group?'　小组':'')),node('time',{class:'deadline'},deadline(t.deadline)),node('span',{class:'state '+label[1]},label[0]),button(icon('arrow'),()=>void coursework.task({...t,source:t.source||'lms'}),'icon-button',{'aria-label':'查看'+t.title}));}));}
function materialList(rows){if(!rows.length)return empty('暂无已发布资料');return node('div',{},rows.map(r=>node('div',{class:'material-row'},node('div',{class:'file-mark'},icon('files')),node('div',{},node('h3',{},button(r.title,()=>void coursework.resources(r),'row-title')),node('small',{},r.courseTitle,r.source==='lexue'?' · 旧乐学':'')),button('附件',()=>void coursework.resources(r),'attachment-button'),link(icon('arrow'),r.url,'icon-button'))));}
async function learningPage(epoch,kind,params){
 const isTasks=kind==='tasks',body=node('div',{},loading());setPage(epoch,heading(isTasks?'待办':'资料','',[link('新乐学','https://zy-eclass.bit.edu.cn/user/courses#/','button-link'),link('旧乐学','https://lexue.bit.edu.cn/my/','button-link')]),body);
 let courses=[],classroom=[],lmsConnected=true,classroomConnected=true;
 const source=['lms','lexue','modern'].includes(params.get('source'))?params.get('source'):'all';
 const fetched=await Promise.allSettled([ensureLms(false,['lms','lexue'].includes(source)?source:undefined),isTasks?Promise.resolve([]):ensureMy()]);
 if(fetched[0].status==='fulfilled')courses=fetched[0].value;else{lmsConnected=false;diagnostic('新乐学',fetched[0].reason);}
 if(fetched[1].status==='fulfilled')classroom=fetched[1].value;else{classroomConnected=false;diagnostic('课堂资料',fetched[1].reason);}
 if(!courses.length&&!classroom.length&&!lmsConnected){if(epoch===state.epoch)body.replaceChildren(empty((source==='lms'?'新乐学':source==='lexue'?'旧乐学':'乐学')+'读取失败：'+explain(fetched[0].reason),[button('重试',()=>void render(),'button-link'),...loginActions('lms'),link('登录旧乐学','https://lexue.bit.edu.cn/login/index.php','button-link')]));return;}
 if(epoch!==state.epoch)return;
 const options=[...courses.map(c=>({...c,filterKey:teachingKey(c)})),...classroom.map(c=>({...c,filterKey:c.key,source:'modern'}))].filter(c=>source==='all'||c.source===source);
 const terms=courseTermOptions(options),current=currentTeachingTerm(),unmatchedCurrent=isTasks&&!terms.includes(current);if(unmatchedCurrent){terms.push(current);terms.sort().reverse();}const requestedTerm=termLabel(params.get('term')),term=params.has('term')?(terms.includes(requestedTerm)?requestedTerm:''):(isTasks?current:terms[0]||''),courseId=params.get('course')||'',status=params.get('state')||'pending';
 const selected=courses.filter(c=>(source==='all'||c.source===source)&&(!term||c.term===term)&&(!courseId||teachingKey(c)===courseId));
 const selectedClassroom=classroom.filter(c=>(source==='all'||source==='modern')&&(!term||c.term===term)&&(!courseId||c.key===courseId));
 const change=(name,value)=>go('#/'+kind+'?'+new URLSearchParams({term,course:courseId,state:status,source,[name]:value}));
 const filters=node('div',{class:'filters'},select('资料来源',[['all','全部来源'],...(!isTasks?[['modern','延河课堂']]:[]),['lms','新乐学'],['lexue','旧乐学']],source,value=>go('#/'+kind+'?'+new URLSearchParams({source:value,term:isTasks?term:'',course:'',state:status}))),select('学期',[['','全部学期'],...terms.map(t=>[t,unmatchedCurrent&&t===current?t+'（未匹配课程）':t])],term,v=>go('#/'+kind+'?'+new URLSearchParams({term:v,course:'',state:status,source}))),select('课程',[['','全部课程'],...options.filter(c=>!term||c.term===term).map(c=>[c.filterKey,c.title+' · '+(c.source==='modern'?'课堂':teachingName(c))])],courseId,v=>change('course',v)));
 if(isTasks)filters.append(select('提交状态',[['pending','未交'],['submitted','已交'],['all','全部']],status,v=>change('state',v)));
 const results=node('div',{id:'learning-results','aria-busy':'true'},loading());body.replaceChildren(filters,results);
 const unresolved=term?options.filter(c=>c.source==='lms'&&!hasSpecificTerm(c.term)).length:0;
 const updateResults=(data,shared={rows:[],failed:0},progress=false)=>{if(epoch!==state.epoch)return;results.setAttribute('aria-busy',String(progress));
 let rows=[...shared.rows,...data.rows];if(isTasks)rows=rows.filter(r=>status==='all'||(status==='pending'?pendingTask(r):r.state===status)).sort((a,b)=>(a.deadline||Infinity)-(b.deadline||Infinity));
 const notices=[];if(unresolved)notices.push(`${unresolved} 门新乐学课程的学期尚未识别，当前筛选结果不完整`,teachingRetry('lms',epoch));if(data.failed+shared.failed)notices.push(`${data.failed+shared.failed} 门课程未同步，请刷新重试`);if(data.partial)notices.push('部分作业详情未同步');if((source==='all'||source==='lms')&&(!lmsConnected||state.lmsStatus?.[0]===false))notices.push(link('登录新乐学','https://zy-eclass.bit.edu.cn/user/courses#/','text-button'),teachingRetry('lms',epoch));if((source==='all'||source==='lexue')&&(!lmsConnected||state.lmsStatus?.[1]===false))notices.push(node('span',{role:'status'},isTasks?'旧乐学未连接，旧乐学任务尚未同步':'旧乐学未连接，资料尚未同步'),link('登录旧乐学','https://lexue.bit.edu.cn/login/index.php','text-button'),teachingRetry('lexue',epoch));if(!classroomConnected)notices.push('课堂未连接');
 if(progress)notices.unshift(`已读取 ${data.completed}/${data.total} 门课程，${rows.length} 项待办`);
 results.replaceChildren(...(notices.length?[node('p',{class:'inline-notice inline-tools'},notices)]:[]),isTasks?(rows.length?taskList(rows):(progress?loading('正在读取作业…'):empty(unresolved?'学期信息未完整读取，暂时无法确认当前学期待办':data.failed?'作业未能完整读取，请刷新重试':status==='submitted'?'暂无已交作业':status==='all'?'暂无已发布作业':'暂无未交作业'))):materialList(rows));
 };
 if(isTasks)updateResults({rows:[],failed:0,partial:0,completed:0,total:selected.length},undefined,true);
 const [data,shared]=await Promise.all([dataset(kind,selected,state.refresh,isTasks?data=>updateResults(data,undefined,true):undefined),isTasks?Promise.resolve({rows:[],failed:0}):classroomMaterials(selectedClassroom,state.refresh)]);if(epoch!==state.epoch)return;
 if(!isTasks&&courseId)filters.append(coursework.allButton([...shared.rows,...data.rows],options.find(c=>c.filterKey===courseId)?.title));
 updateResults(data,shared);

}

async function exportRecords(){const blob=new Blob([JSON.stringify(safeRecords(await chrome.storage.local.get(null)),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=link('','');a.href=url;a.download='延河学习记录.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function settingsPage(epoch){
 const input=node('input',{id:'catalog-file',type:'file',accept:'.xlsx,.json',hidden:'',onchange:async event=>{const input=event.target,file=input.files[0];if(!file)return;const status=$('import-state');status.textContent='正在导入…';try{state.stats=await catalog.call('import',{name:file.name,buffer:await file.arrayBuffer()},count=>status.textContent=`已读取 ${count.toLocaleString()} 门`);status.textContent=state.stats.importedSessions?`已导入 ${state.stats.imported.toLocaleString()} 门旧版课程 / ${state.stats.importedSessions.toLocaleString()} 个课次`:`${state.stats.count.toLocaleString()} 门`;toast('课程目录已更新');}catch(e){status.textContent='导入失败';toast(diagnostic('课程导入',e));}input.value='';}});
 const records=node('input',{id:'records-file',type:'file',accept:'.json',hidden:'',onchange:async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error('记录文件超过 10 MB');const value=safeRecords(JSON.parse(await file.text()));await chrome.storage.local.set(value);state.favorites=new Set(value['desk:favorites']||[...state.favorites]);state.mappings=value['desk:mappings']||state.mappings;state.bindings=value['desk:bindings']||state.bindings;toast('学习记录已导入');}catch(e){toast(diagnostic('记录导入',e));}input.value='';}});
 const setting=(title,sub,tools)=>node('div',{class:'setting-row'},node('div',{},node('h3',{},title),node('p',{},sub)),node('div',{class:'inline-tools'},tools));
 const connectionText=()=>['新版课堂'+(state.classroomConnection==='connected'?'已连接':state.classroomConnection==='error'?'读取失败':'尚未检查'),'旧版课堂'+(state.oldClassroomConnection==='connected'?'已连接':state.oldClassroomConnection==='error'?'读取失败':'尚未检查'),...['新乐学','旧乐学'].map((name,i)=>name+(state.lmsStatus?.[i]===true?'已连接':state.lmsStatus?.[i]===false?'读取失败':'尚未检查'))].join('　');
 const connectionStatus=node('span',{id:'connection-status',role:'status'},connectionText());
 const checkConnections=button('检查连接',async()=>{checkConnections.disabled=true;connectionStatus.textContent='正在检查四个平台…';await Promise.allSettled([ensureMy(true),ensureOld(true),ensureLms(true)]);if(epoch===state.epoch)connectionStatus.textContent=connectionText();checkConnections.disabled=false;});
 const section=node('div',{class:'settings'},setting('课程目录',`旧版 ${state.stats.legacy.toLocaleString()}　新版 ${state.stats.modern.toLocaleString()}`,[node('span',{id:'import-state',class:'muted'},`${state.stats.count.toLocaleString()} 门`),button('导入课程表',()=>input.click()),input]),
  setting('学习记录','播放进度、字幕校准与收藏',[button('导出',()=>void exportRecords()),button('导入',()=>records.click()),records]),
  setting('连接',connectionStatus,[checkConnections,link('延河课堂','https://aita.yanhekt.cn/portal/#/','button-link'),link('旧版','https://www.yanhekt.cn/','button-link'),link('新乐学','https://zy-eclass.bit.edu.cn/user/courses#/','button-link'),link('旧乐学','https://lexue.bit.edu.cn/my/','button-link')]),
  setting('时间','课表与截止时间使用北京时间',[]),setting('延河焕新',state.version,[link('项目仓库','https://github.com/1whoarei1/yanhe-refine','text-button')]),
  node('details',{},node('summary',{},'诊断'),node('pre',{},state.diagnostics.length?state.diagnostics.join('\n'):'暂无错误')));
 setPage(epoch,heading('设置',''),section);
}

function morePage(epoch){
 const groups=[['学习',[
  ['我的笔记','https://aita.yanhekt.cn/personal/#/myStudy/myNote'],['学习日志','https://aita.yanhekt.cn/personal/#/myStudy/myLog'],['我的小组','https://aita.yanhekt.cn/personal/#/myStudy/myTeam'],['我的成绩','https://aita.yanhekt.cn/personal/#/myStudy/myScore'],['课堂任务','https://aita.yanhekt.cn/personal/#/myStudy/myTask'],['选听课程','https://aita.yanhekt.cn/personal/#/myStudy/myCourse'],['原站收藏','https://aita.yanhekt.cn/personal/#/myStudy/myFavorites'],['学习记录','https://aita.yanhekt.cn/personal/#/myStudy/learnRecord'],['学习统计','https://aita.yanhekt.cn/personal/#/myStudy/studyCount'],['我的提问','https://aita.yanhekt.cn/personal/#/myStudy/myQuestion'],['我的回答','https://aita.yanhekt.cn/personal/#/myStudy/myAnswer']]],
  ['发现',[['知识图谱','https://aita.yanhekt.cn/graph?tenant_code=21'],['课程智能体','https://agent.bit.edu.cn/product/llm/mall/application']]],
  ['新乐学工具',[['课程笔记','https://zy-eclass.bit.edu.cn/user/notes'],['个人资源库','https://zy-eclass.bit.edu.cn/user/resources/files'],['个人档案','https://zy-eclass.bit.edu.cn/user/profile']]],
  ['原站',[['旧乐学','https://lexue.bit.edu.cn/my/'],['新乐学','https://zy-eclass.bit.edu.cn/user/courses#/'],['新版门户','https://aita.yanhekt.cn/portal/#/'],['学习空间','https://aita.yanhekt.cn/workbenchAi?tenant_code=21'],['旧版课堂','https://www.yanhekt.cn/home'],['旧版直播','https://www.yanhekt.cn/liveCourse'],['账号设置','https://aita.yanhekt.cn/personal/#/myStudy/accountSetting'],['帮助中心','https://aita.yanhekt.cn/play/0/default/helpcenter/downloads.html']]]];
 setPage(epoch,heading('更多',''),node('div',{class:'more-groups'},groups.map(([title,entries])=>node('section',{},node('h2',{},title),node('div',{class:'more-links'},entries.map(([label,url])=>link(label,url)))))));
}

async function resolveReference(value){const parsed=parseCourse(value);return parsed.legacy&&parsed.sessionId?parsed:sources.resolve(value);}
async function openReference(params){let value;if(params.has('legacy_live'))value='https://www.yanhekt.cn/live/'+params.get('legacy_live');else if(params.has('legacy_session'))value='https://www.yanhekt.cn/session/'+params.get('legacy_session');else value=params.get('url');go(referenceRoute(await resolveReference(value)),true);}
async function render(){cleanups.splice(0).forEach(fn=>fn());const epoch=++state.epoch,{parts,params}=route(),page=parts[0]||'today';coursework.setContext((['course','session'].includes(page)?parts.slice(0,3).join('/')+':'+(params.get('tab')||'watch'):page+':'+(params.get('course')||''))+':'+(params.get('source')||''));main.dataset.page=page;root.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===(['course','session','open'].includes(page)?'courses':page)));main.replaceChildren(loading());try{
 if(page==='today')await todayPage(epoch);else if(page==='courses')await coursesPage(epoch,params);else if(page==='course')await coursePage(epoch,parts[1],parts[2],params);else if(page==='session')await sessionPage(epoch,parts[1],parts[2],params);else if(page==='tasks'||page==='materials')await learningPage(epoch,page,params);else if(page==='settings')await settingsPage(epoch);else if(page==='more')morePage(epoch);else if(page==='open')await openReference(params);else go('#/today');
 }catch(e){diagnostic('界面',e);setPage(epoch,empty(explain(e),[link('返回课程','#/courses','button-link')]));}finally{if(epoch===state.epoch)state.refresh=false;}}
$('global-search').addEventListener('submit',async event=>{event.preventDefault();const value=$('global-query').value.trim();if(/^https:\/\//i.test(value)||/^\[[^\]]+\]\(https:/.test(value)){try{go(referenceRoute(await resolveReference(value)));}catch(e){toast(diagnostic('链接',e));}}else{const filters=new URLSearchParams(currentRoute().split('?')[1]||'');go(courseHash({scope:'all',q:value,...(filters.get('scope')==='all'&&filters.get('platform')==='legacy'?{platform:'legacy',term:filters.get('term')||''}:{})}));}});
$('refresh').addEventListener('click',()=>{state.refresh=true;state.my=null;state.oldMy=null;state.lms=null;state.details.clear();void render();});
root.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('global-query').focus();$('global-query').select();}});
if(!site)window.addEventListener('hashchange',()=>void render());
let teachingRecovery=null;
function recoverTeaching(){
 if(teachingRecovery||document.visibilityState!=='visible')return;
 const failed=['lms','lexue'].filter((id,i)=>state.lmsStatus?.[i]===false);if(!failed.length)return;
 const epoch=state.epoch;
 teachingRecovery=(async()=>{
  await Promise.all(failed.map(source=>ensureLms(true,source).catch(e=>diagnostic('乐学连接',e))));
  if(epoch!==state.epoch||!failed.some(source=>state.lmsStatus?.[source==='lexue'?1:0]===true)||$('resources-dialog').open)return;
  const {parts,params}=route();if(['materials','tasks','courses','today'].includes(parts[0])||(['course','session'].includes(parts[0])&&params.get('tab')==='materials'))void render();
 })().finally(()=>teachingRecovery=null);
}
window.addEventListener('focus',recoverTeaching);document.addEventListener('visibilitychange',recoverTeaching);
window.addEventListener('pagehide',()=>{catalog.worker.terminate();sources.reset();});
async function start(){try{
 const statsPromise=catalog.call('init').then(stats=>{state.stats=stats;}).catch(e=>diagnostic('目录',e));
 const prefs=await chrome.storage.local.get(['desk:favorites','desk:mappings','desk:bindings','desk:sidebarCollapsed']);
 if(!sidebarChanged)sidebarCollapsed(prefs['desk:sidebarCollapsed']===true);
 if((route().parts[0]||'today')!=='today')await statsPromise;
 state.favorites=new Set(prefs['desk:favorites']||[]);state.mappings=prefs['desk:mappings']||{};state.bindings=safeBindings(prefs['desk:bindings']);state.version=chrome.runtime.getManifest().version_name||chrome.runtime.getManifest().version;
 await render();
 }catch(e){diagnostic('启动',e);main.replaceChildren(empty(explain(e),[button('重试',()=>location.reload())]));}}
void start();
return {render};
}
