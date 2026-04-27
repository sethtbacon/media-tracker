"""
Generates all favicon assets from scratch using Pillow.
Run from the repo root: python3 scripts/generate_favicon.py
Outputs to frontend/public/.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path("frontend/public")
OUT.mkdir(parents=True, exist_ok=True)

BG       = (26,  29,  39)   # --surface  #1a1d27
ACCENT   = (99, 102, 241)   # --accent   #6366f1
WHITE    = (255, 255, 255)
BORDER   = (46,  51,  71)   # --border   #2e3347


def draw_clapperboard(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d   = ImageDraw.Draw(img)

    pad = max(1, size // 16)

    # rounded background square
    r = max(2, size // 8)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG)

    # ── clapper arm (top ~28 % of icon) ───────────────────────────────────
    arm_h  = max(3, int(size * 0.28))
    arm_y0 = pad
    arm_y1 = arm_y0 + arm_h

    # fill arm with accent colour first
    d.rectangle([pad, arm_y0, size - pad - 1, arm_y1], fill=ACCENT)

    # diagonal white stripes over the arm (every ~15 % of width, 45°)
    stripe_w = max(2, size // 7)
    step     = stripe_w * 2
    for x_start in range(-arm_h, size, step):
        poly = [
            (x_start,              arm_y0),
            (x_start + stripe_w,   arm_y0),
            (x_start + stripe_w + arm_h, arm_y1),
            (x_start + arm_h,      arm_y1),
        ]
        d.polygon(poly, fill=WHITE)

    # clip stripe overflow back to arm area
    # (re-draw the arm borders to mask any overflow)
    # left wall
    d.rectangle([0, arm_y0, pad - 1, arm_y1], fill=BG)
    # right wall
    d.rectangle([size - pad, arm_y0, size - 1, arm_y1], fill=BG)

    # hinge line between arm and body
    hinge_y = arm_y1 + 1
    lw = max(1, size // 48)
    d.rectangle([pad, arm_y1, size - pad - 1, arm_y1 + lw], fill=BORDER)

    # ── board body (below arm, to bottom pad) ─────────────────────────────
    body_y0 = hinge_y + lw + max(1, size // 24)
    body_y1 = size - pad - 1
    body_r  = max(1, size // 16)

    d.rounded_rectangle(
        [pad, body_y0, size - pad - 1, body_y1],
        radius=body_r,
        outline=BORDER,
        width=max(1, size // 32),
    )

    # two horizontal lines inside the body (like a real slate)
    if size >= 32:
        line_gap = (body_y1 - body_y0) // 3
        for i in (1, 2):
            ly = body_y0 + line_gap * i
            d.line([(pad + 3, ly), (size - pad - 4, ly)], fill=BORDER, width=max(1, size // 48))

    return img


def save_png(img: Image.Image, name: str):
    path = OUT / name
    img.convert("RGBA").save(path, "PNG")
    print(f"  wrote {path}  ({img.size[0]}×{img.size[1]})")


def save_ico(images: list[Image.Image], name: str):
    path = OUT / name
    # Pillow ICO plugin takes a list of RGBA images
    base = images[0].convert("RGBA")
    base.save(path, format="ICO", sizes=[(img.width, img.height) for img in images],
              append_images=[i.convert("RGBA") for i in images[1:]])
    print(f"  wrote {path}  ({', '.join(str(i.width) for i in images)}px)")


print("Generating favicon assets …")

imgs = {sz: draw_clapperboard(sz) for sz in (16, 32, 48, 180, 192, 512)}

save_ico([imgs[16], imgs[32], imgs[48]], "favicon.ico")
save_png(imgs[180], "apple-touch-icon.png")
save_png(imgs[192], "favicon-192.png")
save_png(imgs[512], "favicon-512.png")

# also save a 32px PNG for reference / browsers that prefer PNG
save_png(imgs[32], "favicon-32.png")

print("Done.")
