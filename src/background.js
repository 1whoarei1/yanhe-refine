import {referrerRule} from './watch/core.js';
import {legacyReferrerRule} from './watch/legacy-core.js';
import {readOperation,trustedReader} from './broker.js';
import {siteRoute,isPlatformPage} from './site-routes.js';
async function rules(){await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[1,2],addRules:[referrerRule(chrome.runtime.id),legacyReferrerRule(chrome.runtime.id)]});}
chrome.runtime.onInstalled.addListener(()=>rules().catch(()=>{}));chrome.runtime.onStartup.addListener(()=>rules().catch(()=>{}));
chrome.action.onClicked.addListener(async tab=>{
 if(isPlatformPage(tab.url)&&!tab.url.startsWith('https://zy-eclass.')){
  if(siteRoute(tab.url)){await chrome.tabs.sendMessage(tab.id,{type:'REFINE_RESTORE'}).catch(()=>{});return;}
  const u=new URL(tab.url);u.searchParams.delete('yh_native');await chrome.tabs.update(tab.id,{url:siteRoute(u.href)?u.href:'https://aita.yanhekt.cn/portal/#/'});
 }else await chrome.tabs.create({url:'https://aita.yanhekt.cn/portal/#/'});
});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 if(message?.type==='REFINE_READ'&&trustedReader(sender)){readOperation(message.operation,message.args).then(value=>respond({ok:true,value}),e=>respond({ok:false,error:e.message||'读取失败'}));return true;}
 if(message?.type==='ENSURE_RULES'&&sender.url?.startsWith(chrome.runtime.getURL('watch/player.html'))){rules().then(()=>respond({ok:true}),()=>respond({ok:false}));return true;}
 if(['OPEN_PLAYER','OPEN_DESK'].includes(message?.type)&&sender.tab&&isPlatformPage(sender.url)){chrome.tabs.update(sender.tab.id,{url:sender.url}).then(()=>respond({ok:true}),()=>respond({ok:false}));return true;}
});
