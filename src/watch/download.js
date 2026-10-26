import {YanheApi} from './api.js';
import {LegacyYanheApi} from './legacy-api.js';
import {ReplayDownloader,replayViews,downloadRequest,VIEW_NAMES,fileStem} from './media-download.js';

const $=id=>document.getElementById(id),message=$('message');let context,api,info,course,lecture,busy=false,controller;
const rows=new Map(),finished=new Set();
const size=n=>n>=1073741824?`${(n/1073741824).toFixed(2)} GB`:n>=1048576?`${(n/1048576).toFixed(1)} MB`:`${(n/1024).toFixed(1)} KB`;
function selection(){return [...rows].filter(([,row])=>row.input.checked).map(([view])=>view);}
function update(){const selected=selection();$('start').disabled=busy||!selected.some(view=>!finished.has(view));$('select-all').checked=selected.length===rows.size;$('select-all').indeterminate=selected.length>0&&selected.length<rows.size;$('selection-count').textContent=`${selected.length} / ${rows.size}`;}
function freeze(value){busy=value;$('cancel').hidden=!value;for(const row of rows.values())row.input.disabled=value;$('select-all').disabled=value;update();}
async function fileHandle(directory,stem,extension){
 for(let i=0;i<1000;i++){
  const name=stem+(i?` (${i+1})`:'')+'.'+extension;
  try{await directory.getFileHandle(name);}
  catch(error){if(error.name!=='NotFoundError')throw error;return {name,handle:await directory.getFileHandle(name,{create:true})};}
 }
 throw new Error('同名文件过多，请选择其他文件夹');
}
async function start(){
 if(busy||!selection().length)return;
 if(!window.showDirectoryPicker){message.textContent='请使用桌面版 Edge / Chrome 下载视频';return;}
 let directory;
 freeze(true);
 try{directory=await window.showDirectoryPicker({id:'yanhe-video-downloads',mode:'readwrite',startIn:'downloads'});}
 catch(error){freeze(false);if(error.name!=='AbortError')message.textContent='未能选择下载文件夹';return;}
 const selected=selection().filter(view=>!finished.has(view));if(!selected.length){freeze(false);return;}
 freeze(true);message.textContent='';controller=new AbortController();const signal=controller.signal;
 $('destination').textContent='保存到 '+directory.name;
 try{
  const rules=await chrome.runtime.sendMessage({type:'ENSURE_RULES'});if(!rules?.ok)throw new Error('扩展已更新，请刷新下载页面');
  const target=await directory.getDirectoryHandle(fileStem(course.title,60)+'-'+course.id,{create:true});
  const downloader=new ReplayDownloader(api);let failures=0;
  for(const view of selected){
   if(signal.aborted)break;
   const row=rows.get(view);row.item.classList.remove('error','done');row.status.textContent='正在读取…';row.progress.hidden=false;row.progress.removeAttribute('value');row.detail.textContent='';let file;
   try{
    await navigator.locks.request(`video-save:${context.legacy?'legacy':'modern'}:${course.id}:${lecture.id}:${view}`,{signal},async()=>{
    const plan=await downloader.plan(info.streams[view],signal);
    signal.throwIfAborted();file=await fileHandle(target,fileStem(lecture.title)+'-'+VIEW_NAMES[view],plan.extension);
    const writable=await file.handle.createWritable();let last=0;
    await downloader.save(plan,writable,{signal,onProgress:value=>{
     const now=Date.now();if(now-last<200&&value.completed!==value.totalSegments)return;last=now;
     row.status.textContent='下载中';
     const ratio=value.totalSegments?value.completed/value.totalSegments:value.total?value.received/value.total:0;
     if(ratio){row.progress.max=1;row.progress.value=ratio;}
     row.detail.textContent=[size(value.received),value.totalSegments?`${value.completed} / ${value.totalSegments} 段`:value.total?'/ '+size(value.total):''].join(' ');
    }});
    finished.add(view);row.item.classList.add('done');row.progress.max=1;row.progress.value=1;row.status.textContent='已完成';row.detail.textContent=file.name;
    });
   }catch(error){
    failures++;row.item.classList.add('error');row.status.textContent=signal.aborted?'已停止':'下载失败';row.detail.textContent=signal.aborted?'':error.message;
    if(file)await target.removeEntry(file.name).catch(()=>{});
   }
  }
  message.textContent=signal.aborted?'已停止':failures?'部分画面未完成，可重试':'下载完成';
 }catch(error){message.textContent=signal.aborted?'已停止':error.message;}
 finally{freeze(false);$('start').textContent=finished.size?'继续下载未完成画面':'选择文件夹并下载';}
}
$('start').addEventListener('click',()=>void start());
$('cancel').addEventListener('click',()=>controller?.abort());
$('select-all').addEventListener('change',e=>{for(const row of rows.values())row.input.checked=e.target.checked;update();});
window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
async function load(){
 try{
  context=downloadRequest(new URLSearchParams(location.search));api=context.legacy?new LegacyYanheApi():new YanheApi();
  course=await api.course(context.courseId);lecture=course.replays.find(row=>row.id===context.lectureId);
  if(!lecture)throw new Error('未找到可下载的回放课次');
  info=await api.lecture(context.courseId,context.lectureId);const available=replayViews(info);if(!available.length)throw new Error('当前课次没有可下载回放');
  $('course-title').textContent=course.title;$('lecture-title').textContent=lecture.title;document.title=course.title+' · 视频下载';
  for(const view of available){
   const item=document.createElement('div');item.className='channel';item.dataset.view=view;
   const heading=document.createElement('div');heading.className='channel-head';const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=view;input.checked=context.view==='all'||view===context.view;
   label.append(input,document.createTextNode(VIEW_NAMES[view]));const status=document.createElement('span');status.className='channel-status';status.textContent='待下载';heading.append(label,status);
   const progress=document.createElement('progress');progress.setAttribute('aria-label',VIEW_NAMES[view]+'下载进度');progress.hidden=true;
   const detail=document.createElement('div');detail.className='channel-detail';item.append(heading,progress,detail);$('channels').append(item);rows.set(view,{item,input,status,progress,detail});input.addEventListener('change',update);
  }
  if(!selection().length)rows.values().next().value.input.checked=true;
  $('download-panel').hidden=false;message.textContent='';update();
 }catch(error){message.textContent=error.message;}
}
void load();
