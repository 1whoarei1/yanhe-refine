# Yanhe Desk · 延河学习台

给学生用的延河课堂工作台。入口只有「今天、课程、资料、待办」，播放器位于课程内部。

本地开发版 **0.4.0**，尚未发布。支持 Edge / Chrome Manifest V3。

## 已实现

- 今天：按日期查看本人课表，进入对应直播课次，继续上次回放。
- 课程：搜索课程、教师、ID，按新旧平台、学期、学院筛选，收藏、最近观看。
- 同师往年 / 同课老师：利用本地课程目录与平台相关课程查找往年教学班，保留新旧站独立身份。
- 观看：嵌入原回放助手，支持 MP4、HLS、FLV、画面切换、倍速、播放进度、歌词式平台字幕和手动时间校准。
- 资料：合并本人课堂资料和新乐学已发布课件，查看附件信息，进入原站课件。
- 待办：读取本人新乐学课程中的已发布作业，区分未交、已交、小组及截止时间；进入原站完成操作。
- 设置：导入 XLSX / JSON 课程目录，导入导出进度、字幕校准、收藏与课程关联。

无需本地服务，不执行 ASR，不下载整段视频，不写入作业或提交状态，不采集成绩。媒体在点击播放后才请求。

## 使用

1. 解压发布包，选择直接包含 `manifest.json` 的文件夹加载扩展。
2. 在同一浏览器个人资料中登录延河课堂；读取资料和待办还需登录新乐学。更新后刷新已打开的课堂页。
3. 点击扩展图标，或课堂页右下角入口。完整课程、直播和课次链接可直接粘贴到搜索框。

扩展管理页：Edge 为 `edge://extensions`，Chrome 为 `chrome://extensions`。开发人员模式下选择「加载解压缩的扩展」。更新现有文件夹后，点击该扩展的重新加载按钮。

搜索纯数字会检索新旧两个命名空间；完整链接精确识别平台。旧站 `/live/<直播编号>`、`/session/<课次编号>` 会先解析所属课程，避免将直播或课次编号错作课程 ID。旧站入口用于定位所属课程及回放；直播媒体适配以新版接口为准。

## 课程目录与隐私

目录属于本地索引，并非实时全校课程总量。个人构建使用用户已有的 79,564 条旧站和 27,369 条新版记录，共 106,933 条身份记录；相同课程在不同年份、教学班与平台上分别保留。新版检索结果会更新本地索引，目录无法证明某门课一定有录播或可播放。

课程目录保存在 IndexedDB 中，收藏、进度与偏移保存在当前扩展的本地存储。原站登录凭据仅在内存中使用，记录导出采用字段白名单；无遥测与外部脚本 CDN。

- `extension/private-catalog.json`、`local-data/`、`dist/`、测试截图和个人资料均已排除出版本控制。
- 普通发布包不含个人课程索引；个人包含用户已有索引，仅供本地使用。
- 新乐学只读取正常账号的所学课程与已发布活动，附件读取必须先来自这些活动。
- 课堂和新乐学以原站课程关联 ID 或用户手动关联连接，不按同名课程自动猜测。
- 某一来源不可用时保留其它来源的结果，提交状态不可确认时不显示为「未交」。

网页许可字段与媒体服务的响应可能不同。播放器保留许可字段，实际播放仍依赖媒体服务返回的有效资源；未伪造身份、角色、许可字段或服务端结果。网络、登录、接口变化、编码和资源失效仍可能影响使用。

## 开发与测试

需要 Node.js 20+；本地目录整理与打包需要 Python 3，读取现有 XLSX 的辅助脚本还需 openpyxl。

```sh
npm ci
npm run build
npm test
npm run test:browser
python tools/package.py
python tools/package.py --personal
```

源码在 `src/`；生成的 `extension/` 可直接加载。`npm run catalog` 将本机已有课程目录整理为私有种子，文件路径见 `tools/prepare-catalog.py`。不提供遍历平台课程编号的操作。

浏览器测试启动独立临时 Edge 个人资料，加载真实课程目录，模拟平台的普通读取接口，播放本地合成媒体。可用 `BROWSER_EXECUTABLE` 指定其它 Chromium 浏览器，`EXTENSION_PATH` 指定待验收构建；测试结果位于 `test-results/`。媒体样本沿用同级 `yanhe-replay-extension/tests/fixtures`，由其 FFmpeg 工具生成。测试不代表已经完成真实新乐学会话或真实直播长时间验收。

## 参考与致谢

本项目在 **[1whoarei1/yanhe-replay](https://github.com/1whoarei1/yanhe-replay)** 的本地 0.3.1 播放模块上增加学生工作台。感谢以下项目作者与维护者：

- **[windlandneko/yanhekit](https://github.com/windlandneko/yanhekit)**：新版课程、平台字幕、媒体签名与接口使用方法的主要参考。
- **[lankerr/BIT_yanhe_download_2026](https://github.com/lankerr/BIT_yanhe_download_2026)** 与上游 **[BITNP/BIT_yanhe_download](https://github.com/BITNP/BIT_yanhe_download)**：旧站请求头、播放路径签名和短期播放凭据参考。
- **[video-dev/hls.js](https://github.com/video-dev/hls.js)**、**[xqq/mpegts.js](https://github.com/xqq/mpegts.js)**：浏览器 HLS / FLV 播放。
- **[blueimp/JavaScript-MD5](https://github.com/blueimp/JavaScript-MD5)**：平台签名计算。
- **[101arrowz/fflate](https://github.com/101arrowz/fflate)**、**[lddubeau/saxes](https://github.com/lddubeau/saxes)**：浏览器本地 XLSX 目录解析；感谢 saxes 的上游 sax 及 xmlchars。
- **[evanw/esbuild](https://github.com/evanw/esbuild)**、**[microsoft/playwright](https://github.com/microsoft/playwright)**、**[FFmpeg](https://ffmpeg.org/)**：构建与验证。

具体组件版本和许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本项目代码采用 [MIT License](LICENSE)；课程内容和第三方组件保留各自权利。独立社区项目，与平台或学校无隶属关系。
