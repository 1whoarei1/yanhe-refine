# 延河焕新

在新版延河课堂中查看课程、直播、回放、资料和待办，并整合新旧乐学。支持 Edge / Chrome。

[插件发布页](https://github.com/1whoarei1/yanhe-refine/releases/latest) · [更新记录](CHANGELOG.md)

## 旧版 Session 方案下架说明（2026-11-02）

学校更新后，当前依赖旧延河课程、Session 和视频元数据接口的检索与回放方案已失效。本页已移除旧版 Session 目录下载入口并停止推荐；请勿再依赖旧目录恢复播放，也不要将目录中的课次记录理解为仍可观看的录像。

目录只保存课程与课次元数据，不含视频地址或视频文件。现有反馈不足以证明全部视频文件已删除，已保存的媒体与历史目录也不能保证当前可用。相关情况见 [AutoSlides 讨论](https://github.com/bit-admin/Yanhekt-AutoSlides/issues/43)。

本次为发布说明与下载入口调整，**不修改插件源码**。已经安装的 1.0.1 可能仍显示旧版入口或包含旧目录，这些旧版功能不再作为可用方案推荐；已有浏览器数据、收藏和观看记录不会因此被删除。新版延河及新旧乐学不在本次下架范围内；这不代表本次重新验证了它们的全部功能。

## 功能

- 搜索新版课程、教师或粘贴新版课程链接；可用内容以平台当前返回和账号权限为准。
- 双画面观看；直播支持三画面，左侧主画面、右侧上下两路。声音来源单独选择。
- 倍速、字幕、音量、网页全屏和屏幕全屏；侧栏、课次栏与字幕表可收起。
- 汇总新旧乐学的资料与待办，按学期筛选；视频下载在独立标签页进行。
- 签到模式显示最新缓存画面，不自动签到；可随时切回原站。
- 设置中可检查四个平台的连接状态、检查插件更新，访问 AutoSlides 与 BITShare。

## 安装与更新

1. 下载插件压缩包，解压到固定文件夹。
2. 打开 `edge://extensions` 或 `chrome://extensions`，开启「开发者模式」，选择「加载解压缩的扩展」。
3. 选择含 `manifest.json` 的文件夹，登录[新版课堂](https://aita.yanhekt.cn/)即可使用新版功能。

更新时可在设置中「检查更新」，下载新版后替换原扩展文件，重新加载扩展，再刷新课堂页面。使用乐学资料与待办前，请分别登录新乐学和旧乐学。

## 导入课程目录

在「设置 → 导入课程表」中导入新版 `课程目录.json`，历史新版快照收录 **27,369 门课程**。目录用于离线检索，不代表当前全部课程或播放权限。

**旧版 `旧版课次目录.json` / `legacy-session-index.json` 已停止推荐，本页不再提供其下载入口。** 历史发布包、已下载副本或浏览器中可能仍保留该文件，请不要继续导入或据此判断回放可用；本次不删除用户本地数据。

## 致谢

感谢 [bit-admin / Yanhekt-AutoSlides](https://github.com/bit-admin/Yanhekt-AutoSlides) 提供旧版课次索引器，感谢 [yanhekit](https://github.com/windlandneko/yanhekit) 及下载工具作者提供协议参考。

[MIT 许可证](LICENSE) · [第三方声明](THIRD_PARTY_NOTICES.md) · [独立回放助手](https://github.com/1whoarei1/yanhe-replay) · [接口参考](https://github.com/1whoarei1/yanhe-api-reference) · [BITShare 资料分享站](https://bitshare.com.cn/)
