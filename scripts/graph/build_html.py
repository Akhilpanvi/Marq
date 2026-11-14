#!/usr/bin/env python3
"""Build graphify-out/graph.html from graphify-out/clean-graph.json (stdlib only).

Usage: python3 scripts/graph/build_html.py [path/to/graph.json]
"""
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "graphify-out"
TEMPLATE = Path(__file__).resolve().parent / "viewer.template.html"
PLACEHOLDER = "/*__GRAPH_DATA__*/ null"


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT / "clean-graph.json"
    if not src.exists():
        print(f"missing {src}", file=sys.stderr)
        return 1
    data = json.loads(src.read_text(encoding="utf-8"))  # validates JSON
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    text = text.replace("</", "<\\/").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    tpl = TEMPLATE.read_text(encoding="utf-8")
    if PLACEHOLDER not in tpl:
        print("placeholder not found in template", file=sys.stderr)
        return 1
    html = tpl.replace(PLACEHOLDER, text, 1)
    target = OUT / "graph.html"
    backup = OUT / "graph.original.html"
    if target.exists() and not backup.exists():
        shutil.copyfile(target, backup)
    OUT.mkdir(exist_ok=True)
    target.write_text(html, encoding="utf-8")
    print(f"wrote {target} ({len(html)//1024} KB) from {src.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
