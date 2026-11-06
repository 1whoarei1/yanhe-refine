import { YanheApi } from './api.js';
import { mediaUrl } from './core.js';
import {AutoSlidesIndex,indexedSession} from './autoslides-index.js';
import { LEGACY_API,LEGACY_ORIGIN,legacyHeaders,legacyToken,legacyReplays,legacyStreams,legacyLive,legacyLiveSignedUrl,parseLegacyCaptions } from './legacy-core.js';
import {readAuthTabs} from './tab-auth.js';

const validId=value=>/^[1-9]\d{0,11}$/.test(String(value??''));
const publicReplays=rows=>rows.map(({video,...row})=>row);

export class LegacyYanheApi extends YanheApi {
  constructor(options={}) { super(options); this.videoToken=null;this.videoExpiry=0;this.videoFlight=null;this.lectures=new Map();this.sessionLists=new Map();this.index=options.index||new AutoSlidesIndex(options); }
  reset() { super.reset();this.videoToken=null;this.videoExpiry=0;this.lectures?.clear();this.sessionLists?.clear(); }
  async json(path,params={}, {signal}={}) {
    const url=new URL(path,LEGACY_API);
    for(const [key,value] of Object.entries(params))url.searchParams.set(key,String(value));
    const response=await this.fetcher(url.href,{credentials:'include',redirect:'error',cache:'no-store',headers:legacyHeaders(this.token,this.hash),
      signal:signal?AbortSignal.any([signal,AbortSignal.timeout(18000)]):AbortSignal.timeout(18000)});
    if(!response.ok){const error=new Error(`旧版课堂返回 HTTP ${response.status}。`);if(response.status===401)error.code='AUTH_REQUIRED';throw error;}
    const body=await response.json();
    if(![0,'0'].includes(body.code)){const error=new Error(Number(body.code)===12121028?'旧版课程已过期，当前接口未提供此资源。':`旧版课堂请求失败（${Number(body.code)||'未知状态'}）。`);error.code=Number(body.code);throw error;}
    return body;
  }
  async authenticate(options={}){
    if(this.authFlight)return this.authFlight;
    this.authFlight=this.authenticateOnce(options).finally(()=>this.authFlight=null);return this.authFlight;
  }
  async authenticateOnce({signal,force=false}={}) {
    if(!force&&this.profile&&Date.now()-this.authAt<240000){return;}
    this.reset();
    const results=await readAuthTabs(this.tabs,LEGACY_ORIGIN,{type:'READ_LEGACY_AUTH'},{signal});
    const candidates=[...new Set(results.map(result=>legacyToken(result?.token)).filter(Boolean))];
    if(!candidates.length){const error=new Error('暂未获取旧延河登录状态，请打开原站验证。');error.code='SESSION_UNAVAILABLE';throw error;}
    let lastError;
    for(const token of candidates){
      signal?.throwIfAborted();this.token=token;
      try{const body=await this.json('/v1/user',{}, {signal});
        if(body.data?.id!=null){this.profile={id:body.data.id,badge:body.data.badge};this.authAt=Date.now();return;}
      }catch(error){signal?.throwIfAborted();lastError=error;}
    }
    this.reset();throw lastError||new Error('旧站登录已失效，请重新登录旧站。');
  }
  async prepareMedia(signal,source) {
    if(source&&!['cvideo.yanhekt.cn','coss.yanhekt.cn'].includes(new URL(source).hostname))return;
    if(this.videoToken&&this.videoExpiry-Date.now()>30000)return;
    if(this.videoFlight)return this.videoFlight;
    this.videoFlight=(async()=>{
      const {data}=await this.json('/v1/auth/video/token',{id:this.profile?.badge||0},{signal});
      if(!data?.token)throw new Error('旧站未提供播放凭据。');
      this.videoToken=String(data.token);
      const ttl=Math.max(15,Number(data.expired_at)-Number(data.now));
      this.videoExpiry=Date.now()+(Number.isFinite(ttl)?ttl:300)*1000;
    })();
    try{await this.videoFlight;}finally{this.videoFlight=null;}
  }
  async resolve(ref,signal) {
    if (ref.id) return ref;
    await this.authenticate({signal});
    if(ref.sessionId){
      const owner=await this.index.owner?.(ref.sessionId,signal);
      if(owner)return {id:String(owner.id),sessionId:String(ref.sessionId),legacy:true};
    }
    const {data}=ref.liveId
      ? await this.json('/v1/live',{id:ref.liveId,with_session:true,with_course:true},{signal})
      : await this.json('/v1/course/session',{session_id:ref.sessionId,with_video:true},{signal});
    const valid=value=>/^[1-9]\d{0,11}$/.test(String(value??''));
    const courseIds=[data?.course_id,data?.course?.id,data?.session?.course_id].filter(valid).map(String);
    if (!courseIds.length) throw new Error('旧站未返回此页面所属的课程，请检查页面状态或使用课程详情链接。');
    if (new Set(courseIds).size!==1) throw new Error('旧站返回的所属课程信息不一致，请使用课程详情链接。');
    const sessionIds=(ref.liveId?[data?.session_id,data?.session?.id]:[data?.id,ref.sessionId]).filter(valid).map(String);
    if (new Set(sessionIds).size>1) throw new Error('旧站返回的课次信息不一致，请使用课程详情链接。');
    return {id:courseIds[0],legacy:true,...(ref.liveId?{liveId:ref.liveId}:{}),...(sessionIds.length?{sessionId:sessionIds[0]}:{})};
  }
  async liveCourse(ref,signal){
    await this.authenticate({signal});
    const {data}=await this.json('/v1/live',{id:ref.liveId,with_session:true,with_course:true},{signal});
    if(!data?.id||String(data.id)!==String(ref.liveId))throw new Error('旧版直播不存在');
    const info=legacyLive(data);
    return {id:ref.id,legacy:true,title:String(data.course?.name_zh||data.title||'旧版直播'),teacher:(data.course?.professors||[]).map(row=>row.name).filter(Boolean).join('、'),term:[data.course?.school_year,data.course?.semester].filter(Boolean).join('-'),replays:[],lives:[{id:'live:'+ref.liveId,title:info.title,start:info.start,mode:info.mode}]};
  }
  async courseSessions(id,signal,{force=false}={}){
    if(!validId(id))throw new Error('旧版课程编号无效。');
    const scope=String(this.profile?.id),key=scope+':'+id,saved=this.sessionLists.get(key);
    if(!force&&saved&&Date.now()-saved.at<120000){signal?.throwIfAborted();return saved;}
    if(force)this.sessionLists.delete(key);
    const sessions=[],seen=new Set();let complete=false;
    for(let page=1;page<=100;page++){
      const {data}=await this.json('/v1/course/session/list',{course_id:id,order_type:'asc',page,page_size:100},{signal});
      const batch=Array.isArray(data)?data:data?.data;
      if(!Array.isArray(batch))throw new Error('旧站返回了无效的 v1 课次列表。');
      for(const row of batch){
        if(!row||!validId(row.id)||seen.has(String(row.id)))throw new Error('旧站 v1 课次分页重复或编号无效。');
        const parents=[row.course_id,row.course?.id].filter(value=>value!=null&&value!==0&&value!=='0');
        if(parents.some(value=>!validId(value)||String(value)!==String(id)))throw new Error('旧站 v1 课次的所属课程不一致。');
        if(row.videos!=null&&(!Array.isArray(row.videos)&&typeof row.videos!=='object'||Array.isArray(row.videos)&&row.videos.length>100))throw new Error('旧站 v1 视频片段列表无效。');
        seen.add(String(row.id));sessions.push(row);
      }
      if(batch.length<100||page>=Number(data?.last_page)||Number(data?.total)>0&&sessions.length>=Number(data.total)){complete=true;break;}
    }
    if(!complete)throw new Error('旧版课次超过分页限制，请在原站查看。');
    if(String(this.profile?.id)!==scope)throw new Error('旧站账号已切换，请重新读取课程。');
    const replays=legacyReplays(sessions),parts=new Set();
    for(const row of replays){if(parts.has(row.id))throw new Error('旧站返回了重复的视频片段。');parts.add(row.id);}
    const value={sessions,replays,at:Date.now()};signal?.throwIfAborted();
    this.sessionLists.delete(key);this.sessionLists.set(key,value);
    while(this.sessionLists.size>24)this.sessionLists.delete(this.sessionLists.keys().next().value);
    return value;
  }
  async courseMetadata(id,sessions,signal){
    let local;try{local=await this.index.course?.(id,signal);}catch{signal?.throwIfAborted();}
    if(local)return {id:String(id),legacy:true,title:local.name,teacher:local.teachers.join('、'),term:local.term,code:local.number,college:''};
    try{
      const {data}=await this.json('/v1/course',{id,with_professor_badges:true},{signal});
      if(String(data?.id)!==String(id))throw new Error('旧站返回的课程归属不一致。');
      return {id:String(id),legacy:true,title:String(data.name_zh||'旧版课程 '+id),teacher:(data.professors||[]).map(row=>row.name).filter(Boolean).join('、'),term:[data.school_year,data.semester].filter(Boolean).join('-')};
    }catch(error){
      signal?.throwIfAborted();
      const term=String(sessions[0]?.number||'').match(/^(\d{4})(\d{4})([12])/);
      return {id:String(id),legacy:true,title:'旧版课程 '+id,teacher:'',term:term?`${term[1]}-${term[2]}-${term[3]}`:''};
    }
  }
  async course(id,signal,options={}) {
    await this.authenticate({signal});
    // The v1 cache namespace cannot reuse replay lists produced by the old v2 path.
    const result=await this.replayCache.read('legacy-v1',id,String(this.profile.id),async()=>{
      const {sessions,replays}=await this.courseSessions(id,signal,options);
      return {...await this.courseMetadata(id,sessions,signal),replays:publicReplays(replays)};
    },{...options,signal});
    const replays=[...result.replays];let indexWarning='';
    if(options.indexed){
      try{const ids=await this.index.sessions(id,signal,{force:options.force});for(const sid of ids)if(!replays.some(r=>r.id.split(':')[0]===sid))replays.push(indexedSession(sid));}
      catch(error){if(signal?.aborted)throw error;indexWarning=error.message;}
    }
    if(/^[1-9]\d{0,11}$/.test(String(options.sessionId||''))&&!replays.some(r=>r.id.split(':')[0]===String(options.sessionId)))replays.push(indexedSession(options.sessionId));
    let lives=[],liveWarning='';
    try{lives=await this.liveList(id,signal);}catch(error){if(signal?.aborted)throw error;liveWarning=error.message;}
    return {...result,replays,lives,liveWarning,...(options.indexed?{indexSource:'autoslides',indexWarning}:{} )};
  }
  async describeCourse(id,signal){
    await this.authenticate({signal});return this.courseMetadata(id,[],signal);
  }
  async currentLives(_day,signal){
    await this.authenticate({signal});const found=new Map();
    for(let page=1;page<=30;page++){
      const {data}=await this.json('/v2/live/list',{page,page_size:100,user_relationship_type:1},{signal});
      const rows=Array.isArray(data)?data:data?.data;
      if(!Array.isArray(rows))throw new Error('旧站未返回有效的我的直播列表。');
      for(const row of rows){
        const id=String(row.source_id||row.course?.id||''),liveId=String(row.id||''),info=legacyLive(row);
        if(!validId(id)||!validId(liveId)||info.mode!=='live')continue;
        if(row.course?.id!=null&&String(row.course.id)!==id)continue;
        found.set(liveId,{id,liveId,legacy:true,title:String(row.course?.name_zh||row.title||''),teacher:(row.course?.professors||[]).map(p=>p.name).filter(Boolean).join('、'),
          term:[row.course?.school_year,row.course?.semester].filter(Boolean).join('-'),info});
      }
      signal?.throwIfAborted();
      const lastPage=Number(data?.last_page);
      if(!rows.length||(lastPage>0?page>=lastPage:rows.length<100))return [...found.values()];
    }
    throw new Error('旧站我的直播超过分页限制，请在原站查看。');
  }
  async liveList(id,signal){
    const {data}=await this.json('/v2/live/list',{source_id:id,page:1,page_size:100},{signal});
    const rows=Array.isArray(data)?data:data?.data;if(!Array.isArray(rows))throw new Error('旧站未返回有效直播列表');
    return rows.filter(row=>/^\d{1,12}$/.test(String(row.id))&&String(row.course?.id||row.source_id)===String(id)).map(row=>{const info=legacyLive(row);return {id:'live:'+row.id,title:String(row.title||info.title||'旧版直播'),start:info.start,end:info.end,mode:info.mode};});
  }
  async sessionLecture(courseId,subId,signal){
    const match=String(subId).match(/^([1-9]\d{0,11}):(pending|[1-9]\d{0,11})$/);if(!match)throw new Error('旧版课次编号无效。');
    const {sessions,replays}=await this.courseSessions(courseId,signal),session=sessions.find(row=>String(row.id)===match[1]);
    const parts=replays.filter(row=>row.id.split(':')[0]===match[1]);
    if(!session||!parts.length)throw new Error('此课次暂未提供可读取的回放，索引记录不保证已有视频。');
    const selected=match[2]==='pending'?parts[0]:parts.find(row=>row.id===subId);
    if(!selected)throw new Error('此视频不属于所选课次，请重新选择片段。');
    this.lectures.set(selected.id,selected.video);
    while(this.lectures.size>32)this.lectures.delete(this.lectures.keys().next().value);
    return {...legacyStreams(selected.video),title:selected.title,selection:publicReplays([selected])[0],sessionReplays:publicReplays(parts)};
  }
  async lecture(courseId,subId,signal) {
    await this.authenticate({signal});
    if(/^live:\d{1,12}$/.test(subId)){const {data}=await this.json('/v1/live',{id:subId.slice(5),with_session:true,with_course:true},{signal});if(!data||String(data.course_id||data.course?.id)!==String(courseId))throw new Error('直播课程信息不一致');return legacyLive(data);}
    return this.sessionLecture(courseId,subId,signal);
  }
  async subtitles(subId,signal) {
    const video=this.lectures.get(subId);if(!video)return [];
    const {data}=await this.json('/v1/video/subtitle/list',{video_id:video.id},{signal});
    if(!Array.isArray(data))throw new Error('旧站字幕格式无法读取。');if(!data.length)return [];
    const entry=data.find(row=>/zh|cn/i.test(row.language||''))||data[0];
    const raw=entry.url||entry.src;if(!raw)throw new Error('旧站字幕条目缺少地址。');
    const url=mediaUrl(raw);
    const response=await this.fetcher(url.href,{credentials:'include',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(18000)]):AbortSignal.timeout(18000)});
    if(!response.ok)throw new Error(`旧站字幕返回 HTTP ${response.status}。`);
    const rows=parseLegacyCaptions(await response.text());if(!rows.length)throw new Error('旧站字幕尚非受支持的 VTT/SRT 格式。');return rows;
  }
  sign(url){return legacyLiveSignedUrl(url,this.videoToken,this.hash);}
}
