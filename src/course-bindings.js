import {termLabel} from './catalog-core.js';
const keyPattern=/^(legacy|modern):\d{1,8}:\d{1,12}$/;
const numeric=value=>/^\d{1,12}$/.test(String(value));
const sources=['lms','lexue'];
const clean=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'').replace(/[《》「」“”"']/g,'');
function subjects(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/\([^)]*(?:20\d{2}|学期|班)[^)]*\)/g,'').replace(/20\d{2}(?:\s*[-—/]\s*20\d{2})?/g,'').replace(/第?[一二12]学期|春季?|秋季?|学年/g,'').split(/[-—_|:：]/).map(clean).filter(Boolean);}
export function sameTeachingCourse(course,target){
 if(course.term&&target.term&&clean(course.term)!==clean(target.term))return false;
 if(course.code&&target.code&&clean(course.code)===clean(target.code))return true;
 const a=subjects(course.title),b=subjects(target.title);return a.some(title=>b.includes(title));
}
export function safeBindings(value){const result={};if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const [key,row]of Object.entries(value)){if(!keyPattern.test(key)||!row||typeof row!=='object'||typeof row.title!=='string'||row.title.length>512)continue;const item={title:row.title,term:termLabel(row.term).slice(0,64),active:sources.includes(row.active)?row.active:'lms'};
  for(const source of sources){const target=row[source];if(target===null)item[source]=null;else if(target&&numeric(target.id)&&typeof target.title==='string'&&target.title.length<=512)item[source]={id:String(target.id),title:target.title,term:termLabel(target.term).slice(0,64)};}
  result[key]=item;
 }return result;
}
export function bindingSource(course,bindings,legacy,explicit){if(sources.includes(explicit))return explicit;const row=bindings[course.key];if(row&&clean(row.title)===clean(course.title)&&(!row.term||!course.term||row.term===course.term))return row.active;return String(legacy[course.key]||'').startsWith('lexue:')?'lexue':'lms';}
export function resolveBinding(course,source,candidates,{bindings={},legacy={},official}={}){
 const row=bindings[course.key];let rejected=false;
 if(row){if(clean(row.title)!==clean(course.title)||(row.term&&course.term&&row.term!==course.term))rejected=true;
  else if(Object.hasOwn(row,source)){const saved=row[source];if(saved===null)return {target:null,blocked:false,origin:'saved'};const target=candidates.find(c=>String(c.id)===saved.id);if(target&&clean(target.title)===clean(saved.title)&&(!saved.term||!target.term||saved.term===target.term))return {target,blocked:false,origin:'saved'};rejected=true;}
 }
 const old=String(legacy[course.key]||''),oldSource=old.startsWith('lexue:')?'lexue':'lms';
 if(old&&oldSource===source){const id=old.replace(/^lexue:/,''),target=candidates.find(c=>String(c.id)===id);if(target&&sameTeachingCourse(course,target))return {target,blocked:false,origin:'legacy'};rejected=true;}
 if(source==='lms'&&official){const target=candidates.find(c=>String(c.id)===String(official));if(target&&sameTeachingCourse(course,target))return {target,blocked:false,origin:'official'};if(target)rejected=true;}
 return {target:null,blocked:rejected};
}
export function setBinding(bindings,course,source,target){if(!keyPattern.test(course.key)||!sources.includes(source))throw new Error('课程关联无效');const previous=bindings[course.key],same=previous&&clean(previous.title)===clean(course.title)&&(!previous.term||!course.term||previous.term===course.term);bindings[course.key]={...(same?previous:{}),title:course.title,term:course.term||'',active:source,[source]:target?{id:String(target.id),title:target.title,term:target.term||''}:null};}
export function setBindingSource(bindings,course,source){if(!keyPattern.test(course.key)||!sources.includes(source))throw new Error('课程关联无效');const previous=bindings[course.key],same=previous&&clean(previous.title)===clean(course.title)&&(!previous.term||!course.term||previous.term===course.term);bindings[course.key]={...(same?previous:{}),title:course.title,term:course.term||'',active:source};}
