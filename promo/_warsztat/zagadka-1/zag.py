"""Reel: Zagadka w 20 sekund #1 (Wrocław 1993, Organista z parafii).
Shots are timed to VO clips listed in CLIPS (file, in, out). Usage: python zag.py
"""
import sys, math, random, subprocess, wave, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import os
Z = os.environ.get("ZAG_OUT", os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FONTS = os.path.join(W, "fonts")
MUSIC = os.path.join(W, "muzyka", "mus2.mp3")
OW, OH, FPS = 1080, 1920, 30
CREAM = (239, 230, 210); PAPER = (244, 239, 228); INK = (30, 27, 23)
MUTED = (107, 95, 78); RED = (179, 32, 30); CORK = (180, 130, 79)


def font(name, size, bold=False):
    f = ImageFont.truetype(f"{FONTS}/{name}", size)
    if bold:
        try: f.set_variation_by_name("Bold")
        except Exception: pass
    return f
from PIL import ImageFont

F_TITLE = font("PixelifySans.ttf", 92, True)
F_BIG = font("PixelifySans.ttf", 76, True)
F_TYPE = font("SpecialElite.ttf", 50)
F_TAG = font("SpecialElite.ttf", 32)
F_NAME = font("SpecialElite.ttf", 40)
F_LINK = font("CourierPrime-Bold.ttf", 54)


def ease(x):
    x = min(max(x, 0), 1); return 0.5 - 0.5 * math.cos(math.pi * x)


# ---------- background ----------
def cork_bg():
    rnd = random.Random(9)
    im = Image.new("RGB", (OW, OH), CORK); d = ImageDraw.Draw(im)
    for _ in range(42000):
        x, y = rnd.randrange(OW), rnd.randrange(OH)
        d.point((x, y), fill=rnd.choice([(150, 104, 58), (200, 156, 104), (165, 117, 68)]))
    vig = Image.new("L", (OW, OH), 0); ImageDraw.Draw(vig).ellipse([-300, -200, OW + 300, OH + 200], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(180))
    dark = Image.new("RGB", (OW, OH), (40, 24, 12))
    return Image.composite(im, dark, vig)


BG = cork_bg()
PORT = {n: Image.open(f"{Z}/{n}.png").convert("RGBA") for n in ["bernard", "danuta", "ryszarda"]}
NAMES = {"bernard": "Bernard K.", "danuta": "Danuta W.", "ryszarda": "Ryszarda W."}


def polaroid(who, w=300, caption=True, crossed=False, circled=False):
    pad = int(w * 0.06); ph = w - 2 * pad
    h = w + (int(w * 0.2) if caption else pad)
    im = Image.new("RGBA", (w + 14, h + 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([10, 14, w + 10, h + 14], fill=(40, 20, 5, 110))
    d.rectangle([0, 0, w, h], fill=PAPER + (255,))
    d.rectangle([pad, pad, pad + ph, pad + ph], fill=(42, 38, 34, 255))
    p = PORT[who].resize((ph, ph), Image.NEAREST)
    im.alpha_composite(p, (pad, pad))
    if caption:
        f = font("SpecialElite.ttf", int(w * 0.11))
        tw = d.textlength(NAMES[who], font=f)
        d.text(((w - tw) / 2, pad + ph + int(w * 0.035)), NAMES[who], font=f, fill=INK)
    if crossed:
        d.line([pad, pad, pad + ph, pad + ph], fill=RED + (230,), width=max(6, w // 30))
        d.line([pad + ph, pad, pad, pad + ph], fill=RED + (230,), width=max(6, w // 30))
    if circled:
        d.ellipse([-4, -4, w + 4, h + 4], outline=RED + (255,), width=max(8, w // 28))
    return im


def pin(d, x, y, r=20):
    d.ellipse([x - r + 4, y - r + 6, x + r + 4, y + r + 6], fill=(50, 25, 8))
    d.ellipse([x - r, y - r, x + r, y + r], fill=RED)
    d.ellipse([x - r * 0.55, y - r * 0.6, x - r * 0.1, y - r * 0.15], fill=(242, 160, 144))


def paste_rot(base, layer, angle, cx, cy, scale=1.0):
    if scale != 1.0:
        layer = layer.resize((max(1, int(layer.width * scale)), max(1, int(layer.height * scale))), Image.BICUBIC)
    r = layer.rotate(angle, resample=Image.BICUBIC, expand=True)
    base.alpha_composite(r, (int(cx - r.width / 2), int(cy - r.height / 2)))


def wrap(text, f, width):
    d = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    words = [(w.strip("*"), w.startswith("*")) for w in text.split(" ")]
    lines, cur, cw = [], [], 0; sp = d.textlength(" ", font=f)
    for w, red in words:
        ww = d.textlength(w, font=f)
        if cur and cw + sp + ww > width:
            lines.append(cur); cur, cw = [], 0
        cw += (sp if cur else 0) + ww; cur.append((w, red))
    if cur: lines.append(cur)
    return lines


def card(tag, text, vis, frame, width=900):
    lines = wrap(text, F_TYPE, width - 100); lh = 70
    h = 104 + lh * len(lines) + 34
    im = Image.new("RGBA", (width + 24, h + 24), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([14, 18, width + 14, h + 18], fill=(40, 20, 5, 120))
    d.rectangle([0, 0, width, h], fill=PAPER + (255,))
    for k in range(3, int(h / 36)):
        d.line([0, 30 + k * 36, width, 30 + k * 36], fill=(60, 90, 140, 38), width=2)
    d.text((48, 32), tag.upper(), font=F_TAG, fill=MUTED)
    sp = d.textlength(" ", font=F_TYPE); left = vis; y = 96; cur = None
    for line in lines:
        x = 48
        for w, red in line:
            if left <= 0: break
            part = w[:left]; d.text((x, y), part, font=F_TYPE, fill=RED if red else INK)
            x += d.textlength(part, font=F_TYPE); left -= len(w); cur = (x, y)
            if left > 0: x += sp
        y += lh
    total = len(text.replace("*", ""))
    if cur and vis < total + 1 and (frame // 4) % 2 == 0:
        d.rectangle([cur[0] + 4, cur[1] + 6, cur[0] + 26, cur[1] + 54], fill=INK)
    return im


def label(big, small=None, rot=-2):
    d0 = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    w = int(max(d0.textlength(big, font=F_BIG), d0.textlength(small or "", font=F_NAME)) + 80)
    h = 130 + (62 if small else 0)
    im = Image.new("RGBA", (w + 24, h + 24), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([14, 16, w + 14, h + 16], fill=(0, 0, 0, 110))
    d.rectangle([0, 0, w, h], fill=CREAM + (255,)); d.rectangle([0, 0, 10, h], fill=RED + (255,))
    d.text((40, 22), big, font=F_BIG, fill=INK)
    if small: d.text((42, 128), small, font=F_NAME, fill=MUTED)
    im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    if im.width > 980: im = im.resize((980, int(im.height * 980 / im.width)), Image.LANCZOS)
    return im


def pop(i, n=6):
    k = min(i / n, 1); return 0.75 + 0.25 * (1 - (1 - k) ** 3) + 0.06 * math.sin(k * math.pi)


# ---------- shots ----------
def bg_frame(p, zoom=0.05):
    w = OW * (1 - zoom * p); h = w * OH / OW
    return BG.resize((OW, OH), Image.BICUBIC, box=((OW - w) / 2, (OH - h) / 2, (OW + w) / 2, (OH + h) / 2)).convert("RGBA")


def shot_hook(i, n):
    # three polaroids slam in one by one, red "?" stamp
    out = bg_frame(i / n); d = ImageDraw.Draw(out)
    pos = [("bernard", 250, 860, -6), ("danuta", 540, 800, 3), ("ryszarda", 830, 870, 7)]
    for k, (who, x, y, rot) in enumerate(pos):
        t0 = k * 5
        if i < t0: continue
        s = pop(i - t0, 5) * 1.0
        paste_rot(out, polaroid(who, 300), rot, x, y, s)
    d = ImageDraw.Draw(out)
    for k, (who, x, y, rot) in enumerate(pos):
        if i >= k * 5 + 3: pin(d, x, y - 190)
    lab = label("Ktoś tu kłamie.", None, -2)
    if i >= 14:
        paste_rot(out, lab, 0, OW / 2, 420, pop(i - 14))
    return out


def shot_card(i, n, tag, text, big, small, rot, who=None):
    out = bg_frame(i / n)
    total = len(text.replace("*", "")); reveal = max(int(n * 0.55), 1)
    vis = int(total * min((i + 1) / reveal, 1)) + (40 if i >= reveal else 0)
    if who:
        paste_rot(out, polaroid(who, 380), -4, OW / 2, 820, pop(i, 5))
        dd = ImageDraw.Draw(out); pin(dd, OW / 2, 820 - 240)
        c = card(tag, text, vis, i)
        k = min(i / 5, 1)
        out.alpha_composite(c, (int((OW - c.width) / 2), int(1180 + 40 * (1 - k))))
    else:
        c = card(tag, text, vis, i)
        k = min(i / 5, 1)
        out.alpha_composite(c, (int((OW - c.width) / 2), int(980 - c.height / 2 + 40 * (1 - k))))
    if big:
        lab = label(big, small, rot)
        if i >= 2: paste_rot(out, lab, 0, OW / 2, 360, pop(i - 2))
    return out


def shot_count(i, n):
    # 5..1 countdown over three polaroids
    out = bg_frame(i / n, 0.08); d = ImageDraw.Draw(out)
    pos = [("bernard", 250, 980, -6), ("danuta", 540, 940, 3), ("ryszarda", 830, 990, 7)]
    for who, x, y, rot in pos:
        paste_rot(out, polaroid(who, 280), rot, x, y)
    d = ImageDraw.Draw(out)
    for who, x, y, rot in pos: pin(d, x, y - 178)
    secs = 5 - int(i / FPS)
    lab = label("Czyje alibi się sypie?", None, -2)
    paste_rot(out, lab, 0, OW / 2, 420, 1.0)
    if secs > 0:
        fr = (i % FPS) / FPS
        f = font("CourierPrime-Bold.ttf", int(320 * (1.25 - 0.25 * ease(fr * 3))))
        s = str(secs); tw = d.textlength(s, font=f)
        d.text(((OW - tw) / 2 + 6, 1330 + 8), s, font=f, fill=(40, 20, 5))
        d.text(((OW - tw) / 2, 1330), s, font=f, fill=RED)
    return out


def shot_end(i, n):
    out = Image.new("RGBA", (OW, OH), (26, 23, 20, 255)); d = ImageDraw.Draw(out)
    def c(y, s, f, fill):
        w = d.textlength(s, font=f); d.text(((OW - w) / 2, y), s, font=f, fill=fill)
    c(520, "Odpowiedź w środę", font("PixelifySans.ttf", 84, True), CREAM)
    c(640, "w relacji. Typuj w komentarzu.", font("SpecialElite.ttf", 46), (181, 168, 143))
    pts = [(300, 900), (780, 860), (540, 1040)]
    for a, b in [(0, 1), (1, 2), (2, 0)]: d.line([pts[a], pts[b]], fill=RED, width=8)
    for x, y in pts: pin(d, x, y, 24)
    c(1160, "Siatka Powiązań", font("PixelifySans.ttf", 96, True), CREAM)
    c(1290, "Codziennie nowa sprawa. Za darmo.", font("SpecialElite.ttf", 42), (181, 168, 143))
    t = "siatkapowiazan.pl"; tw = d.textlength(t, font=F_LINK); x0 = (OW - tw) / 2 - 30
    d.rectangle([x0, 1400, x0 + tw + 60, 1496], fill=RED); d.text((x0 + 30, 1414), t, font=F_LINK, fill=(255, 255, 255))
    return out


# ---------- timeline ----------
CL = json.load(open(f"{Z}/clips.json"))  # name -> [in, out]
SHOTS = [
    ("hook", "hook", 2.6, {}),
    ("intro", "card", 3.0, dict(tag="Akta · Nadodrze, Wrocław, I 1993",
        text="Organista Karol Szulc zostaje znaleziony *martwy* w zakrystii katedry. *Uduszony* *sznurem.*",
        big="Wrocław, 1993", small="kto kłamie?", rot=-2)),
    ("bernard", "card", 2.6, dict(tag="Teczka: Bernard Kubiak", who="bernard",
        text="Zapewnia, że oglądał „Koło Fortuny” u siebie w pokoju. *Potwierdzić* *tego* *nie* *ma* *kto.*",
        big=None, small=None, rot=2)),
    ("danuta", "card", 3.0, dict(tag="Teczka: Danuta Wysocka", who="danuta",
        text="Od *19:40* do *21:25* siedziała w poczekalni pogotowia z sąsiadem. Jest wpis w książce przyjęć.",
        big=None, small=None, rot=-2)),
    ("ryszarda", "card", 3.0, dict(tag="Teczka: Ryszarda Wrzos", who="ryszarda",
        text="Od *19:30* do *21:10* siedziała na *zebraniu* *koła* *wędkarskiego.* Potwierdzają to prezes koła i protokół.",
        big=None, small=None, rot=2)),
    ("trop", "card", 3.0, dict(tag="Teczka: Danuta Wysocka · dopisek",
        text="Mówi, że zebranie koła wędkarskiego *się* *nie* *odbyło,* bo w świetlicy wysiadło ogrzewanie.",
        big="Jedno zdanie", small="", rot=-2)),
    ("count", "count", 5.2, {}),
    ("end", "end", 2.9, {}),
]


def synth(events, total, path):
    SR = 44100; a = np.zeros(int((total + 1) * SR)); rng = np.random.default_rng(3)
    def add(t, s):
        k = int(t * SR); a[k:k + len(s)] += s[: len(a) - k]
    for t, kind in events:
        if kind == "whoosh":
            L = int(.28 * SR); s = np.convolve(rng.standard_normal(L), np.ones(12) / 12, "same")
            add(t, s * np.sin(np.linspace(0, np.pi, L)) ** 2 * .35)
        elif kind == "slam":
            L = int(.3 * SR); tt = np.arange(L) / SR
            s = np.sin(2 * np.pi * 95 * tt) * np.exp(-tt * 16) * .8; s[:300] += rng.standard_normal(300) * .35; add(t, s)
        elif kind == "tick":
            L = int(.05 * SR); tt = np.arange(L) / SR
            add(t, np.sin(2 * np.pi * 1800 * tt) * np.exp(-tt * 90) * .5)
        elif kind == "ding":
            L = int(.8 * SR); tt = np.arange(L) / SR
            add(t, (np.sin(2 * np.pi * 880 * tt) + .5 * np.sin(2 * np.pi * 1320 * tt)) * np.exp(-tt * 5) * .25)
    a = np.clip(a, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((a * 32767).astype(np.int16).tobytes())


def main():
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OW}x{OH}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
                            "-pix_fmt", "yuv420p", f"{Z}/zag_video.mp4"], stdin=subprocess.PIPE)
    frames = 0; vo, fx = [], []
    for name, kind, dur, kw in SHOTS:
        start = frames / FPS
        if name in CL:
            a, z = CL[name]; dur = max(dur, (z - a) + 0.45); vo.append((start + 0.15, name))
        n = int(round(dur * FPS))
        if kind == "hook": fx += [(start + k * 5 / FPS, "slam") for k in range(3)]
        elif kind == "count":
            fx += [(start + s, "tick") for s in range(5)] + [(start + 5.0, "ding")]
        else: fx.append((start, "whoosh"))
        for i in range(n):
            if kind == "hook": im = shot_hook(i, n)
            elif kind == "card": im = shot_card(i, n, **kw)
            elif kind == "count": im = shot_count(i, n)
            else: im = shot_end(i, n)
            enc.stdin.write(im.convert("RGB").tobytes())
        frames += n
    enc.stdin.close(); enc.wait()
    total = frames / FPS
    synth(fx, total, f"{Z}/zag_fx.wav")
    ins, flt, labs = [], [], []
    for k, (t, name) in enumerate(vo):
        a, z = CL[name]; ins += ["-i", f"{Z}/vo.mp3"]; ms = int(t * 1000)
        flt.append(f"[{k}:a]atrim={a}:{z},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,adelay={ms}|{ms}[v{k}]")
        labs.append(f"[v{k}]")
    flt.append("".join(labs) + f"amix=inputs={len(labs)}:normalize=0,apad=whole_dur={total},atrim=0:{total}[vo]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", ";".join(flt), "-map", "[vo]", f"{Z}/zag_vo.wav"], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{Z}/zag_video.mp4", "-i", f"{Z}/zag_vo.wav", "-i", MUSIC, "-i", f"{Z}/zag_fx.wav",
        "-filter_complex",
        "[1:a]highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-15:TP=-1.5:LRA=7,"
        f"aresample=44100,aformat=channel_layouts=stereo,apad=whole_dur={total},asplit=2[vo][key];"
        f"[2:a]atrim=0:{total},afade=t=in:st=0:d=0.3,afade=t=out:st={total-1.2:.2f}:d=1.2,volume=0.55,aformat=channel_layouts=stereo,apad=whole_dur={total}[m0];"
        "[m0][key]sidechaincompress=threshold=0.03:ratio=7:attack=20:release=300[m];"
        f"[3:a]volume=0.6,aformat=channel_layouts=stereo,apad=whole_dur={total}[fx];"
        f"[vo][m][fx]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.95,atrim=0:{total}[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(total),
        "-movflags", "+faststart", f"{Z}/zagadka1.mp4"], check=True)
    print("seconds", round(total, 2))


if __name__ == "__main__":
    main()
