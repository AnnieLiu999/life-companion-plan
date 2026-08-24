#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
每日财经资讯 → 微信推送脚本
支持两种通道（一次性凭证，可长期复用）：
  A. PushPlus（推到个人微信）：  python3 wechat_push.py --pushplus <TOKEN>
  B. 企业微信群机器人 webhook：  python3 wechat_push.py --wecom <WEBHOOK_URL>

不指定通道时仅打印文案（调试用）。
依赖：仅 Python 标准库（urllib）。
"""
import json
import os
import sys
import urllib.request
import urllib.parse

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(_HERE, "..", "data", "finance-news.json")


def load():
    return json.load(open(DATA, encoding="utf-8"))


def fmt(v, suffix="", nd=2):
    if v is None:
        return "—"
    try:
        return f"{v:+.{nd}f}{suffix}" if isinstance(v, (int, float)) else str(v)
    except Exception:
        return str(v)


def fmt_val(v, nd=2):
    """价格/数值不带符号，仅用于显示绝对值。"""
    if v is None:
        return "—"
    return f"{v:.{nd}f}" if isinstance(v, (int, float)) else str(v)


def build_md(d):
    L = []
    L.append(f"# 全球财经日报 · {d['date']}")
    L.append("")
    L.append(f"> **主线**：{d['ai_summary']['headline']}")
    L.append("")
    m = d["markets"]

    def idx_line(market):
        arr = m[market]["indices"]
        return "，".join(f"{i['name']} {fmt(i.get('change'),'%')}" for i in arr)

    L.append("## 市场快照")
    L.append(f"- **A股**：{idx_line('a_share')}")
    L.append(f"- **美股**：{idx_line('us_stock')}")
    L.append(f"- **港股**：{idx_line('hk_stock')}")
    L.append(f"- **日韩**：{idx_line('asia_pacific')}")
    L.append(f"- **欧洲**：{idx_line('europe')}")
    c = d["commodities"]
    L.append(f"- **黄金**：COMEX {fmt_val(c['gold']['value'])} {fmt(c['gold']['change'],'%')}｜国内 {fmt_val(c['gold_cn']['value'])} {fmt(c['gold_cn']['change'],'%')}")
    L.append(f"- **原油**：WTI {fmt_val(c['wti_oil']['value'])} {fmt(c['wti_oil']['change'],'%')}｜布伦特 {fmt_val(c['brent_oil']['value'])} {fmt(c['brent_oil']['change'],'%')}")
    cur = d["currencies"]
    ui = cur["usd_index"]
    L.append(f"- **汇率**：美元指数 {fmt_val(ui['value'])} {fmt(ui['change'],'%')}｜在岸 {fmt_val(cur['usd_cny_onshore']['value'])}｜离岸 {fmt_val(cur['usd_cny_offshore']['value'])}｜美日 {fmt_val(cur['usd_jpy']['value'])}")
    L.append("")

    L.append("## 高影响事件")
    for e in d["key_events"]:
        icon = "🔴" if e["impact"] == "high" else ("🟡" if e["impact"] == "medium" else "⚪")
        L.append(f"{icon} **{e['title']}**")
        L.append(f"　{e['summary']}")
        L.append(f"　**对你的影响**：{e['impact_on_you']}")
    L.append("")

    if d.get("volatility_alerts"):
        L.append("## 波动预警")
        for v in d["volatility_alerts"]:
            arrow = "↑" if v["direction"] == "up" else "↓"
            L.append(f"- {v['market']} {arrow} {fmt(v['change'],'%')} ［{v['level']}］{v.get('note','')}")
        L.append("")

    L.append("## 针对你的操作建议")
    for a in d["ai_summary"]["actionable"]:
        L.append(f"- {a}")
    L.append("")
    L.append("— 数据来源：每日财经资讯自动化（北京时间）")
    return "\n".join(L)


def push_pushplus(token, title, content):
    url = "https://www.pushplus.plus/send?" + urllib.parse.urlencode(
        {"token": token, "title": title, "content": content, "template": "markdown"}
    )
    req = urllib.request.Request(url, headers={"User-Agent": "wb-finance/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8")


def push_wecom(webhook, content):
    payload = json.dumps({"msgtype": "markdown", "markdown": {"content": content}}).encode("utf-8")
    req = urllib.request.Request(
        webhook, data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8")


def main():
    import argparse
    p = argparse.ArgumentParser(description="推送每日财经日报到微信")
    p.add_argument("--pushplus", help="PushPlus token（个人微信）")
    p.add_argument("--wecom", help="企业微信群机器人 webhook URL")
    args = p.parse_args()

    d = load()
    content = build_md(d)
    title = f"全球财经日报 {d['date']}"

    if args.pushplus:
        try:
            resp = push_pushplus(args.pushplus, title, content)
            print("PushPlus 返回：", resp)
        except Exception as ex:
            print("PushPlus 推送失败：", ex, file=sys.stderr)
            sys.exit(1)
    elif args.wecom:
        try:
            resp = push_wecom(args.wecom, content)
            print("企业微信返回：", resp)
        except Exception as ex:
            print("企业微信推送失败：", ex, file=sys.stderr)
            sys.exit(1)
    else:
        print(content)
        print("\n[提示] 未指定通道，仅输出文案。用 --pushplus TOKEN 或 --wecom WEBHOOK 推送。", file=sys.stderr)


if __name__ == "__main__":
    main()
