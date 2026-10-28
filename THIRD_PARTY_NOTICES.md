# References and third-party notices

Yanhe Refine's own code is MIT licensed. Bundled dependencies retain their licenses.

## Inherited player and protocol references

- [1whoarei1/yanhe-replay](https://github.com/1whoarei1/yanhe-replay): the bundled `watch/` component shares the locally maintained Replay 0.5.0 playback modules, with Refine embedding and layout changes. MIT notice is included in the root LICENSE.
- [windlandneko/yanhekit](https://github.com/windlandneko/yanhekit): reference for the modern platform's course traversal, transcripts and playback signing. Initial reference revision: `a85de3ab6b0dfad6b4440775a6057ccab2881270`. Its Python scripts and skill files are not bundled or relicensed here.
- [lankerr/BIT_yanhe_download_2026](https://github.com/lankerr/BIT_yanhe_download_2026), especially `utils.py`, and its upstream [BITNP/BIT_yanhe_download](https://github.com/BITNP/BIT_yanhe_download): legacy protocol references. Copyright 2023 AuYang261 MIT notice is included in `licenses/BIT_yanhe_download.LICENSE`.

Thank you to the authors and maintainers for publishing their research and tools.

## Runtime components

| Component | Version | Purpose | Included license |
| --- | --- | --- | --- |
| hls.js | 1.7.3 | HLS playback | Apache-2.0, `watch/vendor/hls.LICENSE` |
| mpegts.js | 1.8.2 | FLV playback | Apache-2.0, `watch/vendor/mpegts.LICENSE` and `mpegts.NOTICE.txt` |
| JavaScript-MD5 | 2.19.0 | Signing | MIT, `watch/vendor/md5.LICENSE` |
| fflate | 0.8.3 | XLSX ZIP container | MIT, `licenses/fflate.LICENSE` |
| saxes | 6.0.0 | XLSX XML parsing | ISC, `licenses/saxes.LICENSE`, including inherited sax and historical notices |
| xmlchars | 2.2.0 | XML characters used by saxes | MIT, `licenses/xmlchars.LICENSE` |
| parse5 | 8.0.1 | Parse server-rendered Moodle HTML | MIT, `licenses/parse5.LICENSE` |
| entities | 8.1.0 | HTML character references used by parse5 | BSD-2-Clause, `licenses/entities.LICENSE` |

The old Lexue integration uses the site's Moodle course overview and server-rendered module pages as protocol references. It does not bundle Moodle source code. Thanks to the [Moodle project](https://github.com/moodle/moodle), [parse5](https://github.com/inikulin/parse5), and [entities](https://github.com/fb55/entities) maintainers.

The saxes 6.0.0 npm archive omits its license file; the original notice is copied from the upstream [v6.0.0 LICENSE](https://github.com/lddubeau/saxes/blob/v6.0.0/LICENSE). Browser runtime libraries are included locally; no external script CDN is used.

## Development tools

esbuild 0.28.2 (MIT) and Playwright 1.62.1 (Apache-2.0) are development dependencies, not bundled runtime code. FFmpeg generates synthetic media for tests; it is not bundled and its license depends on the installed build. Python/openpyxl are used locally for catalogue preparation only.

The personal course index is user-provided data, excluded from the public package and the code license. The code license does not grant redistribution rights to course content.

## Yanhekt-AutoSlides：协议与索引来源

感谢 [bit-admin/Yanhekt-AutoSlides](https://github.com/bit-admin/Yanhekt-AutoSlides) 的公开 session 索引、在线查询 API 及旧站元数据研究。参考修订 `746cd87ccc4da59cb838adc023200531aa379a85` 的 `share/docs/api.md` 和 `indexer/src/yanhekt.ts`；上游采用 [Apache-2.0](https://github.com/bit-admin/Yanhekt-AutoSlides/blob/746cd87ccc4da59cb838adc023200531aa379a85/LICENSE)。本项目依据公开 HTTP 契约独立编写客户端，没有复制上游实现模块、打包加密数据库或引入构建密钥。在线索引仍在完善，实际覆盖与可用性由该服务决定。

HLS playback uses the full hls.js 1.7.3 build so platform-provided alternate audio playlists can be loaded. The upstream Apache-2.0 license remains included.
