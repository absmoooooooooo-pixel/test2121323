"""Render the dynamic hex-bolt SVG drawing pair to a high-resolution PNG.

Uses resvg-py. Run with:
    python AUDIT_SAVED_CODE/render_hex_bolt_image.py
"""

from pathlib import Path
import re

import resvg_py

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "drawing-hex-bolt.html"
OUTPUT = HERE / "hex-bolt-full-thread-drawing.png"
SVG_OUTPUT = HERE / "hex-bolt-full-thread-drawing.svg"

svg_re = re.compile(r"<svg\b([^>]*)>([\s\S]*?)</svg>")
viewbox_re = re.compile(r'viewBox="0 0 ([\d.]+) ([\d.]+)"')

source = SOURCE.read_text(encoding="utf-8")
matches = svg_re.findall(source)
if len(matches) != 2:
    raise SystemExit(f"Expected 2 SVG views, found {len(matches)}")

views = []
defs = []
for attrs, inner in matches:
    vb = viewbox_re.search(attrs)
    if not vb:
        raise SystemExit("SVG missing viewBox")
    width, height = vb.group(1), vb.group(2)
    for definition in re.findall(r"<defs>[\s\S]*?</defs>", inner):
        defs.append(definition)
    body = re.sub(r"<defs>[\s\S]*?</defs>", "", inner)
    views.append((width, height, body))

if float(views[0][0]) != 360 or float(views[1][0]) != 720:
    raise SystemExit(f"Unexpected view sizes: {[v[:2] for v in views]}")

style = """
  .fastener-part { fill:#ffffff; stroke:#000000; stroke-width:1.5;
    stroke-linejoin:miter; stroke-linecap:butt; }
  .fastener-thread-line { fill:none; stroke:#000000; stroke-width:1;
    stroke-linejoin:miter; }
  .fastener-section { fill:#ffffff; stroke:#000000; stroke-width:1.2; }
  .fastener-hatch { fill:none; stroke:#000000; stroke-width:0.9; }
  .fastener-hidden { fill:none; stroke:#000000; stroke-width:0.9;
    stroke-dasharray:4 3; }
  .fastener-centre { fill:none; stroke:#000000; stroke-width:0.9;
    stroke-dasharray:12 3 2 3; }
  .fastener-dim { fill:none; stroke:#000000; stroke-width:1.05; }
  .fastener-ext { fill:none; stroke:#000000; stroke-width:0.75; }
  .fastener-arrow { fill:none; stroke:#000000; stroke-width:1.15;
    stroke-linecap:round; stroke-linejoin:round; }
  .fastener-point { fill:#000000; stroke:none; }
  .fastener-label { fill:#000000; stroke:#ffffff; stroke-width:4px;
    stroke-linejoin:round; font-family:'DejaVu Sans',Arial,sans-serif;
    font-size:16px; font-weight:bold; }
  .view-title { fill:#000000; font-family:'DejaVu Sans',Arial,sans-serif;
    font-size:12px; font-weight:bold; letter-spacing:1.2px; text-anchor:middle; }
  .drawing-title { fill:#000000; font-family:'DejaVu Sans',Arial,sans-serif;
    font-size:16px; font-weight:bold; letter-spacing:1.2px; text-anchor:middle; }
  .unit-note { fill:#000000; font-family:'DejaVu Sans',Arial,sans-serif;
    font-size:11px; font-weight:bold; letter-spacing:1.6px; text-anchor:middle; }
"""

master = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="540"
 viewBox="0 0 1180 540">
<style>{style}</style>
<rect x="0" y="0" width="1180" height="540" fill="#ffffff"/>
<text class="drawing-title" x="590" y="30">HEXAGONAL BOLT - FULL THREAD</text>
<text class="unit-note" x="590" y="49">ALL DIMENSIONS IN MILLIMETRES</text>
<g transform="translate(40,80)">{views[0][2]}</g>
<g transform="translate(420,70)">{views[1][2]}</g>
<text class="view-title" x="220" y="472">END VIEW</text>
<text class="view-title" x="780" y="518">SIDE ELEVATION</text>
{''.join(defs)}
</svg>
"""

SVG_OUTPUT.write_text(master, encoding="utf-8")
png = resvg_py.svg_to_bytes(
    svg_string=master,
    background="#ffffff",
    zoom=2,
    font_family="DejaVu Sans",
    sans_serif_family="DejaVu Sans",
    shape_rendering="geometric_precision",
    text_rendering="optimize_legibility",
)
OUTPUT.write_bytes(png)
print(f"Wrote {SVG_OUTPUT} ({SVG_OUTPUT.stat().st_size:,} bytes)")
print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
