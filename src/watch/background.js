import { parseCourse, referrerRule } from './core.js';
import { legacyReferrerRule } from './legacy-core.js';

async function ensureRules() {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [1,2], addRules: [referrerRule(chrome.runtime.id),legacyReferrerRule(chrome.runtime.id)] });
}
function playerUrl(value) {
  const url = new URL(chrome.runtime.getURL('player.html'));
  try {
    const ref = parseCourse(value);
    if (ref.liveId) url.searchParams.set('legacy_live',ref.liveId);
    else if (ref.sessionId) url.searchParams.set('legacy_session',ref.sessionId);
    else url.searchParams.set(ref.legacy ? 'legacy' : 'course', ref.id);
    if (ref.subId) url.searchParams.set('sub_id', ref.subId);
  } catch {
    // Retain the actual source instead of silently restoring an unrelated last course.
    try {
      const source=new URL(value);
      if(source.protocol==='https:'&&['aita.yanhekt.cn','www.yanhekt.cn'].includes(source.hostname)&&!source.username&&!source.password&&!source.port){
        source.search='';source.hash='';url.searchParams.set('source',source.href);
      }
    } catch {}
  }
  return url.href;
}
chrome.runtime.onInstalled.addListener(() => { ensureRules().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { ensureRules().catch(() => {}); });
chrome.action.onClicked.addListener(tab => { chrome.tabs.create({ url: playerUrl(tab.url || '') }); });
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === 'ENSURE_RULES' && sender.url?.startsWith(chrome.runtime.getURL('player.html'))) {
    ensureRules().then(() => respond({ ok: true }), () => respond({ ok: false })); return true;
  }
  if (message?.type === 'OPEN_PLAYER' && /^https:\/\/(aita|www)\.yanhekt\.cn\//.test(sender.url || '')) {
    let source=sender.tab?.url||sender.url;
    try {const actual=new URL(message.url);if(actual.origin===new URL(sender.url).origin&&!actual.username&&!actual.password&&!actual.port)source=actual.href;}catch{}
    chrome.tabs.create({ url: playerUrl(source) }).then(() => respond({ ok: true }),()=>respond({ok:false})); return true;
  }
});
