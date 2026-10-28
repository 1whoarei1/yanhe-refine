import {referrerRule} from './watch/core.js';
import {legacyReferrerRule} from './watch/legacy-core.js';
import {readOperation,trustedReader} from './broker.js';
import {nativeHref,refineEntryHref,isPlatformPage} from './site-routes.js';
import {readSiteMode} from './site-mode.js';
async function rules(){await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[1,2],addRules:[referrerRule(chrome.runtime.id),legacyReferrerRule(chrome.runtime.id)]});}
chrome.runtime.onInstalled.addListener(()=>rules().catch(()=>{}));chrome.runtime.onStartup.addListener(()=>rules().catch(()=>{}));
chrome.action.onClicked.addListener(async tab=>{
 if(isPlatformPage(tab.url)&&!['zy-eclass.bit.edu.cn','lexue.bit.edu.cn'].includes(new URL(tab.url).hostname)){
  const current=await chrome.tabs.sendMessage(tab.id,{type:'REFINE_GET_VIEW'}).catch(()=>null);
  const mode=current?.mode||await readSiteMode(tab.url);
  const target=mode==='refine'?nativeHref(tab.url,{remember:true}):refineEntryHref(tab.url);await readSiteMode(target);await chrome.tabs.update(tab.id,{url:target});
 }else{const target=refineEntryHref('https://aita.yanhekt.cn/portal/#/');await readSiteMode(target);await chrome.tabs.create({url:target});}
});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 if(message?.type==='REFINE_READ'&&trustedReader(sender)){readOperation(message.operation,message.args).then(value=>respond({ok:true,value}),e=>respond({ok:false,error:e.message||'读取失败'}));return true;}
 if(message?.type==='ENSURE_RULES'&&['watch/player.html','watch/download.html'].some(path=>sender.url?.startsWith(chrome.runtime.getURL(path)))){rules().then(()=>respond({ok:true}),()=>respond({ok:false}));return true;}
 if(['OPEN_PLAYER','OPEN_DESK'].includes(message?.type)&&sender.tab&&isPlatformPage(sender.url)){chrome.tabs.update(sender.tab.id,{url:refineEntryHref(sender.url)}).then(()=>respond({ok:true}),()=>respond({ok:false}));return true;}
});
