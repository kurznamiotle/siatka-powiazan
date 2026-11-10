"""Promo ad for Siatka Powiązań: pager hook + typewriter cards + VO-timed shots.
Usage: python ad.py 30|15
"""
import sys, math, random, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
sys.path.insert(0, ".")
import lib
from lib import (OW, OH, FPS, CREAM, INK, MUTED, RED, font, ease, crop_box, label,
                 put_label, typed_card)

A = "/mnt/user-data/uploads/15681.mp4"   # small case (Kantor przy Augustiańskiej)
B = "/mnt/user-data/uploads/15682.mp4"   # big XL board
VO = "vo2.mp3"
END = "end1.mp3"
MUSIC = "../muzyka/mus1.mp3"

# VO clips: name -> (file, in, out)
CLIPS = {
    "feliks": (VO, 0.00, 1.25),
    "krakow": (VO, 1.70, 5.55),
    "czworo": (VO, 5.80, 8.17),
    "czytaj": (VO, 8.50, 10.52),
    "nie":    (VO, 10.76, 12.05),
    "szukaj": (VO, 12.29, 13.28),
    "polacz": (VO, 13.43, 14.33),
    "wskaz":  (VO, 14.58, 15.75),
    "zamk":   (VO, 15.97, 17.23),
    "polska": (VO, 17.50, 19.15),
    "codz":   (VO, 19.31, 22.43),
    "codz_short": (VO, 19.31, 20.75),
    "end":    (END, 0.15, 3.10),
}

# Shot kinds:
#  hook: (kind, dur, vo)
#  card: (kind, dur, vo, src, t, tag, text, big, small, rot)
#  move: (kind, dur, vo, src, t, speed, w0, cy0, w1, cy1, big, small, rot, sfx)
#  end : (kind, dur, vo)
S = {
    "hook": ("hook", 2.0, "feliks"),
    "krakow": ("card", 4.3, "krakow", A, 1.5, "Akta sprawy · Kazimierz, IV 1995",
               "Feliks Kulesza, właściciel kantoru przy Augustiańskiej, zostaje znaleziony *martwy* za ladą. *Został* *uduszony* *sznurem.*",
               "Kraków, 1995", "kantor przy Augustiańskiej", -2),
    "czworo": ("move", 2.7, "czworo", A, 12.0, 1.0, 1200, 1420, 760, 1060,
               "4 podejrzanych", "1 sprawca", 2, "whoosh"),
    "czytaj": ("card", 2.4, "czytaj", A, 34.5, "Teczka: Barbara Gołębiowska",
               "Od *19:15* do *21:25* liczyła towar na remanencie w hurtowni Społem. Potwierdzają to kierowniczka i protokół.",
               "Czytaj teczki", "sprawdzaj alibi", -2),
    "nie": ("card", 1.7, "nie", A, 55.5, "Teczka: Waldemar Kubiak",
            "Zapewnia, że słuchał Trójki w kuchni. *Potwierdzić* *tego* *nie* *ma* *kto.*",
            "Nie każde", "się potwierdzi", 2),
    "szukaj": ("card", 1.6, "szukaj", A, 100.5, "Dowód rzeczowy · kwit z parkingu",
               "Parkingowy zapisał nazwisko kierowcy, czytelne tylko inicjały: *B.G.*",
               "Szukaj dowodów", "kwity, bilety, paragony", -2),
    "polacz": ("move", 2.2, "polacz", A, 40.0, 27, 1100, 1330, 980, 1280,
               "Połącz fakty", "", 2, "whoosh"),
    "wskaz": ("move", 1.7, "wskaz", A, 119.6, 1.1, 1344, 2100, 1100, 2350,
              "Wskaż sprawcę", "", -2, "whoosh"),
    "zamk": ("move", 1.7, "zamk", A, 122.75, 0.45, 1300, 1495, 1240, 1460,
             "", "", 0, "thud"),
    "polska": ("card", 2.0, "polska", B, 30.0, "Polska, 1989–1999",
               "Praga · Jeżyce · Kazimierz · Bałuty · Wrzeszcz · Nikiszowiec · Nadodrze",
               "Polska lat 90.", "7 miast", 2),
    "codz": ("move", 3.4, "codz", B, 8.0, 12, 1150, 1400, 980, 1300,
             "Codziennie nowa sprawa", "za darmo · bez reklam", -2, "whoosh"),
    "codz15": ("move", 1.9, "codz_short", B, 8.0, 12, 1150, 1400, 1000, 1300,
               "Codziennie nowa sprawa", "za darmo · bez reklam", -2, "whoosh"),
    "end": ("end", 3.3, "end"),
}

VERSIONS = {
    "30": ["hook", "krakow", "czworo", "czytaj", "nie", "szukaj", "polacz", "wskaz",
           "zamk", "polska", "codz", "end"],
    "15": ["hook", "szukaj", "polacz", "wskaz", "zamk", "polska", "codz15", "end"],
}
# 15 s version: slightly tighter shots
TIGHT = {"szukaj": 1.4, "polacz": 1.3, "wskaz": 1.4, "zamk": 1.5, "polska": 1.9, "end": 3.1}


# ---------- hook: vibrating 90s pager ----------
LCD = (152, 170, 118)
LCD_INK = (28, 38, 22)
F_LCD = font("PixelifySans.ttf", 78, True)
F_LCD_S = font("PixelifySans.ttf", 44)


def pager_frame(t):
    im = Image.new("RGB", (OW, OH), (12, 10, 9))
    d = ImageDraw.Draw(im)
    # faint red glow behind the pager
    glow = Image.new("L", (OW, OH), 0)
    ImageDraw.Draw(glow).ellipse([90, 520, 990, 1300], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    im.paste((90, 20, 18), (0, 0), glow)
    # shake while buzzing
    buzz = t < 1.25
    rnd = random.Random(int(t * 1000))
    ox = rnd.uniform(-11, 11) if buzz else 0
    oy = rnd.uniform(-6, 6) if buzz else 0
    body = Image.new("RGBA", (920, 600), (0, 0, 0, 0))
    b = ImageDraw.Draw(body)
    b.rounded_rectangle([0, 0, 919, 599], radius=70, fill=(36, 36, 38, 255))
    b.rounded_rectangle([14, 14, 905, 585], radius=60, outline=(58, 58, 62, 255), width=6)
    b.rounded_rectangle([70, 70, 850, 400], radius=18, fill=(20, 22, 18, 255))
    b.rectangle([86, 86, 834, 384], fill=LCD + (255,))
    for gx in range(86, 834, 6):  # LCD pixel grid
        b.line([gx, 86, gx, 384], fill=(140, 158, 108, 255))
    for gy in range(86, 384, 6):
        b.line([86, gy, 834, gy], fill=(140, 158, 108, 255))
    # typed lines
    lines = [("PILNE  23:47", 0.08, 0.30, F_LCD_S), ("FELIKS NIE ŻYJE", 0.30, 0.85, F_LCD),
             ("KANTOR · KAZIMIERZ", 0.85, 1.20, F_LCD_S)]
    y = 108
    for text, a, z, f in lines:
        k = min(max((t - a) / (z - a), 0), 1)
        vis = text[: int(round(len(text) * k))]
        b.text((112, y), vis, font=f, fill=LCD_INK)
        y += 70 if f is F_LCD_S else 104
    # buttons
    for bx in (210, 400, 590):
        b.rounded_rectangle([bx, 450, bx + 120, 520], radius=20, fill=(52, 52, 56, 255))
    rot = rnd.uniform(-1.3, 1.3) if buzz else 0
    body = body.rotate(rot, resample=Image.BICUBIC, expand=True)
    # final push-in on the LCD
    zoom = 1.0 + (ease((t - 1.75) / 0.25) * 0.6 if t > 1.75 else 0)
    if zoom > 1:
        body = body.resize((int(body.width * zoom), int(body.height * zoom)), Image.BICUBIC)
    im.paste(body, (int((OW - body.width) / 2 + ox), int(880 - body.height / 2 + oy - (zoom - 1) * 260)), body)
    # red string whip
    if t > 1.35:
        k = ease((t - 1.35) / 0.35)
        x0, y0, x1, y1 = -40, 300, 1120, 1560
        xe, ye = x0 + (x1 - x0) * k, y0 + (y1 - y0) * k
        d.line([(x0 + 5, y0 + 8), (xe + 5, ye + 8)], fill=(40, 10, 8), width=16)
        d.line([(x0, y0), (xe, ye)], fill=RED, width=16)
        d.ellipse([xe - 26, ye - 26, xe + 26, ye + 26], fill=RED)
    # flash
    if t > 1.88:
        a = (t - 1.88) / 0.12
        im = Image.blend(im, Image.new("RGB", (OW, OH), (250, 245, 235)), min(a, 1) * 0.85)
    return im


def render_hook(dur, write):
    n = int(round(dur * FPS))
    for i in range(n):
        write(pager_frame(i / FPS).tobytes())
    return n


# ---------- cards / moves ----------
def render_card(sh, dur, write):
    _, _, _, src, t, tag, text, big, small, rot = sh
    n = int(round(dur * FPS))
    frame = lib.grab(t, SRC=src)[0]
    bg = ImageEnhance.Brightness(frame.filter(ImageFilter.GaussianBlur(9))).enhance(0.36)
    lab = label(big, small, rot) if big else None
    total_chars = len(text.replace("*", ""))
    reveal = max(int(n * (0.5 if dur >= 2.2 else 0.36)), 1)
    for i in range(n):
        p = ease(i / max(n - 1, 1))
        out = bg.resize((OW, OH), Image.BICUBIC, box=crop_box(1344 - 200 * p, 1900)).convert("RGBA")
        vis = int(total_chars * min((i + 1) / reveal, 1)) + 20 * (i >= reveal)
        card = typed_card(tag, text, vis, i)
        k = min(i / 5, 1)
        sc = 0.92 + 0.08 * (1 - (1 - k) ** 3) + 0.03 * p
        ci = card.resize((int(card.width * sc), int(card.height * sc)), Image.BICUBIC)
        out.alpha_composite(ci, (int((OW - ci.width) / 2), int(1080 - ci.height / 2 + 50 * (1 - k))))
        put_label(out, lab, i)
        write(out.convert("RGB").tobytes())
    return n


def render_move(sh, dur, write):
    _, _, _, src, t, speed, w0, cy0, w1, cy1, big, small, rot, _ = sh
    n = int(round(dur * FPS))
    frames = lib.grab(t, dur, speed, SRC=src)
    lab = label(big, small, rot) if big else None
    for i in range(n):
        fr = frames[min(i, len(frames) - 1)]
        p = ease(i / max(n - 1, 1))
        out = fr.resize((OW, OH), Image.BICUBIC,
                        box=crop_box(w0 + (w1 - w0) * p, cy0 + (cy1 - cy0) * p)).convert("RGBA")
        put_label(out, lab, i)
        write(out.convert("RGB").tobytes())
    return n


def make_endcard():
    W, H = OW, OH
    im = Image.new("RGB", (W, H), (26, 23, 20))
    d = ImageDraw.Draw(im)
    pts = [(260, 520), (820, 470), (540, 700)]
    for a, b in [(0, 1), (1, 2), (2, 0)]:
        d.line([pts[a], pts[b]], fill=RED, width=8)
    for x, y in pts:
        d.ellipse([x - 26, y - 26, x + 26, y + 26], fill=RED)
        d.ellipse([x - 16, y - 16, x - 4, y - 4], fill=(242, 160, 144))

    def c(y, s, f, fill):
        w = d.textlength(s, font=f)
        d.text(((W - w) / 2, y), s, font=f, fill=fill)
    c(860, "Siatka Powiązań", font("PixelifySans.ttf", 104, True), CREAM)
    c(1010, "Zagraj w dzisiejszą sprawę.", font("SpecialElite.ttf", 48), CREAM)
    c(1075, "Za darmo, bez reklam, bez logowania.", font("SpecialElite.ttf", 38), (181, 168, 143))
    fl = font("CourierPrime-Bold.ttf", 64)
    t = "siatkapowiazan.pl"
    tw = d.textlength(t, font=fl)
    x0 = (W - tw) / 2 - 34
    d.rectangle([x0, 1210, x0 + tw + 68, 1320], fill=RED)
    d.text((x0 + 34, 1228), t, font=fl, fill=(255, 255, 255))
    c(1370, "link w bio", font("SpecialElite.ttf", 44), (181, 168, 143))
    im.save("endcard.png")


def render_end(dur, write):
    base = Image.open("endcard.png").convert("RGB")
    n = int(round(dur * FPS))
    for i in range(n):
        p = ease(i / max(n - 1, 1))
        w = OW * (1.0 - 0.06 * p)
        box = ((OW - w) / 2, (OH - w * OH / OW) / 2, (OW + w) / 2, (OH + w * OH / OW) / 2)
        write(base.resize((OW, OH), Image.BICUBIC, box=box).tobytes())
    return n


# ---------- audio ----------
SR = 44100


def synth_sfx(events, total, path):
    a = np.zeros(int((total + 1) * SR))
    rng = np.random.default_rng(11)

    def add(t, sig):
        s = int(t * SR)
        a[s:s + len(sig)] += sig[: len(a) - s]

    for t, kind in events:
        if kind == "whoosh":
            L = int(0.28 * SR)
            sig = np.convolve(rng.standard_normal(L), np.ones(12) / 12, "same")
            add(t, sig * np.sin(np.linspace(0, np.pi, L)) ** 2 * 0.35)
        elif kind == "whip":
            L = int(0.35 * SR)
            n = np.convolve(rng.standard_normal(L), np.ones(5) / 5, "same")
            add(t, n * np.linspace(0, 1, L) ** 2 * np.exp(-np.linspace(0, 3, L)) * 0.9)
        elif kind == "thud":
            L = int(0.5 * SR)
            tt = np.arange(L) / SR
            sig = np.sin(2 * np.pi * (80 - 40 * tt) * tt) * np.exp(-tt * 9) * 0.9
            sig[:200] += rng.standard_normal(200) * 0.4
            add(t, sig)
        elif kind == "beep":
            L = int(0.09 * SR)
            tt = np.arange(L) / SR
            add(t, np.sign(np.sin(2 * np.pi * 2350 * tt)) * 0.16 * np.minimum(1, (L - np.arange(L)) / 400))
        elif kind == "buzz":
            L = int(1.2 * SR)
            tt = np.arange(L) / SR
            sig = np.sin(2 * np.pi * 150 * tt) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 6 * tt))) * 0.22
            add(t, sig)
    a = np.clip(a, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((a * 32767).astype(np.int16).tobytes())


def main(ver):
    order = VERSIONS[ver]
    make_endcard()
    vid = f"ad{ver}_video.mp4"
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                            "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-", "-c:v", "libx264",
                            "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", vid],
                           stdin=subprocess.PIPE)
    w = enc.stdin.write
    frames = 0
    vo_events, sfx_events = [], []
    for name in order:
        sh = S[name]
        kind, dur, vo = sh[0], sh[1], sh[2]
        if ver == "15" and name in TIGHT:
            dur = TIGHT[name]
        start = frames / FPS
        clip = CLIPS[vo]
        clip_len = clip[2] - clip[1]
        if kind == "hook":
            vo_events.append((start + 0.55, vo))
            sfx_events += [(0.04, "beep"), (0.19, "beep"), (0.34, "beep"), (0.0, "buzz"), (1.33, "whip")]
            frames += render_hook(dur, w)
            continue
        lead = 0.12
        dur = max(dur, clip_len + lead + 0.15)
        vo_events.append((start + lead, vo))
        if kind == "card":
            sfx_events.append((start, "whoosh"))
            frames += render_card(sh, dur, w)
        elif kind == "move":
            sfx_events.append((start, sh[-1]))
            frames += render_move(sh, dur, w)
        else:
            sfx_events.append((start, "whoosh"))
            frames += render_end(dur, w)
    enc.stdin.close(); enc.wait()
    total = frames / FPS
    synth_sfx(sfx_events, total, f"ad{ver}_sfx.wav")
    # VO track: place clips
    inputs, filt, labels = [], [], []
    for k, (t, vo) in enumerate(vo_events):
        f, a, z = CLIPS[vo]
        inputs += ["-i", f]
        ms = int(t * 1000)
        filt.append(f"[{k}:a]atrim={a}:{z},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,adelay={ms}|{ms}[v{k}]")
        labels.append(f"[v{k}]")
    filt.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0,apad,atrim=0:{total}[vo]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(filt),
                    "-map", "[vo]", f"ad{ver}_vo.wav"], check=True)
    fade = total - 1.2
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-i", vid, "-i", f"ad{ver}_vo.wav", "-i", MUSIC, "-i", f"ad{ver}_sfx.wav",
        "-filter_complex",
        "[1:a]highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,"
        "loudnorm=I=-15:TP=-1.5:LRA=7,aresample=44100,aformat=channel_layouts=stereo,"
        f"apad=whole_dur={total},asplit=2[vo][key];"
        f"[2:a]atrim=0:{total},afade=t=in:st=0:d=0.3,afade=t=out:st={fade}:d=1.2,volume=0.6,"
        "aformat=channel_layouts=stereo[m0];"
        "[m0][key]sidechaincompress=threshold=0.03:ratio=7:attack=20:release=300[m];"
        "[3:a]volume=0.55,aformat=channel_layouts=stereo[fx];"
        "[vo][m][fx]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.95,"
        f"apad=whole_dur={total},atrim=0:{total},aresample=48000[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-t", str(total), "-movflags", "+faststart", f"siatka_reklama_{ver}s.mp4"], check=True)
    print(ver, "seconds", round(total, 2))


main(sys.argv[1])
