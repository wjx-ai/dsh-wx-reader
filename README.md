# @wjx-ai/dsh-wx-reader

> DeepSeek Harness(DSH)微信公众号文章阅读工具插件 —— 为 DSH 提供一个可直接调用的
> **`read_wechat_article`** 工具,输入公众号文章链接,返回标题、公众号名和正文。

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933.svg)](package.json)

---

## 简介

`@wjx-ai/dsh-wx-reader` 是 DSH 的一个 **Host 侧工具插件**。它以 Cordis 插件的形式注册一个动态工具
`read_wechat_article`,用于读取微信公众号(微信官方账号)的文章正文。

- 只需输入 `mp.weixin.qq.com/s/...` 的链接。
- 返回文章标题、公众号作者、正文文本(纯文本)。
- 适用场景:让 Agent 直接阅读公众号文章内容并据此回答问题、总结、改写等。

## 特性

- **零配置上手**:装好后即可用,Python 解析脚本随包分发、由 `__dirname` 定位,无机器绝对路径。
- **纯标准库解析**:抓取与解析由 `lib/wx_article_tool.py` 完成,只依赖 Python 标准库
  (`urllib` / `re` / `html` / `json`),**无任何第三方 Python 包**。
- **失败降级保护**:插件注册全程 `try/catch`,即使脚本或服务异常也不会拖垮 DSH 启动。
- **清晰结果**:抓取失败/环境校验/未解析出正文都会返回可读的错误信息。

## 环境要求

| 依赖 | 说明 |
| --- | --- |
| DSH(DeepSeek Harness) | 提供 `tools` / `subprocess` Service,并负责按 `cordis:include` 加载插件 |
| Node.js | 运行本插件 **>= 18**([ESM](https://nodejs.org/api/esm.html)) |
| Python 3 | 仅用于抓取/解析脚本;脚本只用标准库;解释器需在 `PATH` 上,或用 `DSH_WX_READER_PYTHON` 指定 |

> 不需要任何 Python 第三方包,不需要 Selenium / 浏览器,不需要配置 API Key。

## 安装

```powershell
dsh plugin --profile web add @wjx-ai/dsh-wx-reader
```

或从 GitHub 直接安装:

```powershell
dsh plugin --profile web add github:wjx-ai/dsh-wx-reader
```

`dsh plugin add` 会把包装进 profile 并自动激活(包内 `cordis.patch.yml` 会插入 `wx-reader` 条目),然后 `dsh web` 重启生效,启动日志出现 `[wx-reader] registered read_wechat_article tool` 即成功。

## 使用

装好并重启后,直接让 Agent 调用 `read_wechat_article` 工具读取公众号文章链接即可。

## 免责声明

本插件仅用于技术学习与合法内容整理。抓取微信公众号内容请遵守平台条款与《著作权法》,
勿用于侵权、搬运或商业用途;因使用本插件产生的一切后果由使用者自行承担。

## License

[MIT](LICENSE) © [wjx-ai](https://github.com/wjx-ai)
