#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""微信读书数据同步处理脚本：调用API返回 -> 规范化 -> 写入 weread-sync.json"""
import json
import os
from datetime import datetime, timezone, timedelta

# 脚本位于 scripts/ 下，数据目录为上一级的 data/
_HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(_HERE, "..", "data")
SHELF = f"{DATA}/shelf_sync.json"
READ = f"{DATA}/readdata_detail.json"
OUT = f"{DATA}/weread-sync.json"

BJ = timezone(timedelta(hours=8))

def bj_date(ts):
    if not ts:
        return None
    return datetime.fromtimestamp(ts, BJ).strftime("%Y-%m-%d")

def bj_iso():
    return datetime.now(BJ).isoformat()

def map_category(wc):
    if not wc:
        return "other"
    wc = str(wc)
    rules = [
        (["小说", "文学", "悬疑", "推理"], "fiction"),
        (["科幻"], "scifi"),
        (["传记", "人物"], "biography"),
        (["历史"], "history"),
        (["经济", "理财", "投资", "管理", "商业"], "business"),
        (["心理"], "psychology"),
        (["哲学", "思想"], "philosophy"),
        (["计算机", "编程", "科技", "互联网"], "tech"),
        (["个人成长", "成功", "励志", "社会", "文化"], "nonfiction"),
    ]
    for kws, cat in rules:
        if any(k in wc for k in kws):
            return cat
    return "other"

shelf = json.load(open(SHELF, encoding="utf-8"))
rd = json.load(open(READ, encoding="utf-8"))

# ---- books ----
books = []
for b in shelf.get("books", []):
    ru = b.get("readUpdateTime", 0) or 0
    if b.get("finishReading") == 1:
        status = "finished"
    elif ru > 0:
        status = "reading"
    else:
        status = "want_read"
    wc = b.get("category", "")
    books.append({
        "bookId": b.get("bookId", ""),
        "title": b.get("title", ""),
        "author": b.get("author", ""),
        "category": map_category(wc),
        "wereadCategory": wc,
        "status": status,
        "cover": b.get("cover", ""),
        "finishedDate": bj_date(ru) if status == "finished" else None,
        "lastReadDate": bj_date(ru) if ru > 0 else None,
        "deepLink": b.get("deepLink", ""),
    })

# ---- stats ----
readStat = {s["stat"]: s["counts"] for s in rd.get("readStat", [])}

year_stats = {}
for k, v in rd.get("readTimes", {}).items():
    yr = datetime.fromtimestamp(int(k), BJ).year
    year_stats[str(yr)] = round(year_stats.get(str(yr), 0) + v / 3600.0, 2)

top_books = []
for x in rd.get("readLongest", [])[:10]:
    bk = x.get("book", {})
    top_books.append({
        "title": bk.get("title", ""),
        "author": bk.get("author", ""),
        "readTimeHours": round((x.get("readTime", 0) or 0) / 3600.0, 2),
        "bookId": bk.get("bookId", ""),
    })

pref_cats = []
for c in rd.get("preferCategory", []):
    pref_cats.append({
        "category": c.get("categoryTitle", ""),
        "count": c.get("readingCount", 0),
        "readTimeHours": round((c.get("readingTime", 0) or 0) / 3600.0, 2),
    })

pref_authors = []
for a in rd.get("preferAuthor", []):
    pref_authors.append({
        "name": a.get("name", ""),
        "count": a.get("count", 0),
        "readTime": a.get("readTime", ""),
    })

summary = {
    "totalReadDays": rd.get("readDays", 0),
    "totalReadTimeHours": round((rd.get("totalReadTime", 0) or 0) / 3600.0, 2),
    "totalReadBooks": readStat.get("读过", ""),
    "finishedBooks": readStat.get("读完", ""),
    "totalNotes": readStat.get("笔记", ""),
    "authorCount": rd.get("authorCount", 0),
    "medalCount": len(rd.get("medals", [])),
    "registerDate": bj_date(rd.get("registTime", 0)),
    "preferCategoryWord": rd.get("preferCategoryWord", ""),
    "preferTimeWord": rd.get("preferTimeWord", ""),
}

result = {
    "syncTime": bj_iso(),
    "books": books,
    "stats": {
        "summary": summary,
        "yearStats": year_stats,
        "topBooks": top_books,
        "preferredCategories": pref_cats,
        "preferredAuthors": pref_authors,
    },
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

# ---- report ----
from collections import Counter
c = Counter(b["status"] for b in books)
print("syncTime:", result["syncTime"])
print("books total:", len(books), "| finished:", c["finished"], "reading:", c["reading"], "want_read:", c["want_read"])
print("summary:", json.dumps(summary, ensure_ascii=False))
print("yearStats:", json.dumps(year_stats, ensure_ascii=False))
print("top1:", json.dumps(top_books[0], ensure_ascii=False))
print("written ->", OUT)
