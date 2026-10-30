# 延河焕新

在新版、旧版延河课堂中，一站查看课程、直播、回放、资料和待办。支持 Edge / Chrome。

[下载插件 0.10.5](https://github.com/1whoarei1/yanhe-refine/releases/latest) · [下载最新旧版课次目录](https://github.com/1whoarei1/yanhe-refine/releases/download/v0.10.5/legacy-session-index-20261030.json) · [更新记录](CHANGELOG.md)

## 功能

- 搜索课程、教师或粘贴课程链接，查找往年回放。
- 双画面观看；直播支持三画面，左侧主画面、右侧上下两路。声音来源单独选择。
- 倍速、字幕、音量、网页全屏和屏幕全屏；侧栏、课次栏与字幕表可收起。
- 汇总新旧乐学的资料与待办，按学期筛选；视频下载在独立标签页进行。
- 签到模式显示最新缓存画面，不自动签到；可随时切回原站。

## 安装与更新

1. 下载插件压缩包，解压到固定文件夹。
2. 打开 `edge://extensions` 或 `chrome://extensions`，开启「开发者模式」，选择「加载解压缩的扩展」。
3. 选择含 `manifest.json` 的文件夹，登录[新版课堂](https://aita.yanhekt.cn/)或[旧版课堂](https://www.yanhekt.cn/)即可使用。

更新时替换原扩展文件，重新加载扩展，再刷新课堂页面。使用乐学资料与待办前，请分别登录新乐学和旧乐学。

## 导入课程目录

在「设置 → 导入课程表」中分别导入：

- **新版**：压缩包内的 `课程目录/课程目录.json`，收录 **27,369 门课程**。
- **旧版**：压缩包内的 `课程目录/旧版课次目录.json`，收录 **57,735 门课程、813,946 个课次**（2026-10-30 快照，持续采集中）。

两份目录均随插件提供。更新旧版目录也可单独下载，重新导入即可，回放助手也可使用。

## 致谢

感谢 [bit-admin / Yanhekt-AutoSlides](https://github.com/bit-admin/Yanhekt-AutoSlides) 提供旧版课次索引器，感谢 [yanhekit](https://github.com/windlandneko/yanhekit) 及下载工具作者提供协议参考。

[MIT 许可证](LICENSE) · [第三方声明](THIRD_PARTY_NOTICES.md) · [独立回放助手](https://github.com/1whoarei1/yanhe-replay) · [接口参考](https://github.com/1whoarei1/yanhe-api-reference)
