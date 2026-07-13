#!/usr/bin/env python3
import base64, pathlib, re

ROOT = pathlib.Path("/home/user/Quinta-mama-")
OUT = pathlib.Path("/home/user/Quinta-mama-/docs/panama-semilla.html")

def font_b64(name):
    data = (ROOT / "public" / "fonts" / name).read_bytes()
    return base64.b64encode(data).decode()

fonts = {
    "CINZEL600": font_b64("cinzel-600.ttf"),
    "JOST400": font_b64("jost-400.ttf"),
    "JOST500": font_b64("jost-500.ttf"),
    "GARAMOND400I": font_b64("garamond-400i.ttf"),
}

# Logo emblem (monoline). Strip xml decl, keep <svg ...>. Recolored via CSS to currentColor.
logo = (ROOT / "public" / "logo-black.svg").read_text()
logo = logo.strip()
# add a class so we can style/recolor
logo = re.sub(r"<svg ", '<svg class="emblem-svg" aria-hidden="true" ', logo, count=1)

TEMPLATE = pathlib.Path("/home/user/Quinta-mama-/docs/_deck_template.html").read_text()

core = TEMPLATE
for k, v in fonts.items():
    core = core.replace("__%s__" % k, v)
core = core.replace("__EMBLEM_SVG__", logo)

# 1) Artifact version: body-only content (style + markup + script), no head.
ART = pathlib.Path("/home/user/Quinta-mama-/docs/panama-semilla.html")
ART.write_text(core)
print("Wrote", ART, "%.0f KB" % (len(core.encode())/1024))

# 2) Standalone downloadable version: full document with charset + title.
standalone = (
    "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">"
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
    "<title>La Quinta Mamá — Una semilla para Panamá</title>"
    "<style>html,body{margin:0;padding:0}</style></head><body>"
    + core +
    "</body></html>"
)
STAND = pathlib.Path("/home/user/Quinta-mama-/docs/panama-semilla-standalone.html")
STAND.write_text(standalone)
print("Wrote", STAND, "%.0f KB" % (len(standalone.encode())/1024))
