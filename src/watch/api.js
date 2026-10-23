import { ORIGIN, tokenFromCookie, replayRows, streamsFrom, signedUrl, subtitleRows } from './core.js';
import { liveRows, lectureMode, liveStreams } from './live-core.js';

class AuthError extends Error {}

export class YanheApi {
  constructor({ fetcher = globalThis.fetch.bind(globalThis), cookies = globalThis.chrome?.cookies, tabs = globalThis.chrome?.tabs, hash = globalThis.md5 } = {}) {
    this.fetcher = fetcher; this.cookies = cookies; this.tabs = tabs; this.hash = hash;
    this.profile = null; this.account = null; this.token = null; this.authAt = 0;
  }
  reset() { this.profile = null; this.account = null; this.token = null; this.authAt = 0; }
  async json(path, params = {}, { signal, profile = false, headers = {}, codes = [0,10002] } = {}) {
    const url = new URL(path, ORIGIN);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    const timeout = AbortSignal.timeout(18000);
    const response = await this.fetcher(url.href, { credentials: 'include', redirect: 'error', cache: 'no-store',
      headers: { ...headers, ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    if ([401,403].includes(response.status)) { this.reset(); throw new AuthError('登录已失效，或当前账号没有访问权限。请打开延河课堂登录后重试。'); }
    if (!response.ok) throw new Error(`延河课堂返回 HTTP ${response.status}，请稍后重试。`);
    const body = await response.json();
    if (profile) {
      if (Number(body.code) !== 200 || !body.params) { this.reset(); throw new AuthError('登录已失效。请在同一浏览器登录新版延河课堂，再返回助手。'); }
    } else if (!codes.includes(Number(body.code))) {
      throw new Error(`延河课堂未能提供此资源（状态 ${Number(body.code) || '未知'}）。请核对新版课程 ID 和课程访问权限。`);
    }
    return body;
  }
  async authenticate({ signal, force = false } = {}) {
    if (!force && this.profile && Date.now() - this.authAt < 240000) return;
    if (!this.cookies) throw new Error('请从已安装的扩展中打开助手。');
    // A root URL filter omits cookies scoped to /portal or another login path.
    const cookies = await this.cookies.getAll({ domain: 'yanhekt.cn', name: '_token' });
    const values = cookies.filter(cookie => ['aita.yanhekt.cn','.aita.yanhekt.cn','yanhekt.cn','.yanhekt.cn'].includes(cookie.domain)).map(cookie => cookie.value);
    if (this.tabs) {
      try {
        const pages = await this.tabs.query({ url: [ORIGIN + '/*'] });
        const results = await Promise.allSettled(pages.slice(0,8).map(page => this.tabs.sendMessage(page.id, { type: 'READ_AUTH_COOKIE' }, { frameId: 0 })));
        for (const result of results) if (result.status === 'fulfilled' && Array.isArray(result.value?.values)) values.push(...result.value.values.slice(0,8));
      } catch { /* Already-open pages may need a refresh after the extension updates. */ }
    }
    const candidates = [...new Set(values.map(tokenFromCookie).filter(Boolean))].slice(0,8);
    if (!candidates.length) {
      this.reset();
      throw new Error('未读到当前浏览器的延河登录状态。请保持已登录的课堂网页打开并刷新该页，再点读取课程；网页和助手需在同一 Edge 个人资料中。');
    }
    this.reset();
    for (const token of candidates) {
      signal?.throwIfAborted(); this.token = token;
      let body;
      try { body = await this.json('/userapi/v1/infosimple', {}, { signal, profile: true }); }
      catch (error) { this.reset(); if (error instanceof AuthError) continue; throw error; }
      const { id, tenant_id, phone } = body.params;
      if (id == null || tenant_id == null || phone == null) { this.reset(); throw new Error('当前账号的播放信息不完整，请在原站重新登录。'); }
      this.profile = { id, tenant_id, phone }; this.account = body.params.account; this.authAt = Date.now(); return;
    }
    throw new Error('已找到登录凭据，但平台未接受。请刷新已登录的课堂网页；若原站也提示登录失效，请重新登录后读取课程。');
  }
  async course(id, signal) {
    await this.authenticate({ signal });
    const { data } = await this.json('/courseapi/v3/multi-search/get-course-detail', { course_id: id }, { signal });
    if (!data) throw new Error('未找到课程详情，请核对新版课程 ID。');
    return { id, title: String(data.title || '课程回放'), teacher: String(data.realname || ''), term: String(data.term_name || ''), replays: replayRows(data.sub_list), lives: liveRows(data.sub_list) };
  }
  async livePagePermission(courseId, subId, signal) {
    if (!/^\d{1,12}$/.test(String(courseId)) || !/^\d{1,12}$/.test(String(subId))) throw new Error('直播课程或课次 ID 无效。');
    await this.authenticate({ signal });
    if (!this.account) return null;
    const { data } = await this.json(`/coursesourceapi/course/study-auth/${courseId}/${subId}`, {}, {
      signal, codes: [200], headers: { 'Tenant-Id': String(this.profile.tenant_id), username: String(this.account) }
    });
    // The page flag and the media service have distinct behavior on the platform.
    // Preserve it as diagnostic metadata; playback still checks actual media responses.
    return typeof data?.hasPermission === 'boolean' ? data.hasPermission : null;
  }
  async lecture(courseId, subId, signal) {
    await this.authenticate({ signal });
    const { data } = await this.json('/courseapi/v3/portal-home-setting/get-sub-info', { course_id: courseId, sub_id: subId }, { signal });
    if (!data) throw new Error('该课次尚无视频信息。');
    const mode = lectureMode(data);
    if (mode === 'live' || mode === 'upcoming') {
      const pagePermission = await this.livePagePermission(courseId,subId,signal);
      return { duration: 0, mode, pagePermission, title: String(data.sub_title || ''), start: Number(data.start_at) || 0,
        ...(mode === 'live' ? liveStreams(data) : { streams: {}, candidates: {} }) };
    }
    return { ...streamsFrom(data), mode, title: String(data.sub_title || '') };
  }
  async subtitles(subId, signal) {
    const body = await this.json('/courseapi/v3/web-socket/search-trans-result', { sub_id: subId, format: 'json' }, { signal });
    return subtitleRows(body);
  }
  async probeMedia(url, signal) {
    const timeout = AbortSignal.timeout(12000);
    const response = await this.fetcher(this.sign(url), { method: 'HEAD', credentials: 'include', redirect: 'error', cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    // Some servers do not implement HEAD. Let the actual player try those sources.
    const unsupported = [405,501].includes(response.status);
    const type = response.headers.get('content-type') || '';
    return { status: response.status, ok: unsupported || (response.ok && !/text\/html|application\/json/i.test(type)), type };
  }
  sign(url) { return signedUrl(url, this.profile, this.hash); }
}
