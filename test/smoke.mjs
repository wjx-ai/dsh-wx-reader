/**
 * 冒烟测试：验证插件模块形状 + Python 抓取脚本可通过解释器运行并返回合法 JSON。
 *
 * 用法: node test/smoke.mjs
 * 覆盖：
 *  - lib/index.js 能作为 ESM 被 import，且导出 { inject, apply }。
 *  - lib/wx_article_tool.py 可通过 python 运行（无 URL 时返回用法错误 JSON）。
 * 该脚本不访问网络，快速且确定。
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'lib', 'wx_article_tool.py');
const python = process.env.DSH_WX_READER_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

// 1) 插件模块形状
let plugin;
try {
  plugin = (await import('../lib/index.js')).default;
} catch (e) {
  console.error('[smoke] import lib/index.js failed:', e && e.message ? e.message : e);
  process.exit(1);
}
if (!plugin || !Array.isArray(plugin.inject) || typeof plugin.apply !== 'function') {
  console.error('[smoke] plugin shape invalid: expected { inject, apply }');
  process.exit(1);
}
console.log('[smoke] plugin ok: inject =', JSON.stringify(plugin.inject));

// 2) Python 脚本可执行（无 URL -> 输出用法错误 JSON，不触网）
const proc = spawnSync(python, [script], { encoding: 'utf8', timeout: 15000 });
if (proc.error) {
  console.error('[smoke] spawn python failed:', proc.error.message);
  console.error('       提示: 请确保 Python 3 在 PATH，或用环境变量 DSH_WX_READER_PYTHON 指向解释器。');
  process.exit(1);
}
const out = (proc.stdout || '').trim();
let parsed;
try {
  parsed = JSON.parse(out);
} catch (e) {
  console.error('[smoke] script output is not JSON:', out);
  process.exit(1);
}
if (typeof parsed.success !== 'boolean') {
  console.error('[smoke] bad json shape:', parsed);
  process.exit(1);
}
console.log('[smoke] script ok: success =', parsed.success, 'error =', parsed.error);

console.log('[smoke] SMOKE OK');
process.exit(0);
