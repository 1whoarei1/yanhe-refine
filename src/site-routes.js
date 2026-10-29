const modern='https://aita.yanhekt.cn';
const legacy='https://www.yanhekt.cn';
const digits=value=>/^\d{1,12}$/.test(value||'');
export function siteRoute(raw){
 let u;try{u=new URL(raw);}catch{return null;}
 if(![modern,legacy].includes(u.origin)||u.username||u.password||u.port)return null;
 if(u.searchParams.get('yh_native')==='1'||['token','code','ticket','SAMLResponse'].some(k=>u.searchParams.has(k)))return null;
 const view=u.searchParams.get('yh_view');
 if(view&&['today','courses','materials','tasks','settings','more'].includes(view))return '/'+view+filterQuery(u);
 if(u.origin===legacy){
  const match=u.pathname.match(/^\/(course|live|session|ReadSession)\/(\d{1,12})\/?$/);
  if(match){if(match[1]==='course')return `/course/legacy/${match[2]}${filterQuery(u)}`;if(match[1]==='live')return '/open?'+new URLSearchParams({legacy_live:match[2]});return `/session/legacy/${match[2]}${filterQuery(u)}`;}
  if(['','/','/home','/recordCourse'].includes(u.pathname))return '/courses?scope=my&platform=legacy';
  // Legacy live listings are not a reliable source for the current platform's live schedule.
  if(u.pathname==='/profile/myCourse')return '/courses?scope=my&platform=legacy';
  if(u.pathname==='/liveCourse')return null;
  return null;
 }
 if(['/coursedetail','/livingroom','/livingroomnew','/videoroom','/coursevideo'].includes(u.pathname)&&digits(u.searchParams.get('course_id'))){
  const p=new URLSearchParams(filterQuery(u).slice(1));if(digits(u.searchParams.get('sub_id')))p.set('sub',u.searchParams.get('sub_id'));
  return `/course/modern/${u.searchParams.get('course_id')}${p.size?'?'+p:''}`;
 }
 if(['','/','/portal','/portal/','/workbenchAi'].includes(u.pathname)&&(!u.hash||u.hash==='#/'))return '/today';
 if(u.pathname==='/searchContent')return '/courses?'+new URLSearchParams({scope:'all',q:u.searchParams.get('title')||u.searchParams.get('keyword')||'',...Object.fromEntries(new URLSearchParams(filterQuery(u).slice(1)))});
 if(u.pathname==='/personal/'||u.pathname==='/personal'){
  const path=u.hash.split('?')[0].toLowerCase();
  if(path==='#/mystudy/mycourse')return '/courses'+filterQuery(u);
  if(path==='#/mystudy/mytask')return '/tasks'+filterQuery(u);
 }
 if(['/education/','/education'].includes(u.pathname)&&u.hash.startsWith('#/home?menu_code=B-wdkc'))return '/courses';
 return null;
}
function filterQuery(u){const p=new URLSearchParams();for(const name of ['scope','q','platform','term','teacher','college','page','tab','sub','live','course','state','source','index_source'])if(u.searchParams.has('yh_'+name))p.set(name,u.searchParams.get('yh_'+name));return p.size?'?'+p:'';}
export function siteHref(route){
 const raw=route.replace(/^#/,'');const [path,query='']=raw.split('?'),p=new URLSearchParams(query),parts=path.split('/').filter(Boolean);let u;
 if(parts[0]==='session'&&parts[1]==='legacy'&&digits(parts[2])){
  u=new URL(`${legacy}/session/${parts[2]}`);
 }else if(parts[0]==='course'&&['modern','legacy'].includes(parts[1])&&digits(parts[2])){
  u=new URL(parts[1]==='legacy'?`${legacy}/course/${parts[2]}`:`${modern}/coursedetail`);
  if(parts[1]==='modern'){u.searchParams.set('course_id',parts[2]);u.searchParams.set('tenant_code','21');if(digits(p.get('sub')))u.searchParams.set('sub_id',p.get('sub'));}
 }else if(parts[0]==='open'){
  if(digits(p.get('legacy_live')))return `${legacy}/live/${p.get('legacy_live')}`;
  if(digits(p.get('legacy_session')))return `${legacy}/session/${p.get('legacy_session')}`;
  return `${modern}/portal/#/`;
 }else if(parts[0]==='today')u=new URL(`${modern}/workbenchAi?tenant_code=21`);
 else if(parts[0]==='courses'){u=new URL(`${modern}/personal/#/myStudy/myCourse`);if(p.get('scope')==='all')u=new URL(`${modern}/searchContent?tenant_code=21`);}
 else if(parts[0]==='tasks')u=new URL(`${modern}/personal/#/myStudy/myTask`);
 else {u=new URL(`${modern}/personal/`);u.searchParams.set('yh_view',['materials','settings','more'].includes(parts[0])?parts[0]:'today');}
 for(const [key,value]of p)if((value||key==='term')&&['scope','q','platform','term','teacher','college','page','tab','sub','live','course','state','source','index_source'].includes(key))u.searchParams.set('yh_'+key,value);
 return u.href;
}
export function referenceRoute(ref){
 if(ref.legacy&&digits(ref.sessionId)&&!ref.liveId)return `#/session/legacy/${ref.sessionId}?tab=watch`;
 return `#/course/${ref.legacy?'legacy':'modern'}/${ref.id}?tab=watch`+(ref.liveId?'&live='+ref.liveId:ref.subId?'&sub='+encodeURIComponent(ref.subId):'');
}
export function nativeHref(raw,{remember=false}={}){const u=new URL(raw);if([modern,legacy].includes(u.origin)){u.searchParams.set('yh_native','1');u.searchParams.delete('yh_mode');if(remember)u.searchParams.set('yh_mode','native');}return u.href;}
export function refineEntryHref(raw){
 let u=new URL(raw);u.searchParams.delete('yh_native');u.searchParams.delete('yh_mode');
 if(!siteRoute(u.href))u=new URL(u.origin===legacy?legacy+'/home':siteHref('#/courses'));
 u.searchParams.set('yh_mode','refine');return u.href;
}
export function isPlatformPage(raw){try{return [modern,legacy,'https://zy-eclass.bit.edu.cn','https://lexue.bit.edu.cn'].includes(new URL(raw).origin);}catch{return false;}}
