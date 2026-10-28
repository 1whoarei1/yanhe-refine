import {mountVideoCaptions} from './captions.js';
import {mountPlayerControls} from './player-controls.js';
import {mountMultiview} from './multiview.js';
import {mountLiveLinks} from './live-links.js';
import {mountViewerLayout} from './viewer-layout.js';
import {LiveFrameFollower,audioView,latestBufferedFrame} from './live-tools.js';
import { YanheApi } from './api.js';
import { LegacyYanheApi } from './legacy-api.js';
import {mergeSessionSelection} from './autoslides-index.js';
import { parseCourse, clock, vtt, explain, subtitleOffset, shiftSubtitles, subtitleClock } from './core.js';
import { liveLabels, liveEdge } from './live-core.js';
import {replayViews} from './media-download.js';

const $ = id => document.getElementById(id);
document.body.classList.toggle('embedded',new URLSearchParams(location.search).get('embedded')==='1');
if(document.body.classList.contains('embedded')&&parent!==window){
 const origin=location.ancestorOrigins?.[0]||new URL(chrome.runtime.getURL('')).origin;
 if([new URL(chrome.runtime.getURL('')).origin,'https://aita.yanhekt.cn','https://www.yanhekt.cn'].includes(origin))new ResizeObserver(()=>parent.postMessage({type:'REFINE_PLAYER_SIZE',height:Math.ceil(document.body.getBoundingClientRect().height+2)},origin)).observe(document.body);
}
const video = $('video');
let api = new YanheApi();
const state = { course: null, selected: null, info: null, view: 'screen', subtitles: [], controller: null,
  sequence: 0, mediaEpoch: 0, hls: null, attached: false, connecting: false, restoring: false,
  resume: 0, lastSigned: 0, lastRecovery: 0, lastSaved: 0, activeCue: -1, vttUrl: null, courseLoading: false,
  blockedViews: new Set(), sourceNote: '', followLyrics: true, lyricFrame: 0,
  rawSubtitles: [], offsets: { screen: 0, classroom: 0 }, calibrating: false, offsetSave: Promise.resolve(), filter: 'replay', flv: null };
let playbackApi=null;
const getMediaApi=()=>playbackApi||api;
const timely=new LiveFrameFollower(video,{active:()=>isLive()&&state.attached,onUpdate:({latest})=>{const text=latest?'最新缓存帧':'正在更新画面';if($('timely-status').textContent!==text)$('timely-status').textContent=text;}});
const multi=mountMultiview({video,getApi:getMediaApi,getInfo:()=>state.info,getView:()=>state.view,getHls:()=>state.hls,isLive,isAttached:()=>state.attached,isConnecting:()=>state.connecting,getTimely:()=>timely.enabled,blockedViews:state.blockedViews,onStatus:playbackStatus,onBlocked:audioBlocked});
const updateDual=()=>multi.refresh();
$('copy-playback-diagnostics').addEventListener('click',async()=>{
 let tabAudio=null;try{const tab=await chrome.tabs.getCurrent();tabAudio={muted:tab?.mutedInfo?.muted??null,reason:tab?.mutedInfo?.reason||null,audible:tab?.audible??null};}catch{}
 const report={schema:1,version:chrome.runtime.getManifest().version,tabAudio,course:state.course?{platform:state.course.legacy?'legacy':'modern',id:String(state.course.id),lessonId:state.selected?.id}:null,liveTarget:state.liveTarget||null,signInMode:timely.enabled,blockedViews:[...state.blockedViews],autoplayAllowed:(document.permissionsPolicy||document.featurePolicy)?.allowsFeature?.('autoplay')??null,...multi.diagnostics()};
 const text=JSON.stringify(report,null,2);try{await navigator.clipboard.writeText(text);$('diagnostics-status').textContent='声音诊断已复制';}catch{$('playback-diagnostics').value=text;$('playback-diagnostics').hidden=false;$('playback-diagnostics').focus();$('playback-diagnostics').select();$('diagnostics-status').textContent='可复制下方声音诊断内容';}
});

const liveLinks=mountLiveLinks({getContext:()=>({course:state.course,lecture:state.selected,api,live:state.selected?.mode==='live'||isLive()}),onSwitch:async({api:nextApi,target,info})=>{
 const playing=state.attached&&!video.paused;clearMedia();multi.clearAudio();playbackApi?.reset();playbackApi=nextApi;state.liveTarget=target;state.info=info;state.blockedViews.clear();
 if(!info.streams[state.view])state.view=info.streams.classroom?'classroom':Object.keys(info.streams)[0];updateViews();updateTimelyControls();void connectPlayback(0,{play:playing});
}});

$('timely-mode').addEventListener('click',()=>{timely.setEnabled(!timely.enabled);updateTimelyControls();updateDual();void storage.set({'player:timelyLive':timely.enabled});if(timely.enabled&&!state.attached)void connectPlayback(0);});
function audioBlocked(text,playBlocked=false){$('control-volume').setAttribute('data-audio-blocked','true');if(playBlocked)$('control-volume').setAttribute('data-play-blocked','true');playbackStatus(text,true);}
function updateTimelyControls(){const enabled=isLive();$('timely-mode').hidden=!enabled;$('timely-mode').setAttribute('aria-pressed',String(timely.enabled));$('timely-status').hidden=!enabled||!timely.enabled;if(enabled&&timely.enabled)$('timely-status').textContent='等待最新缓存';timely.request();}
mountViewerLayout({onError:text=>playbackStatus(text,true)});
mountPlayerControls({video,getContext:()=>({live:isLive(),attached:state.attached,duration:state.info?.duration,signIn:isLive()&&timely.enabled}),onPlay:()=>{state.lastRecovery=0;return connectPlayback(state.resume);},onSound:()=>multi.enableSound({play:$('control-volume').hasAttribute('data-play-blocked')}),onStatus:playbackStatus});
const captions=mountVideoCaptions({video,enabled:()=>state.attached&&$('show-captions').checked&&!liveContext(),getText:time=>state.subtitles[cuePosition(time).index]?.text||''});
const views = ['screen','classroom','student'];
function isLive() { return state.info?.mode === 'live'; }
function liveContext() { return state.info && state.info.mode && state.info.mode !== 'replay'; }
$('download-video').addEventListener('click',()=>{
 if(!state.course||!state.selected||!replayViews(state.info).length)return;
 const params=new URLSearchParams({platform:state.course.legacy?'legacy':'modern',course:state.course.id,lecture:state.selected.id,view:multi.count>1?'all':state.view});
 void chrome.tabs.create({url:chrome.runtime.getURL('watch/download.html')+'?'+params});
});

function message(text, kind = '') { $('message').textContent = text; $('message').className = `notice ${kind}`; }
function playbackStatus(text, error = false) { $('playback-status').textContent = text; $('playback-status').className = `playback-status${error ? ' error' : ''}`; }
const storage = {
  async get(key) { try { return (await chrome.storage.local.get(key))[key]; } catch { return null; } },
  async set(values) { try { await chrome.storage.local.set(values); return true; } catch { return false; } }
};
function courseKey() { return `${state.course?.legacy ? 'legacy:' : ''}${state.course?.id}`; }
function syncSessionTarget(lecture){
 if(state.course?.legacy&&parent!==window&&/^\d{1,12}:(?:pending|\d{1,12})$/.test(lecture.id)){
  const origin=location.ancestorOrigins?.[0]||new URL(chrome.runtime.getURL('')).origin;
  if([new URL(chrome.runtime.getURL('')).origin,'https://www.yanhekt.cn'].includes(origin))parent.postMessage({type:'REFINE_SESSION',courseId:String(state.course.id),sessionId:lecture.id.split(':')[0]},origin);
 }
}
function progressKey() { return !liveContext() && state.course && state.selected ? `progress:${courseKey()}:${state.selected.id}` : null; }
function offsetKey(view = state.view) { return !liveContext() && state.course && state.selected ? `subtitleOffset:${courseKey()}:${state.selected.id}:${view}` : null; }
function viewName(view) { return view === 'student' ? '学生画面' : view === 'screen' ? '屏幕画面' : state.course?.legacy || liveContext() ? '主画面' : '教室画面'; }
function savedOffset(value) { try { return subtitleOffset(value?.seconds ?? 0); } catch { return 0; } }
function saveProgress(force = false) {
  const key = progressKey();
  if (!key || !state.attached || state.connecting || state.restoring || !Number.isFinite(video.currentTime) || (!force && Date.now() - state.lastSaved < 7000)) return;
  state.lastSaved = Date.now();
  void storage.set({ [key]: { time: video.currentTime, view: state.view, updatedAt: Date.now() } });
}
function clearMedia() {
  $('control-volume').removeAttribute('data-audio-blocked');$('control-volume').removeAttribute('data-play-blocked');timely.reset();multi.stop();state.mediaEpoch++; state.connecting = false; state.restoring = false;
  if (state.hls) { state.hls.destroy(); state.hls = null; }
  if (state.flv) { state.flv.destroy(); state.flv = null; }
  video.pause(); video.removeAttribute('src'); video.load(); state.attached = false;
  clearCaptionTracks();
}
function clearCaptionTracks() {
  captions.clear();
  // Detached tracks can briefly remain in video.textTracks in Chromium. Silence them first.
  for (const track of video.textTracks) track.mode = 'disabled';
  video.querySelectorAll('track').forEach(track => track.remove());
  if (state.vttUrl) { URL.revokeObjectURL(state.vttUrl); state.vttUrl = null; }
}
function resetSelection() {
  $('download-video').disabled=true;
  saveProgress(true); state.controller?.abort(); clearMedia(); state.selected = null; state.info = null; state.subtitles = []; state.rawSubtitles = [];
  multi.reset();playbackApi?.reset();playbackApi=null;state.liveTarget=null;liveLinks.reset();updateDual();state.offsets = { screen: 0, classroom: 0 }; state.calibrating = false;
  state.blockedViews.clear(); state.sourceNote = '';
  $('stage-empty').classList.remove('hidden'); $('stage-label').textContent = '选择课次';
  $('stage-detail').textContent = '';
  $('play').disabled = true; $('retry').disabled = true; $('retry').textContent = '重新连接';
  $('lecture-title').textContent = '尚未选择课次'; $('duration').textContent = '';
  for (const view of views) { $(view).disabled = true; $(view).setAttribute('aria-pressed','false'); }
  $('timely-mode').hidden=true;$('timely-status').hidden=true;$('control-volume').removeAttribute('data-audio-blocked');$('control-volume').removeAttribute('data-play-blocked');
  $('student').hidden = true; $('go-live').hidden = true; $('go-live').disabled = true; $('speed').disabled = false;
  document.querySelector('.workspace').classList.remove('live-mode');
  $('subtitle-search').value = ''; $('subtitle-search').disabled = true; $('subtitle-count').textContent = '—';
  cancelAnimationFrame(state.lyricFrame); state.lyricFrame = 0; state.followLyrics = true; state.activeCue = -1;
  $('show-captions').disabled = true; $('return-sync').hidden = true;
  $('subtitle-mode').textContent = '随播放滚动'; $('subtitle-list').classList.remove('searching');
  $('subtitle-time').textContent = '0:00'; $('current-caption').textContent = '';
  $('subtitle-list').replaceChildren();
  updateCalibration(); $('calibration-status').textContent = '';
}
function textNode(tag, text, className) { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; }
function renderLectures() {
  const list = $('lecture-list'); list.replaceChildren();
  const rows = state.filter === 'live' ? state.course.lives || [] : state.course.replays;
  $('replay-count').textContent = `${rows.length} 次`;
  $('filter-live').hidden = false;
  for (const filter of ['replay','live']) $(`filter-${filter}`).setAttribute('aria-pressed',String(filter === state.filter));
  if (!rows.length) { list.append(textNode('p',state.filter === 'live' ? '暂无直播安排' : '暂无回放','empty')); return; }
  for (const lecture of rows) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'lecture-item'; button.dataset.id = lecture.id;
    const match = lecture.title.match(/^(\d{4})-(\d+)-(\d+)(.+)$/);
    button.append(textNode('strong',match ? `${Number(match[2])}月${Number(match[3])}日` : lecture.title));
    if (match || !lecture.mode) button.append(textNode('span',match ? `${match[1]}年 ${match[4]}` : '课程回放'));
    if (lecture.mode) button.append(textNode('small',liveLabels[lecture.mode],`lecture-state ${lecture.mode}`));
    if (state.selected?.id === lecture.id) { button.classList.add('selected'); button.setAttribute('aria-current','true'); }
    button.addEventListener('click',() => selectLecture(lecture)); list.append(button);
  }
}
function cuePosition(time) {
  let low = 0, high = state.subtitles.length - 1, index = -1;
  while (low <= high) { const mid = (low + high) >> 1; if (state.subtitles[mid].start <= time) { index = mid; low = mid + 1; } else high = mid - 1; }
  const anchor = Math.max(0,index);
  if (index >= 0 && time >= state.subtitles[index].end) index = -1;
  return { index, anchor };
}
function updateLyricMode() {
  const searching = Boolean($('subtitle-search').value.trim());
  $('subtitle-mode').textContent = searching ? `搜索结果 ${$('subtitle-list').querySelectorAll('.subtitle-item').length} 段` : state.followLyrics ? '随播放滚动' : '正在浏览字幕';
  $('return-sync').hidden = !state.subtitles.length || (!searching && state.followLyrics);
}
function centerLyric(smooth = true) {
  if (!state.followLyrics || $('subtitle-search').value.trim()) return;
  const list = $('subtitle-list');
  const { anchor } = cuePosition(state.attached ? video.currentTime : state.resume);
  const row = list.querySelector(`[data-index="${anchor}"]`);
  if (!row || !list.clientHeight) return;
  const top = Math.max(0,Math.min(list.scrollHeight - list.clientHeight,row.offsetTop + row.offsetHeight / 2 - list.clientHeight / 2));
  if (Math.abs(top - list.scrollTop) < 2) return;
  list.scrollTo({ top, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
}
function scheduleLyricCenter(smooth = true) {
  cancelAnimationFrame(state.lyricFrame);
  state.lyricFrame = requestAnimationFrame(() => { state.lyricFrame = 0; centerLyric(smooth); });
}
function browseLyrics() {
  if (!state.subtitles.length || !state.followLyrics) return;
  state.followLyrics = false; cancelAnimationFrame(state.lyricFrame); state.lyricFrame = 0;
  // Stop a pending smooth scroll before the user's wheel or scrollbar takes over.
  $('subtitle-list').scrollTo({ top: $('subtitle-list').scrollTop, behavior: 'instant' });
  updateLyricMode();
}
function followCurrentLyric() {
  const searching = Boolean($('subtitle-search').value);
  $('subtitle-search').value = ''; state.followLyrics = true;
  if (searching) renderSubtitles();
  updateLyricMode(); scheduleLyricCenter();
}
function seekSubtitle(row,index) {
  if (state.calibrating) { alignSubtitle(index); return; }
  state.resume = Math.max(0,row.start);
  if (state.attached) video.currentTime = state.resume;
  else void connectPlayback(state.resume);
  followCurrentLyric(); updateActiveCue();
}
function updateCalibration() {
  const offset = state.offsets[state.view] || 0;
  $('subtitle-offset').value = String(offset);
  $('offset-summary').textContent = offset === 0 ? '未偏移' : `${offset > 0 ? '延后' : '提前'} ${Math.abs(offset)} 秒`;
  $('offset-controls').disabled = !state.rawSubtitles.length;
  $('align-current').disabled = !state.rawSubtitles.length || !state.attached;
  $('align-current').setAttribute('aria-pressed',String(state.calibrating));
  $('cancel-align').hidden = !state.calibrating;
  $('subtitle-list').classList.toggle('calibrating',state.calibrating);
}
function applyTimeline() {
  const list = $('subtitle-list'), previousTop = list.scrollTop;
  state.subtitles = shiftSubtitles(state.rawSubtitles,state.offsets[state.view]);
  renderSubtitles();
  if (!state.followLyrics || $('subtitle-search').value.trim()) list.scrollTo({top:previousTop,behavior:'instant'});
  if (state.attached) attachCaptions();
  updateCalibration();
}
function setSubtitleOffset(value) {
  const key = offsetKey(); if (!key || !state.rawSubtitles.length) return;
  let offset;
  try { offset = subtitleOffset(value); }
  catch (error) { $('calibration-status').textContent = explain(error); return; }
  state.offsets[state.view] = offset; state.calibrating = false; applyTimeline();
  $('calibration-status').textContent = '';
  // Serialize quick nudges so the last value always wins, including after switching views.
  state.offsetSave = state.offsetSave.then(() => storage.set({[key]:{seconds:offset,updatedAt:Date.now()}})).then(ok => {
    if (offsetKey() === key && state.offsets[state.view] === offset) $('calibration-status').textContent = ok ? '已保存' : '偏移已应用，保存失败';
  });
}
function alignSubtitle(index) {
  if (!state.attached || !state.rawSubtitles[index]) return;
  setSubtitleOffset(video.currentTime - state.rawSubtitles[index].start);
  followCurrentLyric(); updateActiveCue();
}
function renderSubtitles() {
  const search = $('subtitle-search').value.trim().toLocaleLowerCase();
  const fragment = document.createDocumentFragment(); let visible = 0;
  for (let index = 0; index < state.subtitles.length; index++) {
    const row = state.subtitles[index];
    if (search && !row.text.toLocaleLowerCase().includes(search)) continue;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'subtitle-item'; button.dataset.index = String(index); button.dataset.start = String(row.start);
    const original = state.rawSubtitles[index] || row;
    button.title = `原始 ${subtitleClock(original.start)} · 播放时间 ${subtitleClock(row.start)}；点击${state.calibrating ? '对齐当前播放时间' : '跳转'}`;
    button.append(textNode('time',subtitleClock(row.start)),textNode('span',row.text));
    button.addEventListener('click',() => seekSubtitle(row,index));
    fragment.append(button); visible++;
  }
  if (!visible) fragment.append(textNode('p', search ? '没有找到匹配字幕。' : '暂无字幕','empty'));
  const list = $('subtitle-list'); list.classList.toggle('searching',Boolean(search)); list.replaceChildren(fragment); list.scrollTop = 0;
  state.activeCue = -1; updateActiveCue(false); updateLyricMode(); scheduleLyricCenter(false);
}
function updateActiveCue(center = true) {
  const time = state.attached ? video.currentTime : state.resume;
  const { index } = cuePosition(time);
  $('subtitle-time').textContent = clock(time);
  $('current-caption').textContent = state.subtitles.length && state.attached && index < 0 ? '此处无字幕' : '';
  if (state.activeCue === index) return;
  const previous = $('subtitle-list').querySelector('.active'); previous?.classList.remove('active'); previous?.removeAttribute('aria-current');
  const current = $('subtitle-list').querySelector(`[data-index="${index}"]`); current?.classList.add('active'); current?.setAttribute('aria-current','true'); state.activeCue = index;
  if (center) scheduleLyricCenter();
}
function attachCaptions() {
  clearCaptionTracks();
  if (!state.subtitles.length) return;
  state.vttUrl = URL.createObjectURL(new Blob([vtt(state.subtitles)],{type:'text/vtt'}));
  const track = document.createElement('track'); track.kind = 'subtitles'; track.label = '平台字幕'; track.srclang = 'zh'; track.src = state.vttUrl;
  video.append(track);track.addEventListener('load',captions.update);track.track.addEventListener('cuechange',captions.update);syncCaptionMode();
}
function syncCaptionMode(){for(const node of video.querySelectorAll('track'))node.track.mode=$('show-captions').checked?(document.pictureInPictureElement===video?'showing':'hidden'):'disabled';captions.update();}
function updateViews() {
  $('audio-label').hidden=!Object.keys(state.info?.streams||{}).length;
  updateDual();
  for (const view of views) {
    if (view === 'student') $(view).hidden = !state.info?.streams.student;
    $(view).disabled = !state.info?.streams[view] || state.blockedViews.has(view);
    $(view).textContent = `${viewName(view)}${state.blockedViews.has(view) ? '（源失效）' : ''}`;
    $(view).setAttribute('aria-pressed',String(state.view === view));
  }
}

async function loadCourse(force=false) {
  if (state.courseLoading) return;
  let ref;
  try { ref = parseCourse($('course-input').value,$('platform').value); }
  catch (error) { message(explain(error),'error'); return; }
  resetSelection(); const sequence = ++state.sequence; state.controller = new AbortController(); state.courseLoading = true;
  api.reset(); api = ref.legacy ? new LegacyYanheApi() : new YanheApi();
  $('platform').value = ref.legacy ? 'legacy' : 'modern';
  $('site-link').href = ref.legacy ? 'https://www.yanhekt.cn/' : 'https://aita.yanhekt.cn/';
  $('load-course').disabled = true; $('load-course').textContent = '正在读取…'; message('');
  state.course = null; $('lecture-list').replaceChildren(textNode('p','正在读取课程…','empty'));
  try {
    const rules = await chrome.runtime.sendMessage({ type: 'ENSURE_RULES' });
    if (!rules?.ok) throw new Error('插件的播放请求配置未准备好。请在扩展管理页面重新加载本插件。');
    if (ref.legacy) ref=await api.resolve(ref,state.controller.signal);
    if (sequence !== state.sequence) return;
    let course;
    if(ref.legacy&&ref.liveId)course=await api.liveCourse(ref,state.controller.signal);
    else{
      // The shared background retains metadata/auth in memory across iframe recreation.
      // Media and subtitle requests still use this player's fresh API instance.
      const reply=await chrome.runtime.sendMessage({type:'REFINE_READ',operation:'detail',args:{args:[ref.legacy?'legacy':'modern',ref.id,{force,indexed:new URLSearchParams(location.search).get('index_source')==='autoslides',sessionId:ref.sessionId}]}});
      if(reply?.error)throw new Error(reply.error);
      course=reply?.ok?{...reply.value,legacy:Boolean(ref.legacy)}:await api.course(ref.id,state.controller.signal,{force,sessionId:ref.sessionId});
    }
    if (sequence !== state.sequence) return;
    state.course = course; $('course-title').textContent = course.title;
    if(parent!==window){const origin=location.ancestorOrigins?.[0];if(['https://aita.yanhekt.cn','https://www.yanhekt.cn'].includes(origin))parent.postMessage({type:'REFINE_COURSE',course:{id:course.id,title:course.title,teacher:course.teacher,term:course.term}},origin);}
    $('course-meta').textContent = [course.teacher,course.term,`课程 ID ${course.id}`].filter(Boolean).join(' / ');
    $('connection').textContent = '已连接延河课堂'; $('connection').classList.add('online');
    state.filter = ref.liveId || (ref.subId || (!(course.replays || []).length && course.lives?.length)) ? 'live' : 'replay';
    const previous=await storage.get('lastLecture:'+courseKey());if(sequence!==state.sequence)return;
    const target = ref.liveId ? course.lives.find(row=>row.id==='live:'+ref.liveId) : ref.sessionId ? (/^\d{1,12}:\d{1,12}$/.test(previous||'')&&previous.split(':')[0]===ref.sessionId?{id:previous,title:'课次 '+ref.sessionId}:course.replays.find(row=>row.id.split(':')[0]===ref.sessionId)) : ref.subId ? [...course.replays,...course.lives || []].find(row => row.id === ref.subId) : course.replays.find(row=>row.id===previous);
    if (target && !target.mode) state.filter = 'replay';
    message([course.liveWarning,course.indexWarning||(course.indexSource?'旧版课程索引仍在完善；点击课次后读取回放。':'')].filter(Boolean).join('；'),course.liveWarning?'error':''); renderLectures();
    $('subtitle-list').append(textNode('p','暂无字幕','empty'));
    playbackStatus('等待选择课次'); await storage.set({ lastCourse: course.id, lastPlatform: ref.legacy ? 'legacy' : 'modern' });
    if (sequence === state.sequence && (ref.subId || target)) void selectLecture(target || {id:ref.subId,title:`课次 ${ref.subId}`});
    else if (ref.sessionId) message('当前课次暂无回放，已载入所属课程。');
  } catch (error) {
    if (sequence !== state.sequence) return;
    message(explain(error),'error'); $('connection').textContent = '尚未连接'; $('connection').classList.remove('online');
    $('course-title').textContent = '暂时无法读取课程'; $('course-meta').textContent = '';
    $('replay-count').textContent = '—'; $('lecture-list').replaceChildren(textNode('p','未连接','empty'));
  } finally { state.courseLoading = false; $('load-course').disabled = false; $('load-course').textContent = '读取课程'; }
}

async function selectLecture(lecture) {
  if (!state.course) return;
  resetSelection(); const sequence = ++state.sequence; state.controller = new AbortController(); const signal = state.controller.signal;
  state.selected = lecture; state.resume = 0; state.lastRecovery = 0; state.lastSaved = 0;
  $('retry').disabled = false;
  document.querySelectorAll('.lecture-item').forEach(button => { button.classList.toggle('selected',button.dataset.id === lecture.id); button.setAttribute('aria-current',String(button.dataset.id === lecture.id)); });
  $('lecture-title').textContent = lecture.title; $('stage-label').textContent = '正在读取播放信息'; $('stage-detail').textContent = '';
  playbackStatus('正在读取本课次信息…');
  try {
    if(lecture.id.endsWith(':pending'))syncSessionTarget(lecture);
    const info = await api.lecture(state.course.id,lecture.id,signal);
    if (sequence !== state.sequence) return;
    if(info.selection){state.course=mergeSessionSelection(state.course,info);lecture=info.selection;state.selected=lecture;renderLectures();}
    state.info = info;
    $('download-video').disabled=!replayViews(info).length;
    if(!info.mode||info.mode==='replay')void storage.set({['lastLecture:'+courseKey()]:lecture.id});
    if (info.title) $('lecture-title').textContent = info.title;
    document.querySelector('.workspace').classList.toggle('live-mode',Boolean(liveContext()));
    $('speed').disabled = Boolean(liveContext()); $('go-live').hidden = !isLive();updateTimelyControls();void liveLinks.refresh();
    if (liveContext()) {
      $('retry').textContent = '刷新课次';
      $('duration').textContent = liveLabels[info.mode]; $('retry').disabled = false;
      $('subtitle-list').replaceChildren(textNode('p','直播暂无字幕','empty'));
      if (!isLive() || !Object.keys(info.streams).length) {
        $('stage-label').textContent = info.mode === 'upcoming' ? '直播尚未开始' : info.mode === 'ended' ? '直播已结束' : '直播源暂未就绪';
        $('stage-detail').textContent = '点击刷新课次重试'; playbackStatus($('stage-label').textContent); updateViews(); return;
      }
      state.view = info.streams.classroom ? 'classroom' : Object.keys(info.streams)[0];
      video.playbackRate = 1; state.resume = 0;
      $('play').textContent = '播放直播'; $('play').disabled = false;
      $('stage-label').textContent = '直播已就绪'; $('stage-detail').textContent = ''; updateViews(); playbackStatus('待播放'); return;
    }
    if (!Object.keys(info.streams).length) throw new Error('平台尚未提供可播放画面。请在原站确认回放是否已生成。');
    await state.offsetSave;
    if (sequence !== state.sequence) return;
    const [saved, screenOffset, classroomOffset] = await Promise.all([storage.get(progressKey()),storage.get(offsetKey('screen')),storage.get(offsetKey('classroom'))]);
    if (sequence !== state.sequence) return;
    state.view = info.streams[saved?.view] ? saved.view : state.course.legacy && info.streams.classroom ? 'classroom' : info.streams.screen ? 'screen' : 'classroom';
    state.offsets = {screen:savedOffset(screenOffset),classroom:savedOffset(classroomOffset)};
    state.resume = Math.min(Math.max(0,Number(saved?.time) || 0), Math.max(0,info.duration - 1));
    $('duration').textContent = `时长 ${clock(info.duration)}`; $('play').disabled = false; $('retry').disabled = false; updateViews();
    $('stage-label').textContent = `${viewName(state.view)}已就绪`;
    $('stage-detail').textContent = state.resume > 1 ? `上次 ${clock(state.resume)}` : '';
    $('play').textContent = state.resume > 1 ? '继续观看' : '播放回放'; playbackStatus('待播放');
    syncSessionTarget(lecture);
    try {
      const rows = await api.subtitles(lecture.id,signal);
      if (sequence !== state.sequence) return;
      state.rawSubtitles = rows; $('subtitle-count').textContent = `${rows.length} 段`; $('subtitle-search').disabled = !rows.length;
      $('show-captions').disabled = !rows.length;
      applyTimeline();
    } catch (error) { if (sequence === state.sequence && error.name !== 'AbortError') { $('subtitle-list').replaceChildren(textNode('p',`字幕暂时无法读取：${explain(error)}`,'empty')); $('subtitle-count').textContent = '未读取'; } }
  } catch (error) {
    if (sequence !== state.sequence) return;
    $('stage-label').textContent = '播放信息未就绪'; $('stage-detail').textContent = explain(error); playbackStatus(explain(error),true);
  }
}

async function liveSource(signal) {
  const order = [state.view,...views.filter(view => view !== state.view)];
  let lastStatus = '', failed = false;
  for (const view of order) {
    for (const candidate of state.info.candidates?.[view] || []) {
      if (candidate.format === 'flv' && !globalThis.mpegts?.isSupported()) continue;
      try {
        const result = await getMediaApi().probeMedia(candidate.url,signal);
        signal.throwIfAborted();
        if (result.ok) {
          state.view = view; state.sourceNote = failed ? '已切换可用直播源。' : ''; updateViews();
          return candidate;
        }
        lastStatus = `（HTTP ${result.status}）`; failed = true;
      } catch (error) { signal.throwIfAborted(); lastStatus = explain(error); failed = true; }
    }
  }
  throw new Error(`直播源暂时不可用${lastStatus}。请刷新课次重试。`);
}

async function connectPlayback(time = state.resume, { refresh = false, play = true, automatic = false } = {}) {
  if (!state.selected || !state.info) return;
  const sourceApi=getMediaApi();const sequence = state.sequence; const courseId = state.liveTarget?.courseId||state.course.id, subId = state.liveTarget?.lessonId||state.selected.id;
  clearMedia(); const epoch = state.mediaEpoch; state.connecting = true; state.resume = Math.max(0,Number(time) || 0);
  $('stage-empty').classList.add('hidden'); playbackStatus(refresh ? '正在重新获取播放地址…' : '正在连接视频…');
  try {
    await sourceApi.authenticate({ signal: state.controller.signal, force: refresh });
    await sourceApi.prepareMedia?.(state.controller.signal,state.info.streams[state.view]);
    // Refresh the actual account and platform source metadata on live reconnects.
    if (refresh || liveContext()) {
      const previousMode = state.info.mode || 'replay';
      const info = await sourceApi.lecture(courseId,subId,state.controller.signal);
      if (epoch !== state.mediaEpoch || sequence !== state.sequence) return;
      if(info.selection){state.course=mergeSessionSelection(state.course,info);state.selected=info.selection;renderLectures();}
    state.info = info;
      if (previousMode !== (info.mode || 'replay') || (liveContext() && (!isLive() || !Object.keys(info.streams).length))) {
        state.connecting = false;if(state.liveTarget){updateViews();updateTimelyControls();playbackStatus('所选平台的课次当前已不在直播，可切回另一平台。',true);return;}void selectLecture(state.selected); return;
      }
      if (!automatic) { state.blockedViews.clear(); state.sourceNote = ''; }
      updateViews();
    }
    if (epoch !== state.mediaEpoch || sequence !== state.sequence) return;
    let source = state.info.streams[state.view];
    if (isLive()) {
      const candidate = await liveSource(state.controller.signal);
      if (epoch !== state.mediaEpoch || sequence !== state.sequence) return;
      source = candidate.url; state.resume = 0;
    }
    if (!source) throw new Error('当前画面不可用，请切换另一种画面。');
    const probe = isLive() ? {ok:true} : await sourceApi.probeMedia(source,state.controller.signal);
    if (epoch !== state.mediaEpoch || sequence !== state.sequence) return;
    if (!probe.ok) {
      const failedView = state.view, alternate = failedView === 'screen' ? 'classroom' : 'screen';
      state.blockedViews.add(failedView); updateViews();
      const failure = `${viewName(failedView)}源返回 HTTP ${probe.status}`;
      if (!state.info.streams[alternate] || state.blockedViews.has(alternate)) throw new Error(`${failure}，当前没有另一种可用画面。请在原站确认资源状态。`);
      const alternateProbe = await sourceApi.probeMedia(state.info.streams[alternate],state.controller.signal);
      if (epoch !== state.mediaEpoch || sequence !== state.sequence) return;
      if (!alternateProbe.ok) {
        state.blockedViews.add(alternate); updateViews();
        throw new Error(`${failure}，另一画面也返回 HTTP ${alternateProbe.status}。这是视频源响应，重新加载地址无法补回缺失文件。`);
      }
      state.view = alternate; source = state.info.streams[alternate]; state.calibrating = false; $('calibration-status').textContent = ''; applyTimeline();
      state.sourceNote = `${failure}，已切换${viewName(alternate)}。`; updateViews();
      playbackStatus(state.sourceNote);
    }
    const url = sourceApi.sign(source); state.lastSigned = Date.now(); state.attached = true; attachCaptions(); updateCalibration(); $('retry').textContent = '重新连接';
    if (isLive() && new URL(source).pathname.toLowerCase().endsWith('.flv')) {
      if (!globalThis.mpegts?.isSupported()) throw new Error('当前浏览器不支持此 FLV 直播。');
      mpegts.LoggingControl.enableAll = false;
      const flv = mpegts.createPlayer({ type:'flv', isLive:true, url, cors:true, withCredentials:true }, {
        enableWorker:false, enableStashBuffer:false, lazyLoad:false,
        autoCleanupSourceBuffer:true, autoCleanupMaxBackwardDuration:30, autoCleanupMinBackwardDuration:15
      });
      state.flv = flv;
      flv.on(mpegts.Events.ERROR,(type,detail,info) => {
        if (epoch === state.mediaEpoch) handleMediaError(type === mpegts.ErrorTypes.NETWORK_ERROR ? 'network' : 'decode',Number(info?.code) || 0);
      });
      multi.observePrimary({flv});flv.attachMediaElement(video); flv.load();
    }
    else if (new URL(source).pathname.toLowerCase().endsWith('.mp4')) {
      // This path is entered only after playback was explicitly requested. Metadata is also needed for a paused view switch.
      multi.observePrimary();video.preload = 'metadata'; video.src = url;
    }
    else if (globalThis.Hls?.isSupported()) {
      const mediaApi=sourceApi, mediaSignal=state.controller.signal;
      const hls = new Hls({ enableWorker: false, lowLatencyMode:isLive(), liveSyncDurationCount:3, liveMaxLatencyDurationCount:8,
        maxBufferLength: 20, maxMaxBufferLength: 30, backBufferLength: 15, maxBufferSize: 32 * 1024 * 1024,
        async xhrSetup(xhr, requestUrl) { await mediaApi.prepareMedia?.(mediaSignal,requestUrl); mediaSignal.throwIfAborted();xhr.open('GET',mediaApi.sign(requestUrl),true); xhr.withCredentials = true; } });
      state.hls = hls;multi.observePrimary({hls});
      hls.on(Hls.Events.ERROR,(_event,data) => { if (data.fatal && epoch === state.mediaEpoch) {
        const status = Number(data.response?.code || data.networkDetails?.status || 0);
        handleMediaError(data.type === Hls.ErrorTypes.NETWORK_ERROR ? 'network' : 'decode',status);
      } });
      hls.on(Hls.Events.BUFFER_APPENDED,()=>timely.request());
      hls.loadSource(url); hls.attachMedia(video);
    } else throw new Error('当前浏览器不支持此 HLS 视频，请更新 Edge / Chrome，或切换屏幕画面。');
    if (play) {
      try { await video.play(); }
      catch (error) { if (epoch === state.mediaEpoch && error.name === 'NotAllowedError') audioBlocked('浏览器暂未允许播放，请点击音量图标或播放按钮。',true); }
    }
  } catch (error) {
    if (epoch !== state.mediaEpoch || sequence !== state.sequence) return;
    state.connecting = false; playbackStatus(explain(error),true);
    if (!state.attached) { $('stage-empty').classList.remove('hidden'); $('stage-label').textContent = '连接未成功'; $('stage-detail').textContent = explain(error); }
  }
}
function handleMediaError(kind, status = 0) {
  if (!state.attached || !state.selected) return;
  state.connecting = false;
  if (kind === 'network' && Date.now() - state.lastRecovery > 30000) {
    state.lastRecovery = Date.now(); void connectPlayback(video.currentTime || state.resume,{ refresh: true, automatic: true }); return;
  }
  playbackStatus(kind === 'decode' ? '浏览器未能识别此视频源。可能是编码不支持或资源响应异常，请切换画面或重新连接。' :
    `视频连接失败${status ? `（HTTP ${status}）` : ''}。请检查校园网 / VPN、代理绕过，再点击重新连接。`,true);
}

$('course-form').addEventListener('submit',event => { event.preventDefault(); void loadCourse(true); });
$('play').addEventListener('click',() => { state.lastRecovery = 0; void connectPlayback(state.resume); });
$('retry').addEventListener('click',() => { state.lastRecovery = 0; if (state.selected && (!state.info || (liveContext() && !state.attached))) void selectLecture(state.selected); else void connectPlayback(video.currentTime || state.resume,{refresh:true}); });
for (const filter of ['replay','live']) $(`filter-${filter}`).addEventListener('click',() => { state.filter = filter; if (state.course) renderLectures(); });
$('refresh-list').addEventListener('click',() => { if (state.courseLoading) return; void loadCourse(true); });
$('go-live').addEventListener('click',() => {
  if (!isLive() || !state.attached) return;
  const target = timely.enabled?latestBufferedFrame(video)?.time:liveEdge(video,state.hls);
  if (target != null) { video.currentTime = target; void video.play().catch(() => playbackStatus('请点击视频播放按钮')); }
  else void connectPlayback(0,{refresh:true});
});
for (const view of views) $(view).addEventListener('click',() => {
  if (!state.info?.streams[view]) return;
  if(state.view===view)return;
  const time = video.currentTime || state.resume, playing = state.attached && !video.paused, attached = state.attached;
  saveProgress(true);if(attached)state.connecting=true; state.view = view; state.calibrating = false; $('calibration-status').textContent = ''; if (!liveContext()) applyTimeline(); updateViews();
  if (attached) void connectPlayback(time,{play:playing});
  else { $('stage-label').textContent = `${viewName(view)}已就绪`; }
});
$('speed').addEventListener('change',() => { video.playbackRate = Number($('speed').value); });
$('platform').addEventListener('change',()=> { $('site-link').href=$('platform').value==='legacy'?'https://www.yanhekt.cn/':'https://aita.yanhekt.cn/'; });
$('subtitle-search').addEventListener('input',() => { state.followLyrics = !$('subtitle-search').value.trim(); renderSubtitles(); });
$('return-sync').addEventListener('click',followCurrentLyric);
$('offset-form').addEventListener('submit',event => { event.preventDefault(); setSubtitleOffset($('subtitle-offset').value); });
for (const button of document.querySelectorAll('[data-offset-step]')) button.addEventListener('click',() => setSubtitleOffset(state.offsets[state.view] + Number(button.dataset.offsetStep)));
$('offset-reset').addEventListener('click',() => setSubtitleOffset(0));
$('align-current').addEventListener('click',() => {
  if (!state.attached || !state.rawSubtitles.length) return;
  video.pause(); state.calibrating = true; browseLyrics(); updateCalibration();
  $('calibration-status').textContent = `对齐到 ${subtitleClock(video.currentTime)}：选择字幕`;
});
$('cancel-align').addEventListener('click',() => { state.calibrating = false; updateCalibration(); $('calibration-status').textContent = ''; });
const lyricList = $('subtitle-list');
lyricList.addEventListener('wheel',event => { if (event.deltaY) browseLyrics(); },{passive:true});
lyricList.addEventListener('touchstart',browseLyrics,{passive:true});
lyricList.addEventListener('pointerdown',event => { if (event.target === lyricList) browseLyrics(); });
lyricList.addEventListener('keydown',event => { if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(event.key) || (event.key === ' ' && event.target === lyricList)) browseLyrics(); });
lyricList.addEventListener('focusin',event => { if (event.target.closest('.subtitle-item')?.matches(':focus-visible')) browseLyrics(); });
new ResizeObserver(() => {
  lyricList.style.setProperty('--lyric-inset',`${Math.max(24,lyricList.parentElement.clientHeight / 2 - 36)}px`);
  scheduleLyricCenter(false);
}).observe(lyricList.parentElement);
$('show-captions').addEventListener('change',syncCaptionMode);
video.addEventListener('enterpictureinpicture',syncCaptionMode);video.addEventListener('leavepictureinpicture',syncCaptionMode);
video.addEventListener('loadedmetadata',() => {
  if (!state.attached) return;
  video.playbackRate = isLive() ? 1 : Number($('speed').value);
  $('go-live').disabled = !isLive();
  if (!isLive() && state.resume > 0 && Number.isFinite(video.duration)) { state.restoring = true; video.currentTime = Math.min(state.resume,Math.max(0,video.duration - 0.1)); }
  state.connecting = false;
  updateDual();timely.request();
  if (!state.restoring) saveProgress(true);
});
video.addEventListener('playing',() => { state.connecting = false; playbackStatus(`${state.sourceNote}${state.sourceNote ? ' ' : ''}正在${isLive() ? '直播' : '播放'}${viewName(state.view)}`); });
video.addEventListener('timeupdate',() => { if (!liveContext()) updateActiveCue(); saveProgress(); });
video.addEventListener('ended',() => { if (isLive()) playbackStatus('直播流已结束，可刷新课次查看回放。'); });
video.addEventListener('pause',() => saveProgress(true));
video.addEventListener('seeking',() => {
  if (!isLive() && state.attached && !state.hls && !state.connecting && !state.restoring && Date.now() - state.lastSigned > 45000)
    void connectPlayback(video.currentTime,{play:!video.paused});
});
video.addEventListener('seeked',() => { state.restoring = false; updateActiveCue(); saveProgress(true); if (state.followLyrics) scheduleLyricCenter(); });
video.addEventListener('error',() => { if (state.attached) handleMediaError(video.error?.code === 3 || video.error?.code === 4 ? 'decode' : 'network'); });
window.addEventListener('pagehide',() => { saveProgress(true); state.controller?.abort(); clearMedia();playbackApi?.reset();api.reset();liveLinks.reset(); });

const livePrefs=await chrome.storage.local.get(['player:timelyLive','player:audioSource','player:volume']);
multi.restore(livePrefs);
timely.setEnabled(livePrefs['player:timelyLive']===true);
const params = new URLSearchParams(location.search);
const legacyLive = params.get('legacy_live'), legacySession = params.get('legacy_session');
const source = params.get('source') || (/^\d{1,12}$/.test(legacyLive || '') ? `https://www.yanhekt.cn/live/${legacyLive}` : /^\d{1,12}$/.test(legacySession || '') ? `https://www.yanhekt.cn/session/${legacySession}` : null);
const course = params.get('legacy') || params.get('course') || await storage.get('lastCourse');
const legacy = Boolean(legacyLive || legacySession) || (source ? source.startsWith('https://www.yanhekt.cn/') : params.has('legacy') || (!params.has('course') && await storage.get('lastPlatform') === 'legacy'));
$('platform').value = legacy ? 'legacy' : 'modern';
$('site-link').href = legacy ? 'https://www.yanhekt.cn/' : 'https://aita.yanhekt.cn/';
if (source) { $('course-input').value=source;void loadCourse(params.get('refresh')==='1'); }
else if (/^\d{1,12}$/.test(course || '')) {
  const subId = params.get('sub_id');
  $('course-input').value = legacy ? `https://www.yanhekt.cn/course/${course}` : /^\d{1,12}$/.test(subId || '') ? `https://aita.yanhekt.cn/livingroom?course_id=${course}&sub_id=${subId}` : course;
  void loadCourse(params.get('refresh')==='1');
}
