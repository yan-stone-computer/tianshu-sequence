#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 articles/ 目录生成站点文章清单。

用法：
    python scripts/build_articles.py

文章统一维护在 articles/ 目录（Markdown 原文 + examples/ 等附属资源），
本脚本只负责根据 ARTICLES 元数据重新生成 articles/index.json，
供前端 fetch 加载。文章正文不需要复制，直接以 articles/<id>.md 为唯一来源。

新增文章：
  1. 把 xxx.md 放进 articles/；
  2. 在 ARTICLES 里加一条记录（id 与文件名一致）；
  3. 运行本脚本。
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTICLES_DIR = ROOT / "articles"

# 文章元数据：id 必须等于 articles/<id>.md 的文件名
ARTICLES = [
    {
        "id": "llm-app-dev-guide",
        "title": "大模型应用开发实战：从意图识别到 GraphRAG 双路召回",
        "author": "天枢序列",
        "category": "AI",
        "date": "2026-08-20T10:00:00",
    },
    {
        "id": "skill-authoring-guide",
        "title": "从零写一个会「爆」的 Skill：AI 技能包创作指南",
        "author": "天枢序列",
        "category": "AI",
        "date": "2026-08-20T09:00:00",
    },
    {
        "id": "slow-hash-guide",
        "title": "迭代式慢哈希加盐（Password Hashing）技术指南",
        "author": "天枢序列",
        "category": "安全",
        "date": "2026-08-20T08:00:00",
    },
]


def main() -> None:
    manifest = []
    for item in ARTICLES:
        md = ARTICLES_DIR / (item["id"] + ".md")
        if not md.exists():
            print(f"[warn] 缺少文章文件: {md.relative_to(ROOT)}，已跳过")
            continue
        manifest.append(
            {
                "id": item["id"],
                "title": item["title"],
                "author": item["author"],
                "category": item["category"],
                "date": item["date"],
                "file": item["id"] + ".md",
            }
        )
        print(f"[ok] {md.relative_to(ROOT)}")

    manifest_path = ARTICLES_DIR / "index.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"[ok] 已生成 {manifest_path.relative_to(ROOT)}（{len(manifest)} 篇）")


if __name__ == "__main__":
    main()
