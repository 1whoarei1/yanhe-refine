# Yanhe Refine · 延河焕新

直接在延河课堂原站整合课程、直播、回放、资料和待办，支持新版与旧版课堂。

**当前版本：0.10.0** · Edge / Chrome Manifest V3

[下载正式版](https://github.com/1whoarei1/yanhe-refine/releases/latest) · [独立回放助手](https://github.com/1whoarei1/yanhe-replay) · [接口参考](https://github.com/1whoarei1/yanhe-api-reference) · [更新记录](CHANGELOG.md)

## 安装或更新

1. 下载 Release 中的 `yanhe-refine-0.10.0.zip` 并解压到固定文件夹。
2. 在 `edge://extensions` 或 `chrome://extensions` 开启开发者模式，选择「加载解压缩的扩展」，选中含 `manifest.json` 的文件夹。
3. 打开 [新版课堂](https://aita.yanhekt.cn/) 或 [旧版课堂](https://www.yanhekt.cn/)，沿用原站登录状态。
4. 更新已有安装时备份原目录、替换扩展文件，在扩展管理页重新加载，再刷新课堂页面。

## 两份可导入目录

正式 ZIP 的 `课程目录/` 中附带：

| 文件 | 用途 |
| --- | --- |
| `课程目录.json` | 新版课程名称、教师、学期和编号 |
| `旧版课次目录.json` | 我们采集的旧版课程及其明确归属的 session 列表 |
| `导入说明.txt` | 导入步骤、覆盖范围和快照时间 |

本次快照：新版 **27,369 门课程**；旧版 **14,435 门课程、132,050 个 session**。旧版生成时间为 `2026-10-28T10:10:33Z`，采集仍在继续，未收录不代表没有回放。更新目录时重新导入同类文件即可，浏览器会保留已导入目录。

旧版按原站返回的 course ID 聚合 session，课次编号可以不连续。课程、session 和 video 是不同编号；同号不能互相替代。目录不含登录信息、观看记录、成绩、作业或媒体地址，旧版 XLSX 表不分发。目录作为 Release 资产提供，不提交源码仓库。

在插件的「设置」→「导入课程表」中，依次选择两份 JSON。新版目录用于离线找课，旧版课次目录用于课程检索与课次归属；观看时仍由原站校验登录、媒体及权限。

## 使用

- 统一导航提供今天、课程、资料和待办，主侧栏、课次栏及字幕表可以分别隐藏。
- 可粘贴新版课程/课次链接，或旧站 `course`、`session`、`live` 链接。旧站回放以 session 为目标，支持一节课的多个视频片段。
- 课次页的「原站」和左下角「恢复原版」会记住原版模式；原站链接继续正常使用，需要时再点「返回焕新版」。
- 视频底栏集中显示播放、进度、倍速、字幕、音量及全屏。双画面可看任意两路；直播三画面为左侧主画面、右侧上下两路。
- 声音独立于画面，只播放一路，支持自动、屏幕、教室或学生来源。音量悬停显示滑块；字幕随实际画面定位并避开显示中的底栏。
- 网页全屏与屏幕全屏均保留多画面。暂停、拖动、字幕偏移校准与音量统一控制。
- 签到模式展示最新已缓存帧，声音保持连续；模式只控制画面，不提交点名或签到请求。
- 「设置」中的直播平台切换按课程名、教师、学期及上课时间核对新旧站，多个候选由用户选择，分别使用两站自己的编号。
- 标题栏保留下载视频入口，下载页在新标签打开；支持各画面、HLS/FLV/MP4、下载进度、取消和失败重试。
- 普通文件作业可通过新乐学上传并提交，结果未知时先刷新确认；其它活动保留平台入口。资料、附件和已关联的新旧乐学课程保持独立来源；新乐学结构化学年/学期正确解析，未知学期不生成无效筛选项。

浏览器分别记住两个域名的缩放比例；如显示大小不同，可在相应页面按 Ctrl+0 恢复 100%。

## 开发与验证

```sh
npm ci
npm run build
npm test
npm run test:browser:layout
npm run test:browser:streams
npm run test:browser:imports
```

浏览器回归使用隔离配置和合成媒体，不替代当前真实课堂的播放验收。导入测试有本地发布目录时使用实际两份 JSON，否则使用合成夹具。

普通源码构建不含目录数据。将 Release 两份 JSON 分别放到 `local-data/release-catalog.json`、`local-data/release-session-index.json` 后，可运行 `python tools/package.py --with-imports` 生成同样的正式包。个人配置、测试快照和浏览器状态不进入 Git。

## 来源与致谢

公开感谢 **[bit-admin / Yanhekt-AutoSlides](https://github.com/bit-admin/Yanhekt-AutoSlides)** 提供 session 索引实现、在线索引协议及旧站元数据研究。发布包中的旧版快照来自我们使用其开源索引器独立采集的数据，并非解密上游 Release。

同时感谢 [yanhekit](https://github.com/windlandneko/yanhekit) 和原有下载实现提供的协议参考。第三方库、来源、许可证与修改范围见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本项目采用 MIT 许可证。
