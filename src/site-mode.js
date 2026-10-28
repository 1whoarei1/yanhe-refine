export const SITE_MODE_KEY='refine:siteMode';
export function classroomUrl(raw){
 try{const u=new URL(raw);return ['https://aita.yanhekt.cn','https://www.yanhekt.cn'].includes(u.origin)&&!u.username&&!u.password&&!u.port?u:null;}catch{return null;}
}
export function modeIntent(raw){const value=classroomUrl(raw)?.searchParams.get('yh_mode');return ['native','refine'].includes(value)?value:null;}
export function siteMode(raw,saved){
 const intent=modeIntent(raw);if(intent)return intent;
 if(classroomUrl(raw)?.searchParams.get('yh_native')==='1')return 'native';
 return saved==='native'?'native':'refine';
}
export async function readSiteMode(raw,storage=chrome.storage.local,{remember=true}={}){
 const intent=modeIntent(raw);
 if(intent){if(remember)try{await storage.set({[SITE_MODE_KEY]:intent});}catch{}return intent;}
 let saved;try{saved=(await storage.get(SITE_MODE_KEY))[SITE_MODE_KEY];}catch{}
 return siteMode(raw,saved);
}
