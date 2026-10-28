import { YanheApi } from './api.js';
import { mediaUrl } from './core.js';
import {AutoSlidesIndex,indexedSession} from './autoslides-index.js';
import { LEGACY_API,LEGACY_ORIGIN,legacyHeaders,legacyToken,legacySignedUrl,legacyReplays,legacyStreams,legacyLive,legacyLiveSignedUrl,parseLegacyCaptions } from './legacy-core.js';

export class LegacyYanheApi extends YanheApi {
  constructor(options={}) { super(options); this.videoToken=null;this.videoExpiry=0;this.videoFlight=null;this.lectures=new Map();this.index=new AutoSlidesIndex(options); }
  reset() { super.reset();this.videoToken=null;this.videoExpiry=0; }
  async json(path,params={}, {signal}={}) {
    const url=new URL(path,LEGACY_API);
    for(const [key,value] of Object.entries(params))url.searchParams.set(key,String(value));
    const response=await this.fetcher(url.href,{credentials:'include',redirect:'error',cache:'no-store',headers:legacyHeaders(this.token,this.hash),
      signal:signal?AbortSignal.any([signal,AbortSignal.timeout(18000)]):AbortSignal.timeout(18000)});
    if(!response.ok)throw new Error(`旧版课堂返回 HTTP ${response.status}。`);
    const body=await response.json();
    if(Number(body.code)!==0)throw new Error(`旧版课堂请求失败（${Number(body.code)||'未知状态'}）。`);
    return body;
  }
  async authenticate({signal,force=false}={}) {
    if(!force&&this.profile&&Date.now()-this.authAt<240000){return;}
    this.reset();
    const pages=await this.tabs?.query({url:[LEGACY_ORIGIN+'/*']}) || [];
    const results=await Promise.allSettled(pages.slice(0,8).map(page=>this.tabs.sendMessage(page.id,{type:'READ_LEGACY_AUTH'},{frameId:0})));
    const candidates=[...new Set(results.flatMap(result=>result.status==='fulfilled'?[legacyToken(result.value?.token)]:[]).filter(Boolean))];
    if(!candidates.length)throw new Error('请在同一浏览器登录旧版延河课堂，刷新旧站网页后重试。');
    for(const token of candidates){
      signal?.throwIfAborted();this.token=token;
      const body=await this.json('/v1/user',{}, {signal});
      if(body.data?.id!=null){this.profile={id:body.data.id,badge:body.data.badge};this.authAt=Date.now();return;}
    }
    this.reset();throw new Error('旧站登录已失效，请重新登录旧站。');
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
  async course(id,signal,options={}) {
    await this.authenticate({signal});
    const result=await this.replayCache.read('legacy',id,String(this.profile.id),async()=>{
    const [course,sessions]=await Promise.all([this.json('/v1/course',{id,with_professor_badges:true},{signal}),this.json('/v2/course/session/list',{course_id:id},{signal})]);
    if(String(course.data?.id)!==String(id))throw new Error('旧版课堂未找到这门课。');
    if(!Array.isArray(sessions.data))throw new Error('旧站返回了无效的课次列表。');
    const rows=legacyReplays(sessions.data);this.lectures=new Map(rows.map(row=>[row.id,row.video]));
    return {id,legacy:true,title:String(course.data.name_zh||'旧版课程'),teacher:(course.data.professors||[]).map(row=>row.name).filter(Boolean).join('、'),
      term:[course.data.school_year,course.data.semester].filter(Boolean).join('-'),replays:rows.map(({video,...row})=>row)};
    },{...options,signal}).catch(async error=>{
      signal?.throwIfAborted();if(!options.indexed&&!options.sessionId)throw error;
      // A failed v2 listing must not be cached as an authoritative empty course.
      const {data}=await this.json('/v1/course',{id,with_professor_badges:true},{signal});if(String(data?.id)!==String(id))throw error;
      return {id,legacy:true,title:String(data.name_zh||'旧版课程'),teacher:(data.professors||[]).map(r=>r.name).filter(Boolean).join('、'),term:[data.school_year,data.semester].filter(Boolean).join('-'),replays:[]};
    });
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
    await this.authenticate({signal});const {data}=await this.json('/v1/course',{id,with_professor_badges:true},{signal});
    if(String(data?.id)!==String(id))throw new Error('旧站返回的课程归属不一致');
    return {id:String(id),legacy:true,title:String(data.name_zh||''),teacher:(data.professors||[]).map(row=>row.name).filter(Boolean).join('、'),term:[data.school_year,data.semester].filter(Boolean).join('-')};
  }
  async liveList(id,signal){
    const {data}=await this.json('/v2/live/list',{source_id:id,page:1,page_size:100},{signal});
    const rows=Array.isArray(data)?data:data?.data;if(!Array.isArray(rows))throw new Error('旧站未返回有效直播列表');
    return rows.filter(row=>/^\d{1,12}$/.test(String(row.id))&&String(row.course?.id||row.source_id)===String(id)).map(row=>{const info=legacyLive(row);return {id:'live:'+row.id,title:String(row.title||info.title||'旧版直播'),start:info.start,end:info.end,mode:info.mode};});
  }
  async sessionLecture(courseId,subId,signal){
    const match=String(subId).match(/^([1-9]\d{0,11}):(pending|[1-9]\d{0,11})$/);if(!match)throw new Error('旧版课次编号无效。');
    const {data}=await this.json('/v1/course/session',{session_id:match[1],with_video:true},{signal});
    const courseIds=[data?.course_id,data?.course?.id].filter(x=>/^[1-9]\d{0,11}$/.test(String(x??''))).map(String);
    if(String(data?.id)!==match[1]||!courseIds.length||courseIds.some(x=>x!==String(courseId)))throw new Error('此课次的所属课程不一致，请使用原站 session 链接核对。');
    if(!Array.isArray(data.video_ids)||data.video_ids.length>100||!data.video_ids.every(x=>/^[1-9]\d{0,11}$/.test(String(x))))throw new Error('旧站未返回有效的视频片段列表。');
    const ids=[...new Set(data.video_ids.map(String))];if(!ids.length)throw new Error('此课次暂未提供回放，索引记录不保证已有视频。');
    const videoId=match[2]==='pending'?ids[0]:match[2];if(!ids.includes(videoId))throw new Error('此视频不属于所选课次，请重新选择片段。');
    const {data:video}=await this.json('/v1/video',{id:videoId},{signal});if(String(video?.id)!==videoId)throw new Error('旧站返回的视频编号不一致。');
    const raw=String(data.started_at||'').replace(' ','T'),start=raw?(Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(raw)?raw:raw+'+08:00')||0):0;
    const sessionReplays=ids.map((vid,i)=>({id:match[1]+':'+vid,title:[String(data.started_at||'').slice(0,10),String(data.title||'课次 '+match[1])].filter(Boolean).join(' ')+(ids.length>1?`（片段${i+1}）`:''),start}));
    this.lectures.set(match[1]+':'+videoId,video);
    return {...legacyStreams(video),title:sessionReplays.find(r=>r.id===match[1]+':'+videoId).title,selection:sessionReplays.find(r=>r.id===match[1]+':'+videoId),sessionReplays};
  }
  async lecture(courseId,subId,signal) {
    await this.authenticate({signal});
    if(/^live:\d{1,12}$/.test(subId)){const {data}=await this.json('/v1/live',{id:subId.slice(5),with_session:true,with_course:true},{signal});if(!data||String(data.course_id||data.course?.id)!==String(courseId))throw new Error('直播课程信息不一致');return legacyLive(data);}
    if(String(subId).endsWith(':pending'))return this.sessionLecture(courseId,subId,signal);
    if(!this.lectures.has(subId)){try{const {data}=await this.json('/v2/course/session/list',{course_id:courseId},{signal});if(Array.isArray(data))this.lectures=new Map(legacyReplays(data).map(row=>[row.id,row.video]));}catch(error){signal?.throwIfAborted();return this.sessionLecture(courseId,subId,signal);}}
    const video=this.lectures.get(subId);
    if(!video)return this.sessionLecture(courseId,subId,signal);return legacyStreams(video);
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
