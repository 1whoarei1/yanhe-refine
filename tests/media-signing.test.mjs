import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {signedUrl} from '../src/watch/core.js';
import {YanheApi} from '../src/watch/api.js';

const profile = {id: 123, tenant_id: 21, phone: '13800000000'};
const hash = value => createHash('md5').update(value).digest('hex');
const timestamp = 1793952000;

test('live manifests and segments receive the same account signature as replay media', () => {
  for (const path of ['/live/classroom.m3u8', '/live/classroom-1.ts', '/live/classroom.flv', '/play/course/screen.m3u8']) {
    const address = new URL(signedUrl('https://aita.yanhekt.cn' + path, profile, hash, timestamp));
    const digest = hash(path + '12321' + [...profile.phone].reverse().join('') + timestamp);
    assert.equal(address.searchParams.get('t'), `123-${timestamp}-${digest}`);
  }
});

test('refreshing media signatures preserves gateway routing and client parameters', () => {
  for (const path of ['/live/screen.m3u8', '/play/course/screen.m3u8']) {
    const raw = `https://aita.yanhekt.cn${path}?host=gateway.example&port=443&clientUUID=fixture&t=expired&t=duplicate`;
    const address = new URL(signedUrl(raw, profile, hash, timestamp));
    assert.equal(address.searchParams.get('host'), 'gateway.example');
    assert.equal(address.searchParams.get('port'), '443');
    assert.equal(address.searchParams.get('clientUUID'), 'fixture');
    assert.equal(address.searchParams.getAll('t').length, 1);
    assert.notEqual(address.searchParams.get('t'), 'expired');
  }
  const raw = 'https://cvideo.yanhekt.cn/course/file.mp4?token=provided';
  assert.equal(signedUrl(raw, null, hash, timestamp), raw);
  assert.throws(() => signedUrl('https://aita.yanhekt.cn/live/screen.m3u8', null, hash, timestamp), /登录信息/);
});

test('the normal media probe signs live URLs without dropping gateway parameters', async () => {
  const api = new YanheApi({hash, fetcher: async (raw, options) => {
    const address = new URL(raw);
    assert.equal(options.method, 'HEAD');
    assert.equal(address.searchParams.get('host'), 'gateway.example');
    assert.equal(address.searchParams.get('port'), '443');
    assert.match(address.searchParams.get('t'), /^123-\d+-[a-f0-9]{32}$/);
    return new Response(null, {status: 200, headers: {'content-type': 'application/vnd.apple.mpegurl'}});
  }});
  api.profile = profile;
  const result = await api.probeMedia('https://aita.yanhekt.cn/live/screen.m3u8?host=gateway.example&port=443');
  assert.equal(result.ok, true);
});
