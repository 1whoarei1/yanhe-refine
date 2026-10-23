// Only synthetic patterns are generated; no network or classroom media is used.
import { mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const folder = resolve(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures');
await mkdir(folder, { recursive: true });
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
function run(args) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (result.error) throw new Error('FFmpeg is required. Install it or set FFMPEG to its executable path.', { cause: result.error });
  if (result.status !== 0) throw new Error(`FFmpeg exited with ${result.status}.`);
}
run(['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25:duration=5',
  '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-g', '50',
  '-movflags', '+faststart', join(folder, 'test.mp4')]);
run(['-i', join(folder, 'test.mp4'), '-c', 'copy', '-f', 'hls', '-hls_time', '2',
  '-hls_list_size', '0', '-hls_segment_filename', join(folder, 'test%03d.ts'), join(folder, 'test.m3u8')]);
run(['-i', join(folder,'test.mp4'),'-c','copy','-f','flv',join(folder,'test.flv')]);
run(['-f', 'lavfi', '-i', 'color=c=0x183f53:s=160x90:r=2:d=120',
  '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-g', '4',
  '-movflags', '+faststart', join(folder, 'timing.mp4')]);
run(['-f','lavfi','-i','color=c=0x674d37:s=320x180:r=5:d=120','-an','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-g','10','-movflags','+faststart',join(folder,'timing-room.mp4')]);
console.log('Generated synthetic MP4/HLS and subtitle-timing fixtures in tests/fixtures.');
