"""
Frame phone captures for the Play Store listing.

Play accepts phone screenshots only up to a 2:1 aspect ratio; raw captures
from tall phones are 2.2:1, so each one is placed on a 1080x1920 (9:16)
brand background with a short caption. Run from the repo root:

    python3 -I scripts/build-screenshots.py

Input: docs/store/screenshots/src/<name>.jpg  Output: docs/store/screenshots/NN-<name>.png
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs/store/screenshots/src"
OUT = ROOT / "docs/store/screenshots"
FONTS = ROOT / "node_modules/@expo-google-fonts/inter"
W, H = 1080, 1920
TEAL_TOP, TEAL_BOTTOM = (0x14, 0x85, 0x7C), (0x0B, 0x5D, 0x57)
MINT = (0x5E, 0xEA, 0xD4)

SHOTS = [
    ("home", "This month at a glance", "Collected, pending and who still has to pay"),
    ("collection", "Know who has not paid", "Filter by status, area and month"),
    ("reports", "Reports that make sense", "By status, payment method and area"),
    ("settings", "Set up once, collect faster", "Reminder text, payment details and alerts"),
]


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / weight / f"Inter_{weight}.ttf"), size)


def gradient() -> Image.Image:
    bg = Image.new("RGB", (W, H))
    px = bg.load()
    for y in range(H):
        t = y / (H - 1)
        row = tuple(round(a + (b - a) * t) for a, b in zip(TEAL_TOP, TEAL_BOTTOM))
        for x in range(W):
            px[x, y] = row
    return bg


def fit_font(draw: ImageDraw.ImageDraw, text: str, weight: str, size: int, max_w: int) -> ImageFont.FreeTypeFont:
    while size > 30:
        f = font(weight, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return font(weight, size)


def frame(name: str, title: str, subtitle: str, index: int) -> Path:
    shot = Image.open(SRC / f"{name}.jpg").convert("RGB")
    canvas = gradient()
    draw = ImageDraw.Draw(canvas)

    title_font = fit_font(draw, title, "700Bold", 66, W - 160)
    sub_font = fit_font(draw, subtitle, "500Medium", 36, W - 160)
    draw.text((W / 2, 150), title, font=title_font, fill="white", anchor="mm")
    draw.text((W / 2, 232), subtitle, font=sub_font, fill=MINT, anchor="mm")

    # Scale the capture to fit under the caption with a margin at the bottom.
    target_h = 1450
    scale = target_h / shot.height
    size = (round(shot.width * scale), target_h)
    shot = shot.resize(size, Image.LANCZOS)
    x, y = (W - size[0]) // 2, 340

    # Soft shadow, then rounded corners.
    radius = 44
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x, y + 18, x + size[0], y + size[1] + 18), radius, fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow)

    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    canvas.paste(shot, (x, y), mask)

    out = OUT / f"{index:02d}-{name}.png"
    canvas.convert("RGB").save(out, optimize=True)
    return out


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for i, (name, title, subtitle) in enumerate(SHOTS, start=1):
        p = frame(name, title, subtitle, i)
        print(p.relative_to(ROOT), Image.open(p).size, f"{p.stat().st_size // 1024} KB")
