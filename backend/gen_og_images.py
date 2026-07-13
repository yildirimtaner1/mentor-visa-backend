"""Generate per-tool Open Graph images (1200x630) into frontend/public/og/.

Simple branded cards: deep-blue gradient, Mentor Visa wordmark + logo, big tool
title, subtitle line. Re-run whenever a tool is added or renamed:
    ./venv/Scripts/python.exe gen_og_images.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "frontend", "public", "og")
LOGO = os.path.join(HERE, "..", "frontend", "public", "logo.png")
W, H = 1200, 630

CARDS = {
    "crs-calculator": ("CRS Score Calculator", "Your exact Express Entry points in 2 minutes — free"),
    "find-my-noc": ("AI NOC Code Finder", "Paste your duties, get your 2021 NOC code instantly"),
    "audit-employment-letter": ("Employment Letter Auditor", "Catch missing NOC duties before IRCC does"),
    "track-my-application": ("Smart Application Tracker", "Timeline predictions from 700+ real PR cases"),
    "order-gcms-notes": ("Order Your GCMS Notes", "Your complete IRCC file — $19.90, filed for you"),
    "how-to-read-gcms-notes": ("GCMS Notes Guide", "Decode every stage, code and red flag in your file"),
    "draw-results": ("Express Entry Draw Results", "Every CRS cut-off and ITA count, updated live"),
    "express-entry-processing-times": ("Processing Times 2026", "AOR to eCOPR medians from real recent cases"),
    "noc-codes": ("NOC 2021 Directory", "All 516 occupation codes with duties & eligibility"),
    "get-started": ("Am I Eligible for Canada PR?", "Free FSWP / CEC / FSTP check in 3 minutes"),
    "pricing": ("Mentor Visa Plans", "Free tools · Optimize $49 · Execute $99 — one-time"),
}


def font(size, bold=True):
    names = ["arialbd.ttf" if bold else "arial.ttf", "segoeuib.ttf" if bold else "segoeui.ttf"]
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            continue
    return ImageFont.load_default(size)


def gradient(draw):
    top, bottom = (15, 23, 42), (30, 58, 138)  # slate-900 -> blue-900
    for y in range(H):
        t = y / H
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        draw.line([(0, y), (W, y)], fill=c)


def wrap_text(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def make_card(slug, title, subtitle):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    gradient(d)
    # subtle top accent bar
    d.rectangle([0, 0, W, 10], fill=(99, 102, 241))

    # brand row: logo + wordmark
    x = 80
    try:
        logo = Image.open(LOGO).convert("RGBA").resize((72, 72))
        img.paste(logo, (x, 64), logo)
        x += 92
    except Exception:
        pass
    d.text((x, 78), "Mentor Visa", font=font(44), fill=(226, 232, 240))

    # title (wrapped, big)
    tf = font(84)
    lines = wrap_text(d, title, tf, W - 160)[:2]
    y = 240 if len(lines) > 1 else 280
    for ln in lines:
        d.text((80, y), ln, font=tf, fill=(255, 255, 255))
        y += 100

    # subtitle
    d.text((80, y + 18), subtitle, font=font(40, bold=False), fill=(148, 163, 184))

    # footer domain
    d.text((80, H - 78), "mentorvisa.com", font=font(34), fill=(99, 102, 241))

    img.save(os.path.join(OUT, f"{slug}.png"), optimize=True)


os.makedirs(OUT, exist_ok=True)
for slug, (title, subtitle) in CARDS.items():
    make_card(slug, title, subtitle)
print(f"Generated {len(CARDS)} OG images in {os.path.abspath(OUT)}")
