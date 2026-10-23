// Modern platform protocol reference: https://github.com/windlandneko/yanhekit
export const ORIGIN = 'https://aita.yanhekt.cn';

export function parseCourse(value, platform = 'modern') {
  let text = String(value ?? '').trim();
  const markdown = text.match(/^\[[^\]\r\n]*\]\((https:\/\/[^\s()]+)\)$/);
  if (markdown) text = markdown[1];
  if (text.startsWith('<') && text.endsWith('>')) text = text.slice(1,-1).trim();
  if (/^\d{1,12}$/.test(text)) return { id: text, legacy: platform === 'legacy' };
  let url;
  try { url = new URL(text); } catch { throw new Error('请填写延河课堂课程、直播或回放链接，或数字课程 ID。'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('请使用延河课堂的 HTTPS 课程链接。');
  if (url.hostname === 'aita.yanhekt.cn') {
    const id = url.searchParams.get('course_id');
    if (/^\d{1,12}$/.test(id ?? '')) {
      const subId = url.searchParams.get('sub_id');
      if (subId != null && !/^\d{1,12}$/.test(subId)) throw new Error('直播链接的课次 ID 无效。');
      return { id, legacy: false, ...(subId ? { subId } : {}) };
    }
  }
  if (url.hostname === 'www.yanhekt.cn') {
    const old = url.pathname.match(/^\/(course|live|session|ReadSession)\/(\d{1,12})\/?$/);
    if (old?.[1] === 'course') return { id: old[2], legacy: true };
    if (old?.[1] === 'live') return { liveId: old[2], legacy: true };
    if (old) return { sessionId: old[2], legacy: true };
    throw new Error('未找到旧版课程、直播或回放编号，请复制完整页面地址。');
  }
  throw new Error('未找到受支持的延河课堂链接，请复制课程、直播或回放页面的完整地址。');
}

export function replayRows(tree) {
  const result = new Map();
  function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    if ('sub_title' in node) {
      if (String(node.playback_status) === '1' && node.id != null) result.set(String(node.id), node);
      walk(node.child);
    } else Object.values(node).forEach(walk);
  }
  walk(tree);
  return [...result.values()].sort((a, b) => Number(a.class_begin || 0) - Number(b.class_begin || 0)).map(row => ({
    id: String(row.id), title: String(row.sub_title), start: Number(row.class_begin || 0)
  }));
}

export function mediaUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('平台返回了无效的视频地址。'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !(url.hostname === 'yanhekt.cn' || url.hostname.endsWith('.yanhekt.cn'))) {
    throw new Error('视频地址不属于受支持的延河课堂 HTTPS 域名。');
  }
  return url;
}

export function signedUrl(raw, profile, hash, now = Math.floor(Date.now() / 1000)) {
  const url = mediaUrl(raw);
  if (url.pathname.startsWith('/play/')) {
    if (profile?.id == null || profile.tenant_id == null || profile.phone == null) throw new Error('登录信息不完整，请在延河课堂重新登录。');
    const user = String(profile.id);
    const digest = hash(url.pathname + user + String(profile.tenant_id) + [...String(profile.phone)].reverse().join('') + now);
    url.search = new URLSearchParams({ t: `${user}-${now}-${digest}` }).toString();
  }
  return url.href;
}

export function jwtFromCookie(value) {
  let decoded = String(value || '');
  for (let i = 0; i < 3; i++) {
    try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; }
    catch { break; }
  }
  return decoded.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/)?.[0] ?? null;
}

export function tokenFromCookie(value) {
  let decoded = String(value || '');
  if (decoded.length > 65536) return null;
  for (let i = 0; i < 3; i++) {
    try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; }
    catch { break; }
  }
  // The portal wraps its bearer in a PHP serialized _token entry. It need not be a JWT.
  const serialized = decoded.match(/s:\d+:"_token";i:\d+;s:\d+:"([^"\r\n]+)";/)?.[1];
  if (serialized && /^[A-Za-z0-9._~+\/-]+={0,2}$/.test(serialized) && serialized.length <= 16384) return serialized;
  return jwtFromCookie(decoded);
}

export function streamsFrom(data) {
  const streams = {};
  const names = { '2': 'screen', '3': 'classroom' };
  for (const video of Object.values(data.video_list || {})) {
    const name = names[String(video.type)];
    if (name && String(video.status) === '2' && video.preview_url) streams[name] = mediaUrl(video.preview_url).href;
  }
  return { duration: Number(data.duration || 0), streams };
}

export function subtitleRows(body) {
  const rows = new Map();
  for (const group of body.list || []) for (const row of group.all_content || []) {
    const start = Number(row.BeginSec), end = Number(row.EndSec);
    if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && String(row.Text || '').trim())
      rows.set(start, { start, end, text: String(row.Text).trim() });
  }
  return [...rows.values()].sort((a, b) => a.start - b.start);
}

export function clock(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = n % 60;
  return `${h ? `${h}:` : ''}${h ? String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`;
}

export function subtitleOffset(value) {
  const offset = Number(value);
  if (!Number.isFinite(offset) || Math.abs(offset) > 86400) throw new Error('字幕偏移请输入 -86400 到 86400 之间的秒数。');
  return Math.round(offset * 1000) / 1000 || 0;
}

export function shiftSubtitles(rows, value = 0) {
  const offset = subtitleOffset(value);
  return rows.map(row => ({ ...row, start: row.start + offset, end: row.end + offset }));
}

export function subtitleClock(seconds) {
  const ms = Math.round(Math.abs(seconds) * 1000);
  const fraction = ms % 1000;
  return `${seconds < 0 ? '−' : ''}${clock(Math.floor(ms / 1000))}${fraction ? '.' + String(fraction).padStart(3,'0').replace(/0+$/,'') : ''}`;
}

export function vtt(rows) {
  function stamp(seconds) {
    const ms = Math.round(seconds * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2,'0')}:${String(Math.floor(ms / 60000) % 60).padStart(2,'0')}:${String(Math.floor(ms / 1000) % 60).padStart(2,'0')}.${String(ms % 1000).padStart(3,'0')}`;
  }
  return 'WEBVTT\n\n' + rows.map((row,index) => {
    // Platform revisions can overlap. The newer segment takes over when it begins.
    // Leave one millisecond at a handoff: Chromium may retain both cues when paused exactly at a shared boundary.
    const start = Math.max(0,row.start), end = Math.min(row.end,rows[index+1] ? rows[index+1].start - 0.001 : row.end);
    if (end <= start) return '';
    return `${stamp(start)} --> ${stamp(end)}\n${row.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\r\n]+/g,' ')}\n`;
  }).join('\n');
}

export function referrerRule(extensionId) {
  return { id: 1, priority: 1, action: { type: 'modifyHeaders', requestHeaders: [
    { header: 'Referer', operation: 'set', value: `${ORIGIN}/` }
  ] }, condition: { requestDomains: ['yanhekt.cn'], initiatorDomains: [extensionId], resourceTypes: ['xmlhttprequest', 'media', 'other'] } };
}

export function explain(error) {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return '连接超时。请确认校园网 / VPN 可用，并重试；使用代理时检查延河域名的系统代理绕过。';
  if (error instanceof TypeError) return '无法连接延河课堂。请先确认原站可访问、已登录，且校园网 / VPN 和域名直连设置正常。';
  // Avoid showing signed URLs, JWTs or private profile fields in errors.
  const message = String(error?.message || '请求失败，请重试。');
  return message.replace(/https?:\/\/\S+/g,'[请求地址]').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[登录凭据]').slice(0, 320);
}
