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
import base64
font = base64.b64encode((SRC / "fonts" / "BarlowCondensed-Bold.woff2").read_bytes()).decode()
font_css = f"@font-face{{font-family:'ScarfFont';font-weight:700;font-style:normal;src:url(data:font/woff2;base64,{font}) format('woff2');}}"
# Moment-Patches (Fotos, je weiß/silber/gold) als Data-URLs
import json
imgs = {f.stem: "data:image/webp;base64," + base64.b64encode(f.read_bytes()).decode() for f in sorted((SRC / "patches").glob("*.webp"))}
js = "const PATCH_IMAGES_SRC = " + json.dumps(imgs) + ";\n" + js
out = html.replace("/*FONT*/", font_css).replace("/*CSS*/", css).replace("/*JS*/", js)

(ROOT / "dist").mkdir(exist_ok=True)
(ROOT / "dist" / "stadion-gestrickt.html").write_text(out, encoding="utf-8")
(ROOT / "index.html").write_text(out, encoding="utf-8")
print(f"dist/stadion-gestrickt.html  {len(out.encode('utf-8')) / 1024:.0f} KB")
