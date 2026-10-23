import { mediaUrl, streamsFrom } from './core.js';

export const liveLabels = { live: '直播中', upcoming: '未开始', ended: '已结束', replay: '回放' };

export function liveRows(tree) {
  const rows = new Map();
  function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    if ('sub_title' in node) {
      if (node.id != null && node.type === 'course_live' && String(node.playback_status) !== '1') {
        const status = String(node.sub_status);
        rows.set(String(node.id), { id: String(node.id), title: String(node.sub_title), start: Number(node.class_begin) || 0,
          mode: status === '1' ? 'live' : status === '2' ? 'upcoming' : 'ended' });
      }
      walk(node.child);
    } else Object.values(node).forEach(walk);
  }
  walk(tree);
  const order = { live: 0, upcoming: 1, ended: 2 };
  return [...rows.values()].sort((a,b) => order[a.mode] - order[b.mode] || (a.mode === 'ended' ? b.start - a.start : a.start - b.start));
}

export function lectureMode(data) {
  if (data.sub_type === 'course_live') {
    if (String(data.sub_status) === '1') return 'live';
    if (String(data.sub_status) === '2') return 'upcoming';
    if (!Object.keys(streamsFrom(data).streams).length) return 'ended';
  }
  return 'replay';
}

export function liveStreams(data) {
  const candidates = {}, streams = {};
  // Same channels used by the platform's getLivingAddress: main, PPT, students.
  for (const [field,view] of [['output','classroom'],['output_ppt','screen'],['output_student','student']]) {
    const source = data.live_url?.[field];
    const values = typeof source === 'string' ? [source] : ['m3u8','m3u8_lhd','m3u8_lsd','flv','flv_lhd','flv_lsd'].map(key => source?.[key]);
    const seen = new Set();
    for (const raw of values) {
      if (!raw) continue;
      try {
        const url = mediaUrl(raw), format = /\.m3u8$/i.test(url.pathname) ? 'hls' : /\.flv$/i.test(url.pathname) ? 'flv' : null;
        if (!format || seen.has(url.href)) continue;
        seen.add(url.href); (candidates[view] ||= []).push({ url: url.href, format });
      } catch { /* Other protocol/host candidates must never widen extension permissions. */ }
    }
    if (candidates[view]?.length) streams[view] = candidates[view][0].url;
  }
  return { streams, candidates };
}

export function liveEdge(video, hls) {
  const target = hls?.liveSyncPosition;
  if (Number.isFinite(target)) return Math.max(0,target);
  const ranges = video.seekable?.length ? video.seekable : video.buffered;
  if (!ranges?.length) return null;
  const last = ranges.length - 1;
  return Math.max(ranges.start(last),ranges.end(last) - 1);
}
