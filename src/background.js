import {parseCourse,referrerRule} from './watch/core.js';
import {legacyReferrerRule} from './watch/legacy-core.js';
const root=chrome.runtime.getURL('desk.html');
async function rules(){await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[1,2],addRules:[referrerRule(chrome.runtime.id),legacyReferrerRule(chrome.runtime.id)]});}
function deskUrl(value){
 const url=new URL(root);try{const ref=parseCourse(value);if(ref.liveId)url.hash='/open?legacy_live='+ref.liveId;
 else if(ref.sessionId)url.hash='/open?legacy_session='+ref.sessionId;
 else url.hash=`/course/${ref.legacy?'legacy':'modern'}/${ref.id}`+(ref.subId?`?sub=${ref.subId}`:'');}catch{url.hash='/today';}return url.href;
}
chrome.runtime.onInstalled.addListener(()=>rules().catch(()=>{}));chrome.runtime.onStartup.addListener(()=>rules().catch(()=>{}));
chrome.action.onClicked.addListener(tab=>chrome.tabs.create({url:deskUrl(tab.url||'')}));
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 if(message?.type==='ENSURE_RULES'&&sender.url?.startsWith(chrome.runtime.getURL('watch/player.html'))){rules().then(()=>respond({ok:true}),()=>respond({ok:false}));return true;}
 if(message?.type==='OPEN_PLAYER'&&/^https:\/\/(aita|www)\.yanhekt\.cn\//.test(sender.url||'')){
  chrome.tabs.create({url:deskUrl(sender.url)}).then(()=>respond({ok:true}),()=>respond({ok:false}));return true;
 }
 if(message?.type==='OPEN_DESK'&&/^https:\/\/(aita|www)\.yanhekt\.cn\//.test(sender.url||'')){
  let source=sender.url;try{const u=new URL(message.url);if(u.origin===new URL(sender.url).origin&&!u.username&&!u.password&&!u.port)source=u.href;}catch{}
  chrome.tabs.create({url:deskUrl(source)}).then(()=>respond({ok:true}),()=>respond({ok:false}));return true;
 }
});
