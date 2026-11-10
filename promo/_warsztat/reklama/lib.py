"""Dynamic Reel edit: zooms on text lines, punchy captions, whoosh/thud SFX."""
import subprocess, sys, math, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SRC = "/mnt/user-data/uploads/15666_1.mp4"
import os
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fonts")
SW, SH = 1344, 2992
OW, OH = 1080, 1920
FPS = 30
AR = OH / OW

CREAM = (239, 230, 210)
INK = (30, 27, 23)
MUTED = (107, 95, 78)
RED = (179, 32, 30)


def font(name, size, bold=False):
    f = ImageFont.truetype(f"{FONTS}/{name}", size)
    if bold:
        try:
            f.set_variation_by_name("Bold")
        except Exception:
            pass
    return f


F_BIG = font("PixelifySans.ttf", 92, True)
F_SMALL = font("SpecialElite.ttf", 46)


def grab(t, dur=0.0, speed=1.0, SRC=SRC):
    """Return list of RGB frames (PIL) from source starting at t. dur=0 -> single frame."""
    if dur == 0:
        cmd = ["ffmpeg", "-v", "error", "-ss", str(t), "-i", SRC, "-frames:v", "1",
               "-vf", f"scale={SW}:{SH}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    else:
        cmd = ["ffmpeg", "-v", "error", "-ss", str(t), "-t", str(dur * speed), "-i", SRC,
               "-vf", f"setpts=PTS/{speed},fps={FPS},scale={SW}:{SH}",
               "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    n = len(raw) // (SW * SH * 3)
    return [Image.frombuffer("RGB", (SW, SH), raw[i * SW * SH * 3:(i + 1) * SW * SH * 3])
            for i in range(n)]


def ease(x):
    return 0.5 - 0.5 * math.cos(math.pi * min(max(x, 0), 1))


def crop_box(w, cy, cx=SW / 2):
    h = w * AR
    if h > SH:
        h = SH
        w = h / AR
    x0 = min(max(cx - w / 2, 0), SW - w)
    y0 = min(max(cy - h / 2, 0), SH - h)
    return (x0, y0, x0 + w, y0 + h)


def label(big, small, rot):
    """Paper caption label as RGBA image."""
    d0 = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    bw = d0.textlength(big, font=F_BIG)
    sw = d0.textlength(small, font=F_SMALL) if small else 0
    w = int(max(bw, sw) + 80)
    h = 150 + (70 if small else 0)
    im = Image.new("RGBA", (w + 24, h + 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([14, 16, w + 14, h + 16], fill=(0, 0, 0, 110))  # shadow
    d.rectangle([0, 0, w, h], fill=CREAM + (255,))
    d.rectangle([0, 0, 10, h], fill=RED + (255,))
    d.text((40, 22), big, font=F_BIG, fill=INK)
    if small:
        d.text((42, 140), small, font=F_SMALL, fill=MUTED)
    im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    if im.width > 980:
        im = im.resize((980, int(im.height * 980 / im.width)), Image.LANCZOS)
    return im


# Stills: (src_t, out_dur, strip=(x0,y0,x1,y1) in source px, big, small, rot)
# Moves:  (src_t, out_dur, speed, w0, cy0, w1, cy1, big, small, rot, sfx)
SHOTS = [
    ("still", 1.0, 3.0, ("Akta sprawy", "Krawcowa Danuta Kubiak zostaje znaleziona *martwa* w swojej pracowni przy Szopienickiej."), "Kto zabił krawcową?", "Nikiszowiec, 1992", -2, "whoosh"),
    ("still", 14.0, 2.4, ("Notatnik · reguła 1", "Na progu zostały odciski *psich* *łap,* a obok ślady sprawcy."), "Trop 1", "pies", 2, "whoosh"),
    ("still", 49.5, 3.0, ("Dowód rzeczowy", "Kwit z lecznicy dla zwierząt: *odrobaczanie* *psa.* Na kwicie: *K.K.*"), "Kto ma psa?", "inicjały K.K.", -2, "whoosh"),
    ("still", 15.0, 2.8, ("Notatnik · reguła 4", "Sprawca zostawił ślady dłoni na framudze, *ponad* *dwa* *metry* nad podłogą."), "Trop 2", "ktoś bardzo wysoki", 2, "whoosh"),
    ("still", 34.5, 2.6, ("Teczka: Karol Kurek", "Wkręca żarówki na klatce schodowej *bez* *drabiny.*"), "Karol Kurek", "K.K.", -2, "whoosh"),
    ("still", 16.0, 2.0, ("Notatnik · reguła 2", "Drzwi tam, skąd zniknęło narzędzie zbrodni, sprawca otworzył *kluczem,* nie wytrychem."), "Trop 3", "klucz", 2, "whoosh"),
    ("still", 118.5, 2.4, ("Piwnica pod kamienicą", "*Klucz* *ma* *Karol* *Kurek.* Zamek nieuszkodzony."), "Znowu Karol", "", -2, "whoosh"),
    ("still", 17.0, 3.0, ("Notatnik · reguła 3", "Lekarz ustalił czas: między *20:30* a *21:00.* Nikt nie potwierdza, gdzie sprawca był w te pół godziny."), "Ale...", "godzina zbrodni", 2, "whoosh"),
    ("still", 35.5, 3.0, ("Teczka: Karol Kurek", "Od *20:10* do *22:25* był w kinie „Rialto” na ostatnim seansie."), "Alibi: kino", "czy na pewno?", -2, "whoosh"),
    ("move", 70.0, 2.6, 29, 1344, 1150, 1200, 1150, "Łączę fakty", "×30", 2, "whoosh"),
    ("move", 157.3, 2.4, 1, 1344, 2500, 1000, 2500, "Oskarżam!", "", -2, "whoosh"),
    ("move", 161.0, 2.0, 0.55, 1344, 600, 980, 420, "Sprawa zamknięta", "", 2, "thud"),
]


def put_label(out, lab, i):
    if lab is None or i < 2:
        return
    k = min((i - 2) / 5, 1)
    s = 0.75 + 0.25 * (1 - (1 - k) ** 3) + 0.06 * math.sin(k * math.pi)
    lw, lh = int(lab.width * s), int(lab.height * s)
    li = lab.resize((lw, lh), Image.BICUBIC)
    out.alpha_composite(li, (int((OW - lw) / 2), int(390 - lh / 2)))


F_TYPE = font("SpecialElite.ttf", 56)
F_TAG = font("SpecialElite.ttf", 34)
_card_cache = {}


def layout(text, width):
    """Word-wrap text with *red* markup. Returns lines of (word, red)."""
    d = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    words = [(w.strip("*"), w.startswith("*")) for w in text.split(" ")]
    lines, cur, cw = [], [], 0
    sp = d.textlength(" ", font=F_TYPE)
    for w, red in words:
        ww = d.textlength(w, font=F_TYPE)
        if cur and cw + sp + ww > width:
            lines.append(cur); cur, cw = [], 0
        cw += (sp if cur else 0) + ww
        cur.append((w, red))
    if cur:
        lines.append(cur)
    return lines


def typed_card(tag, text, vis, frame):
    TW = 920
    key = (tag, text)
    if key not in _card_cache:
        _card_cache[key] = layout(text, TW - 100)
    lines = _card_cache[key]
    lh = 76
    h = 120 + lh * len(lines) + 40
    im = Image.new("RGBA", (TW + 30, h + 30), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([16, 20, TW + 16, h + 20], fill=(0, 0, 0, 140))
    d.rectangle([0, 0, TW, h], fill=(244, 239, 228, 255))
    for k in range(4, int(h / 38)):
        d.line([0, 40 + k * 38, TW, 40 + k * 38], fill=(60, 90, 140, 40), width=2)
    d.text((50, 36), tag.upper(), font=F_TAG, fill=MUTED)
    sp = d.textlength(" ", font=F_TYPE)
    left = vis
    y = 110
    cursor = None
    for line in lines:
        x = 50
        for w, red in line:
            if left <= 0:
                break
            part = w[:left]
            d.text((x, y), part, font=F_TYPE, fill=RED if red else INK)
            x += d.textlength(part, font=F_TYPE)
            left -= len(w)
            cursor = (x, y)
            if left > 0:
                x += sp
                left -= 0
        y += lh
    if cursor and vis < len(text.replace("*", "")) + 1 and (frame // 4) % 2 == 0:
        cx, cy = cursor
        d.rectangle([cx + 4, cy + 6, cx + 30, cy + 60], fill=INK)
    return im


def render_shot(shot, write):
    from PIL import ImageFilter, ImageEnhance
    kind = shot[0]
    if kind == "still":
        _, t, dur, (tag, text), big, small, rot, _ = shot
        n = int(round(dur * FPS))
        src = grab(t)[0]
        bg = src.filter(ImageFilter.GaussianBlur(9))
        bg = ImageEnhance.Brightness(bg).enhance(0.36)
        lab = label(big, small, rot) if big else None
        total_chars = len(text.replace("*", ""))
        reveal = max(int(n * 0.55), 1)
        for i in range(n):
            p = ease(i / max(n - 1, 1))
            box = crop_box(1344 - 200 * p, 2000)
            out = bg.resize((OW, OH), Image.BICUBIC, box=box).convert("RGBA")
            vis = int(total_chars * min((i + 1) / reveal, 1))
            card = typed_card(tag, text, vis, i)
            k = min(i / 5, 1)
            sc = 0.92 + 0.08 * (1 - (1 - k) ** 3) + 0.03 * p
            cw, ch = int(card.width * sc), int(card.height * sc)
            ci = card.resize((cw, ch), Image.BICUBIC)
            y = int(1060 - ch / 2 + 50 * (1 - k))
            out.alpha_composite(ci, (int((OW - cw) / 2), y))
            put_label(out, lab, i)
            write(out.convert("RGB").tobytes())
        return n
    _, t, dur, speed, w0, cy0, w1, cy1, big, small, rot, _ = shot
    n = int(round(dur * FPS))
    frames = grab(t, dur, speed)
    lab = label(big, small, rot) if big else None
    for i in range(n):
        src = frames[min(i, len(frames) - 1)]
        p = ease(i / max(n - 1, 1))
        box = crop_box(w0 + (w1 - w0) * p, cy0 + (cy1 - cy0) * p)
        out = src.resize((OW, OH), Image.BICUBIC, box=box).convert("RGBA")
        put_label(out, lab, i)
        write(out.convert("RGB").tobytes())
    return n


def endcard(write, dur=2.5):
    base = Image.open("endcard.png").convert("RGB")
    n = int(dur * FPS)
    for i in range(n):
        p = ease(i / (n - 1))
        w = OW * (1.0 - 0.06 * p)
        box = ((OW - w) / 2, (OH - w * AR) / 2, (OW + w) / 2, (OH + w * AR) / 2)
        write(base.resize((OW, OH), Image.BICUBIC, box=box).tobytes())
    return n


def sfx(cuts, total, path):
    sr = 44100
    a = np.zeros(int(total * sr) + sr)
    rng = np.random.default_rng(7)
    for t, kind in cuts:
        s = int(t * sr)
        if kind == "whoosh":
            L = int(0.28 * sr)
            noise = rng.standard_normal(L)
            # band-limited sweep: moving average with shrinking window
            env = np.sin(np.linspace(0, np.pi, L)) ** 2
            sig = np.convolve(noise, np.ones(12) / 12, mode="same") * env * 0.35
            a[s:s + L] += sig
        else:  # thud: low sine with fast decay + click
            L = int(0.5 * sr)
            tt = np.arange(L) / sr
            sig = np.sin(2 * np.pi * (80 - 40 * tt) * tt) * np.exp(-tt * 9) * 0.9
            sig[:200] += rng.standard_normal(200) * 0.4
            a[s:s + L] += sig
    a = np.clip(a, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((a * 32767).astype(np.int16).tobytes())


def main():
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                            "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
                            "-pix_fmt", "yuv420p", "video.mp4"], stdin=subprocess.PIPE)
    total = 0
    cuts = []
    DURS=[4.14,2.35,4.73,2.58,2.91,1.65,2.46,3.12,2.94,1.82,1.68,1.57]
    for j, sh in enumerate(SHOTS):
        sh = sh[:2] + (DURS[j],) + sh[3:]
        cuts.append((total / FPS, sh[-1]))
        total += render_shot(sh, enc.stdin.write)
    cuts.append((total / FPS, "whoosh"))
    total += endcard(enc.stdin.write, 4.05)
    enc.stdin.close(); enc.wait()
    sfx(cuts, total / FPS, "sfx.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "video.mp4", "-i", "sfx.wav",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest",
                    "-movflags", "+faststart", "reel_vid_sfx.mp4"], check=True)
    print("frames", total, "seconds", total / FPS)


