/**
 * DSH 微信公众号文章阅读工具插件 —— Host 端
 *
 * 注册 read_wechat_article 动态工具：通过 HTTP 拉取 + 解析公众号文章正文。
 * 解析交给 lib/wx_article_tool.py（纯 Python 标准库，无第三方依赖），
 * 驱动脚本与实际抓取均由本插件在启动时通过 ctx.subprocess 调用。
 *
 * 可移植性：
 *  - Python 解释器默认取 PATH 上的 `python`（Windows）/`python3`（其它平台），
 *    可用环境变量 DSH_WX_READER_PYTHON 覆盖（指向解释器绝对路径）。
 *  - 抓取脚本路径由本文件目录（__dirname）相对定位，随包分发，无需机器绝对路径。
 *
 * 依赖 DSH Host 提供的 `tools`、`subprocess` 两个 Service（经 Cordis 注入）。
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Python 解释器：优先环境变量，否则用平台默认
const PYTHON = process.env.DSH_WX_READER_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
// 抓取脚本随包定位
const SCRIPT = join(__dirname, 'wx_article_tool.py');

function apply(ctx) {
  // 任何注册失败都绝不能拖垮 host 启动：整段包在 try/catch 中，异常时
  // 仅记录日志并降级为「不注册工具」，保证服务照常启动。
  try {
    const subprocess = ctx.subprocess;
    const tools = ctx.tools;
    if (!subprocess || !tools) {
      console.error('[wx-reader] required service missing at apply: subprocess=%s tools=%s', !!subprocess, !!tools);
      return;
    }

    const toolDef = {
      name: 'read_wechat_article',
      description: '读取微信公众号文章内容。输入 mp.weixin.qq.com 的文章 URL，返回文章标题、公众号名称和完整正文文本。HTTP 拉取 + 正文解析，执行约需 3-10 秒。',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '微信公众号文章的完整 URL，例如 https://mp.weixin.qq.com/s/xxx' }
        },
        required: ['url'],
        additionalProperties: false
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            url: { type: 'string' },
            title: { type: 'string' },
            author: { type: 'string' },
            content: { type: 'string' },
            error: { type: 'string' }
          },
          additionalProperties: false
        },
        render: (args, value) => {
          const r = value && typeof value === 'object' ? value : {};
          let text;
          if (!r.success) {
            text = '❌ 抓取失败: ' + (r.error || '未知错误');
          } else {
            const c = r.content || '';
            const preview = c.length > 500 ? c.slice(0, 500) + '\n…(正文共 ' + c.length + ' 字，此为预览)' : c;
            text = '✅ ' + (r.title || '(无标题)') + (r.author ? '\n公众号: ' + r.author : '') + '\n字数: ' + c.length + '\n---\n' + preview;
          }
          return [{ type: 'text', text: String(text) }];
        },
        presentationMeta: (args, value) => ({})
      },
      async execute(args) {
        const trace = [];
        try {
          const url = args && typeof args.url === 'string' ? args.url : '';
          if (!url.includes('mp.weixin.qq.com')) {
            return { success: false, url: url, title: '', author: '', content: '', error: '仅支持 mp.weixin.qq.com 文章链接' };
          }

          const handle = subprocess.spawn({
            argv: [PYTHON, SCRIPT, url],
            cwd: __dirname,
            stdio: {
              stdin: 'ignore',
              stdout: { maxBytes: 262144, spill: { maxBytes: 16777216 } },
              stderr: { maxBytes: 65536, spill: { maxBytes: 16777216 } }
            },
            graceMs: 3000
          });
          trace.push('spawned');

          const outcome = await handle.done;
          const so = handle.collected && handle.collected.stdout ? handle.collected.stdout.readFrom(0) : null;
          const se = handle.collected && handle.collected.stderr ? handle.collected.stderr.readFrom(0) : null;
          const stdout = so ? so.text : '';
          const stderr = se ? se.text : '';
          const exitCode = outcome && outcome.exitCode !== undefined ? outcome.exitCode : 'unknown';
          trace.push('exit=' + exitCode, 'out=' + stdout.length + 'B');

          const trimmed = stdout.trim();
          if (!trimmed) {
            return { success: false, url: url, title: '', author: '', content: '', error: '脚本无输出 exit=' + exitCode + ' stderr=' + (stderr.slice(0, 300) || '空') };
          }

          try {
            const parsed = JSON.parse(trimmed);
            return {
              success: parsed.success === true,
              url: typeof parsed.url === 'string' ? parsed.url : url,
              title: typeof parsed.title === 'string' ? parsed.title : '',
              author: typeof parsed.author === 'string' ? parsed.author : '',
              content: typeof parsed.content === 'string' ? parsed.content : '',
              error: typeof parsed.error === 'string' ? parsed.error : ''
            };
          } catch (pe) {
            return { success: false, url: url, title: '', author: '', content: '', error: '输出非 JSON: ' + trimmed.slice(0, 200) + ' [trace: ' + trace.join('; ') + ']' };
          }
        } catch (e) {
          const msg = e && e.message ? e.message : String(e);
          return { success: false, url: '', title: '', author: '', content: '', error: '执行异常: ' + msg.slice(0, 300) + ' [trace: ' + trace.join('; ') + ']' };
        }
      }
    };

    const dispose = tools.register(toolDef);
    console.log('[wx-reader] registered read_wechat_article tool');
    return dispose;
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    console.error('[wx-reader] plugin activation failed; continuing without it: ' + msg.slice(0, 400));
    return;
  }
}

export default { inject: ['tools', 'subprocess'], apply };
