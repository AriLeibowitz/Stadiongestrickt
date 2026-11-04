#!/usr/bin/env python3
"""Baut aus src/ eine einzige, offline lauffähige HTML-Datei."""
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
JS_ORDER = ["data.js", "engine.js", "rules.js", "pattern.js", "curator.js", "render.js", "ui.js"]

html = (SRC / "template.html").read_text(encoding="utf-8")
css = (SRC / "styles.css").read_text(encoding="utf-8")
js = "\n".join((SRC / f).read_text(encoding="utf-8") for f in JS_ORDER)
js = js.replace("</script", "<\\/script")
out = html.replace("/*CSS*/", css).replace("/*JS*/", js)

(ROOT / "dist").mkdir(exist_ok=True)
(ROOT / "dist" / "stadion-gestrickt.html").write_text(out, encoding="utf-8")
(ROOT / "index.html").write_text(out, encoding="utf-8")
print(f"dist/stadion-gestrickt.html  {len(out.encode('utf-8')) / 1024:.0f} KB")
