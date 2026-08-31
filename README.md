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
- **可移植依赖**:Python 解释器默认取 `python`(Windows)/`python3`(其它平台),可用环境变量
  `DSH_WX_READER_PYTHON` 覆盖指向任意解释器路径。
- **清晰结果**:抓取失败/环境校验/未解析出正文都会返回可读的错误信息。

## 工作原理

1. DSH 的插件加载器(profile 的 `cordis:include`)按包名 `@wjx-ai/dsh-wx-reader` 导入本插件。
2. 插件在 `apply()` 里通过 Cordis 注入的 `tools` / `subprocess` 两个 Service,调用 `tools.register`
   注册名为 `read_wechat_article` 的动态工具。
3. 工具执行时,通过 `subprocess.spawn` 调用 `python lib/wx_article_tool.py <url>`。
4. Python 脚本用 `urllib` 拉取页面,用正则抽取 `msg_title` / `nickname` / `js_content`,
   把 HTML 转成纯文本,并把结果以单行 JSON 输出。
5. 插件解析 JSON、规整成统一的工具输出,并交给 `output.render` 渲染成易读文本。

## 环境要求

| 依赖 | 说明 |
| --- | --- |
| DSH(DeepSeek Harness) | 提供 `tools` / `subprocess` Service,并负责按 `cordis:include` 加载插件 |
| Node.js | **>= 18**(本插件为 ESM) |
| Python 3 | 仅用于抓取/解析脚本;脚本只用标准库;解释器需在 `PATH` 上,或用 `DSH_WX_READER_PYTHON` 指定 |

> 不需要任何 Python 第三方包,不需要 Selenium / 浏览器,不需要配置 API Key。

## 安装

安装分两步:①把包装进 DSH 的 profile;②在 profile 里挂载它。

### 方式一:从 npm 安装(推荐,带 @)

```powershell
dsh plugin --profile web add @wjx-ai/dsh-wx-reader
```

### 方式二:从 GitHub 直接安装

```powershell
# pnpm 会从 GitHub 拉取并 link(安装后的包名为 @wjx-ai/dsh-wx-reader)
dsh plugin --profile web add github:wjx-ai/dsh-wx-reader
```

### 方式三:本地目录安装(你已 clone 到本机)

```powershell
# 用本地路径安装(pnpm 的 file: 协议会 link 到该目录)
dsh plugin --profile web add file:C:\path\to\dsh-wx-reader
```

### 方式四:手动 link(不依赖 pnpm,Windows 示例,已验证)

```powershell
# 让包名能被解析:scoped 名是 @wjx-ai/dsh-wx-reader,放在 node_modules 的 @wjx-ai 子目录下
New-Item -ItemType Junction `
  -Path "$env:USERPROFILE\.dsh\profiles\node_modules\@wjx-ai\dsh-wx-reader" `
  -Target "C:\path\to\dsh-wx-reader"
```

### 挂载到 profile(通常无需手动,提供兜底)

本插件在 `package.json` 里声明了 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`,
因此 `dsh plugin add` 把它装好后,dsh 会把它当作一个 profile 层 **自动激活**(应用它自带的
`cordis.patch.yml`,插入 `wx-reader` 条目),无需再手动挂载。

如果你的 dsh 版本没有自动激活(例如插件是在声明 `dsh.bundle` 之前安装的),二选一:

**A. 加入 `dsh.profile.bundles`(推荐)**:在 `$env:USERPROFILE\.dsh\profiles\web\package.json` 的
`dsh.profile.bundles` 数组里加上 `"@wjx-ai/dsh-wx-reader"`(与 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` 并列)。

**B. 在 `cordis.patch.yml` 追加 insert**(本仓库已附带 `cordis.patch.yml`):

```yaml
- insert:
    - id: wx-reader
      name: '@wjx-ai/dsh-wx-reader'
```

### 重启生效

```powershell
dsh web
```

启动日志出现 `[wx-reader] registered read_wechat_article tool` 即成功。

## 使用

装好并重启后,直接让 Agent 调用工具即可:

```
请用 read_wechat_article 读取 https://mp.weixin.qq.com/s/XXXXXXXX
```

### 工具 Schema

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `url`(入参,必填) | string | 公众号文章完整链接,必须包含 `mp.weixin.qq.com` |
| `success`(出参) | boolean | 是否成功 |
| `title`(出参) | string | 文章标题 |
| `author`(出参) | string | 公众号名称 |
| `content`(出参) | string | 正文纯文本 |
| `error`(出参) | string | 失败时的错误说明 |

### 返回示例

```json
{
  "success": true,
  "url": "https://mp.weixin.qq.com/s/XXXXXXXX",
  "title": "文章标题",
  "author": "某公众号",
  "content": "正文全文……"
}
```

渲染预览会截取正文前 500 字,并附上总字数。

## 配置

### `DSH_WX_READER_PYTHON`(可选)

如果 `python` / `python3` 不在 `PATH` 上,或想明确指定解释器,设置环境变量(在启动 DSH 的终端里):

```powershell
$env:DSH_WX_READER_PYTHON = "C:\path\to\python.exe"
dsh web
```

优先级:环境变量 > 平台默认(`python` on Windows,`python3` 其它)。

## 开发

```
dsh-wx-reader/
├── lib/
│   ├── index.js            # Cordis 插件入口(ESM,注册 read_wechat_article 工具)
│   └── wx_article_tool.py  # Python 抓取+解析脚本(纯标准库)
├── test/
│   └── smoke.mjs           # 冒烟测试:验证插件形状 + 脚本可运行
├── cordis.patch.yml        # 推荐的 profile 挂载片段
├── LICENSE
└── package.json
```

### 冒烟测试

```powershell
node test/smoke.mjs
```

覆盖:插件模块能作为 ESM 导出 `{ inject, apply }`;Python 脚本可通过解释器运行并返回合法 JSON。(不访问网络。)

### 本地调试加载

改动 `lib/index.js` 后,重启 `dsh web` 即可;插件注册失败会打印
`[wx-reader] plugin activation failed; continuing without it`。

## 故障排除

| 现象 | 原因 / 处理 |
| --- | --- |
| 启动日志出现 `required service missing at apply` | `tools` / `subprocess` Service 未挂载,需在包含 `dsh-base` 的 profile 里使用 |
| 工具返回 `执行异常: spawn python ENOENT` | 找不到 Python,确保 `python` 在 `PATH`,或设置 `DSH_WX_READER_PYTHON` |
| 工具返回 `脚本无输出` | 解释器或脚本路径有误;可用此命令自测:`python lib/wx_article_tool.py <url>` |
| 返回 `微信返回环境校验页` | 微信风控/验证页,该链接可能无法通过直接 HTTP 抓取,换一个链接或稍后再试 |
| 返回 `已获取页面但未解析出正文` | 文章可能需登录、仅限微信内访问,或页面结构变化 |
| 返回 `仅支持 mp.weixin.qq.com 文章链接` | 传入的不是公众号文章链接 |

## 免责声明

本插件仅用于技术学习与合法内容整理。抓取微信公众号内容请遵守平台条款与《著作权法》,
勿用于侵权、搬运或商业用途;因使用本插件产生的一切后果由使用者自行承担。

## License

[MIT](LICENSE) © [wjx-ai](https://github.com/wjx-ai)
