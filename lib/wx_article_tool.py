#!/usr/bin/env python3
"""
微信公众号文章抓取工具（HTTP 版）
纯标准库：urllib 拉取 + 正则解析，无 Selenium 依赖，任意 Python 3 可运行。
用法: python wx_article_tool.py <url>
输出: 单行 JSON
"""

import sys
import json
import re
import html as h
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")


def fetch_html(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", "ignore")


def extract(html_text):
    m = (re.search(r"var msg_title = '([^']*)'", html_text)
         or re.search(r'<meta property="og:title" content="([^"]*)"', html_text)
         or re.search(r'<h1[^>]*id="activity-name"[^>]*>([\s\S]*?)</h1>', html_text))
    title = h.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip() if m else ""

    m = (re.search(r'var nickname = "([^"]*)"', html_text)
         or re.search(r'id="js_name"[^>]*>\s*([^<]+?)\s*<', html_text))
    author = h.unescape(m.group(1)).strip() if m else ""

    i = html_text.find('id="js_content"')
    if i < 0:
        return title, author, ""

    gt = html_text.find(">", i)
    seg = html_text[gt + 1:] if gt > 0 else html_text[i:]

    ends = []
    for marker in ("<script", 'id="js_tags"', "rich_media_tool", 'id="content_bottom_area"'):
        j = seg.find(marker, 20)
        if j > 0:
            ends.append(j)
    if ends:
        seg = seg[: min(ends)]

    seg = re.sub(r"<script[\s\S]*?</script>", " ", seg, flags=re.I)
    seg = re.sub(r"<style[\s\S]*?</style>", " ", seg, flags=re.I)
    seg = re.sub(r"<(br|/p|/div|/li|/h[1-6]|/tr|/section)[^>]*>", "\n", seg, flags=re.I)
    seg = re.sub(r"<[^>]+>", "", seg)
    seg = h.unescape(seg)
    lines = [ln.strip() for ln in seg.split("\n")]
    lines = [ln for ln in lines if ln]
    return title, author, "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "用法: python wx_article_tool.py <url>"}))
        return
    url = sys.argv[1]
    try:
        raw = fetch_html(url)
    except Exception as e:
        print(json.dumps({"success": False, "url": url,
                          "error": "HTTP 拉取失败: %s: %s" % (type(e).__name__, e)}))
        return

    if "环境异常" in raw and "js_content" not in raw:
        print(json.dumps({"success": False, "url": url,
                          "error": "微信返回环境校验页，需要更换抓取方式"}))
        return

    title, author, content = extract(raw)
    if not content:
        print(json.dumps({"success": False, "url": url, "title": title, "author": author,
                          "error": "已获取页面但未解析出正文（可能需要登录/仅限微信内访问）"}))
        return

    print(json.dumps({"success": True, "url": url, "title": title,
                      "author": author, "content": content}, ensure_ascii=False))


if __name__ == "__main__":
    main()