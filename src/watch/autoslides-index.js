// Keep the old adapter name and routing markers for saved links; catalogs are local only.
import {SessionIndex} from './session-index.js';
import {sharedCatalog} from './catalog-client.js';
const missing=()=>new Error('尚未导入旧版课次目录，请在设置中导入发布包内的「旧版课次目录.json」。');
export class AutoSlidesIndex {
 constructor(options={}){this.snapshot=new SessionIndex(options);this.shared=!options.local&&!options.fetcher&&!Object.hasOwn(options,'snapshotUrl');}
 async read(method,values,signal,load){if(this.shared){const result=await sharedCatalog(method,values,signal);if(result.shared)return result.value;}return load();}
 async terms(signal){const data=await this.read('terms',[],signal,()=>this.snapshot.terms(signal));if(!data)throw missing();return data;}
 async search(query='',options={}){const data=await this.read('search',[query,{page:options.page??1,term:options.term||''}],options.signal,()=>this.snapshot.search(query,options));if(!data)throw missing();return data;}
 async sessions(courseId,signal){const data=await this.read('sessions',[courseId],signal,()=>this.snapshot.sessions(courseId,signal));if(!data)throw missing();return data;}
 async course(courseId,signal){return this.read('course',[courseId],signal,()=>this.snapshot.course(courseId,signal));}
 async owner(sessionId,signal){return this.read('owner',[sessionId],signal,()=>this.snapshot.owner(sessionId,signal));}
}

// A pending row is a session, never a guessed video ID. Media is resolved only on selection.
export function indexedSession(sessionId){return {id:`${sessionId}:pending`,title:`课次 ${sessionId}`,start:0,indexed:true};}
export function mergeSessionSelection(course,info){
 if(!info.sessionReplays)return course;
 const prefix=info.selection.id.split(':')[0]+':';let inserted=false;
 const replays=course.replays.flatMap(row=>{if(!row.id.startsWith(prefix))return [row];if(inserted)return [];inserted=true;return info.sessionReplays;});
 if(!inserted)replays.push(...info.sessionReplays);return {...course,replays};
}
