"""Zagadka #1 v2: dynamic cut, flashlight on dark cork, film grain, redaction bars,
developing polaroids, summary board during the countdown."""
import math, random, subprocess, wave, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

src = open(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "zag.py")).read()
src = src.replace('if __name__ == "__main__":\n    main()', '')
exec(compile(src, "zag.py", "exec"))   # font, BG, PORT, NAMES, polaroid, pin, paste_rot, label, ease, pop, OW, OH, FPS...

K = 1.08          # VO speed-up
OFF = 0.20
def f(t): return OFF + t / K

# ---------- precomputed layers ----------
rng = np.random.default_rng(5)
LIT = np.asarray(BG.convert("RGB"), dtype=np.float32)
yy, xx = np.mgrid[0:OH, 0:OW].astype(np.float32)
VIG = np.clip(1.25 - 0.95 * (((xx - OW / 2) / (OW * 0.62)) ** 2 + ((yy - OH / 2) / (OH * 0.6)) ** 2), 0.25, 1.0)[..., None]
GRAIN = [rng.normal(0, 11, (OH // 2, OW // 2)).astype(np.float32) for _ in range(6)]
GRAIN = [np.kron(g, np.ones((2, 2), np.float32))[..., None] for g in GRAIN]
smoke_small = Image.fromarray((rng.random((160, 90)) * 255).astype(np.uint8)).resize((OW, OH + 600), Image.BICUBIC).filter(ImageFilter.GaussianBlur(60))
SMOKE = np.asarray(smoke_small, dtype=np.float32) / 255.0
LY, LX = np.mgrid[0:OH // 8, 0:OW // 8].astype(np.float32) * 8


def light_map(spots, ambient):
    m = np.full((OH // 8, OW // 8), ambient, np.float32)
    for (cx, cy, r, s) in spots:
        m = np.maximum(m, ambient + (1 - ambient) * s * np.exp(-(((LX - cx) ** 2 + (LY - cy) ** 2) / (2 * (r * 0.55) ** 2))))
    img = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).resize((OW, OH), Image.BILINEAR)
    return (np.asarray(img, np.float32) / 255.0)[..., None]


def finish(scene, spots, ambient, i, zoom=1.0, shake=(0, 0), flash=0.0, cx=OW / 2, cy=OH / 2):
    a = np.asarray(scene.convert("RGB"), np.float32)
    lm = light_map(spots, ambient)
    warm = np.array([1.0, 0.93, 0.80], np.float32)
    a = a * lm * (0.6 + 0.4 * warm) + a * 0.0
    a = a * VIG
    sm = SMOKE[int(300 + 40 * math.sin(i / 37)) - int(i * 0.9) % 300: , :][:OH][..., None]
    if sm.shape[0] < OH: sm = np.pad(sm, ((0, OH - sm.shape[0]), (0, 0), (0, 0)), mode="edge")
    a = a + sm * 26 * (1 - lm * 0.5)
    a = a + GRAIN[i % len(GRAIN)]
    a = a * (1 + 0.035 * math.sin(i * 2.7) * math.sin(i * 0.9))
    if flash > 0: a = a + (255 - a) * flash
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    if zoom != 1.0 or shake != (0, 0):
        w = OW / zoom; h = OH / zoom
        x0 = min(max(cx - w / 2 + shake[0], 0), OW - w); y0 = min(max(cy - h / 2 + shake[1], 0), OH - h)
        img = img.resize((OW, OH), Image.BICUBIC, box=(x0, y0, x0 + w, y0 + h))
    return img


# ---------- elements ----------
def polaroid_dev(who, w, dev):
    p = polaroid(who, w)
    if dev >= 1: return p
    g = p.convert("L").filter(ImageFilter.GaussianBlur(w / 40)).convert("RGBA")
    g.putalpha(p.split()[3])
    gray = Image.new("RGBA", p.size, (96, 92, 86, 255)); gray.putalpha(p.split()[3])
    pad = int(w * 0.06); ph = w - 2 * pad
    blank = p.copy(); ImageDraw.Draw(blank).rectangle([pad, pad, pad + ph, pad + ph], fill=(70, 66, 60, 255))
    k = ease(dev)
    return Image.blend(blank, p, k)


F_CARD = font("SpecialElite.ttf", 56)
F_CARD_S = font("SpecialElite.ttf", 34)


def tokens(text):
    out = []; red = False
    for w in text.split(" "):
        start = w.startswith("["); end = w.endswith("]")
        clean = w.strip("[]")
        if start: red = True
        out.append((clean, red))
        if end: red = False
    return out


def card_r(tag, text, nwords, bar_k, width=880, fnt=F_CARD, lh=76):
    toks = tokens(text)
    d0 = ImageDraw.Draw(Image.new("RGB", (1, 1))); sp = d0.textlength(" ", font=fnt)
    lines, cur, cw = [], [], 0
    for w, red in toks:
        ww = d0.textlength(w, font=fnt)
        if cur and cw + sp + ww > width - 96: lines.append(cur); cur, cw = [], 0
        cw += (sp if cur else 0) + ww; cur.append((w, red, ww))
    if cur: lines.append(cur)
    h = 96 + lh * len(lines) + 34
    im = Image.new("RGBA", (width + 24, h + 24), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([14, 18, width + 14, h + 18], fill=(10, 5, 0, 150))
    d.rectangle([0, 0, width, h], fill=PAPER + (255,))
    for k in range(3, int(h / 38)):
        d.line([0, 28 + k * 38, width, 28 + k * 38], fill=(60, 90, 140, 36), width=2)
    d.text((48, 30), tag.upper(), font=F_TAG, fill=MUTED)
    y = 92; n = 0
    for line in lines:
        x = 48
        for w, red, ww in line:
            if n >= nwords: break
            d.text((x, y), w, font=fnt, fill=RED if red else INK)
            if red and bar_k < 1:
                kk = ease(bar_k)
                if kk < 0.97:
                    d.rectangle([x - 4 + (ww + 10) * kk, y + 4, x + ww + 6, y + lh - 10], fill=(18, 16, 14, 255))
            x += ww + sp; n += 1
        y += lh
    return im


def note(text, w=300, fnt=None, border=None):
    fnt = fnt or font("SpecialElite.ttf", 31)
    d0 = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    words = text.split(" "); lines = []; cur = ""
    for wd in words:
        t = (cur + " " + wd).strip()
        if d0.textlength(t, font=fnt) > w - 36: lines.append(cur); cur = wd
        else: cur = t
    lines.append(cur)
    lh = int(fnt.size * 1.28)
    h = 26 + lh * len(lines) + 14
    im = Image.new("RGBA", (w + 12, h + 12), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([8, 10, w + 8, h + 10], fill=(10, 5, 0, 140))
    d.rectangle([0, 0, w, h], fill=(232, 221, 181, 255), outline=border or (138, 122, 85, 255), width=6 if border else 2)
    for k, ln in enumerate(lines): d.text((18, 18 + lh * k), ln, font=fnt, fill=INK)
    return im


def scene_base():
    return BG.copy().convert("RGBA")


# ---------- shots ----------
WORDS_FAST = 0.30  # seconds to reveal all words


def s_hook(t, i):
    sc = scene_base(); d = ImageDraw.Draw(sc)
    pos = [("bernard", 250, 880, -6, 0.0), ("danuta", 540, 820, 3, 0.45), ("ryszarda", 830, 890, 7, 0.9)]
    spots = []
    for who, x, y, r, t0 in pos:
        if t < t0: continue
        paste_rot(sc, polaroid_dev(who, 300, (t - t0) / 0.6), r, x, y, pop((t - t0) * FPS, 4))
    d = ImageDraw.Draw(sc)
    for who, x, y, r, t0 in pos:
        if t >= t0 + 0.1: pin(d, x, y - 190)
    sx = 150 + (OW - 300) * ease(t / 2.4); spots.append((sx, 860, 520, 1.0))
    if t > 1.8:
        paste_rot(sc, label("Ktoś tu kłamie.", None, -2), 0, OW / 2, 420, pop((t - 1.8) * FPS))
        spots.append((OW / 2, 420, 600, 1.0))
    flash = max(0, 0.8 - t * 4) if t < 0.2 else 0
    return finish(sc, spots, 0.13, i, zoom=1.0 + 0.04 * t, flash=flash)


def s_place(t, i, dur):
    sc = scene_base(); d = ImageDraw.Draw(sc)
    big = font("PixelifySans.ttf", 150, True)
    for k, s in enumerate(["WROCŁAW", "I · 1993"]):
        tt = t - k * 0.35
        if tt < 0: continue
        tw = d.textlength(s, font=big); x = (OW - tw) / 2 + 60 * (1 - ease(tt / 0.25)); y = 760 + k * 190
        d.text((x + 8, y + 10), s, font=big, fill=(20, 10, 4)); d.text((x, y), s, font=big, fill=CREAM if k == 0 else RED)
    small = font("SpecialElite.ttf", 44); s = "Nadodrze · zakrystia katedry"
    if t > 0.7: d.text(((OW - d.textlength(s, font=small)) / 2, 1160), s, font=small, fill=CREAM)
    spots = [(OW / 2 + 200 * math.sin(t * 2), 950, 640, 1.0)]
    return finish(sc, spots, 0.12, i, zoom=1.0 + 0.06 * ease(t / dur))


def s_card(t, i, dur, tag, text, reveal_at, who=None, ypos=1160, base_zoom=0.05, cy_focus=None):
    sc = scene_base(); d = ImageDraw.Draw(sc)
    nwords = len(text.split(" "))
    nvis = int(nwords * min(1, t / WORDS_FAST)) if t < WORDS_FAST else nwords
    bar_k = (t - reveal_at) / 0.18 if reveal_at is not None and t > reveal_at else 0
    if reveal_at is None: bar_k = 1
    spots = []
    if who:
        paste_rot(sc, polaroid_dev(who, 360, 1), -4, OW / 2, 720)
        d = ImageDraw.Draw(sc); pin(d, OW / 2, 720 - 228)
        spots.append((OW / 2, 720, 520, 0.9))
    c = card_r(tag, text, nvis, bar_k)
    k = ease(t / 0.15)
    sc.alpha_composite(c, (int((OW - c.width) / 2 + 120 * (1 - k)), int(ypos)))
    spots.append((OW / 2, ypos + c.height / 2, 760, 1.0))
    zoom = 1.0 + base_zoom * ease(t / dur); shake = (0, 0); flash = 0
    if reveal_at is not None and t > reveal_at:
        q = t - reveal_at
        zoom += 0.07 * math.exp(-q * 3) * min(1, q / 0.08)
        if q < 0.18: shake = (random.uniform(-7, 7), random.uniform(-7, 7))
    return finish(sc, spots, 0.14, i, zoom=zoom, shake=shake, flash=flash, cy=cy_focus or (ypos + 160))


def s_portrait(t, i, dur, who):
    sc = scene_base()
    paste_rot(sc, polaroid_dev(who, 520, t / 0.5), -3, OW / 2, 900, pop(t * FPS, 4))
    d = ImageDraw.Draw(sc); pin(d, OW / 2, 900 - 320)
    sx = OW / 2 - 320 + 640 * ease(t / dur)
    return finish(sc, [(sx, 900, 620, 1.0)], 0.1, i, zoom=1.0 + 0.08 * ease(t / dur))


SUM = [("bernard", 190, 600, -4, "„Koło Fortuny” w domu. Sam, bez świadków."),
       ("danuta", 540, 570, 2, "Pogotowie 19:40–21:25. Wpis w książce przyjęć."),
       ("ryszarda", 890, 610, 4, "Zebranie koła wędkarskiego 19:30–21:10. Prezes i protokół.")]


def s_board(t, i, dur, cd_start):
    sc = scene_base(); d = ImageDraw.Draw(sc)
    paste_rot(sc, label("Czyje alibi się sypie?", None, -2), 0, OW / 2, 250, pop(t * FPS))
    for who, x, y, r, txt in SUM:
        paste_rot(sc, polaroid_dev(who, 270, 1), r, x, y)
        paste_rot(sc, note(txt, 340, font("SpecialElite.ttf", 36)), r * 0.5, x, y + 330)
    d = ImageDraw.Draw(sc)
    for who, x, y, r, txt in SUM: pin(d, x, y - 175)
    clue = note("Dopisek w teczce Danuty: zebranie koła wędkarskiego się NIE odbyło. W świetlicy wysiadło ogrzewanie.", 900,
                font("SpecialElite.ttf", 46), border=RED)
    paste_rot(sc, clue, -1.5, OW / 2, 1300, pop(max(0, t - 0.4) * FPS) if t > 0.4 else 0.01)
    d = ImageDraw.Draw(sc); pin(d, OW / 2 + 380, 1300 - clue.height / 2 + 12)
    spots = [(OW / 2 + 380 * math.sin(t * 1.3), 760 + 300 * math.sin(t * 0.7), 560, 0.7)]
    tc = t - cd_start
    if tc >= 0 and tc < 5:
        secs = 5 - int(tc); fr = tc % 1
        fz = font("CourierPrime-Bold.ttf", int(170 * (1.2 - 0.2 * ease(fr * 3))))
        s = str(secs); tw = d.textlength(s, font=fz)
        d.text(((OW - tw) / 2 + 6, 1530 + 8), s, font=fz, fill=(20, 8, 2)); d.text(((OW - tw) / 2, 1530), s, font=fz, fill=RED)
        spots.append((OW / 2, 1620, 260, 1.0))
    return finish(sc, spots, 0.78, i, zoom=1.0 + 0.01 * ease(t / dur))


def s_end(t, i):
    out = shot_end(0, 1)
    return finish(out, [(OW / 2, 1100, 900, 1.0)], 0.35, i, zoom=1.0 + 0.03 * t)


# ---------- timeline (output seconds) ----------
T = dict(hook=(0, f(2.80)), place=(f(2.80), f(5.20)), intro=(f(5.20), f(6.76)),
         b_p=(f(6.76), f(7.60)), b_c=(f(7.60), f(9.92)),
         d_p=(f(9.92), f(10.68)), d_c=(f(10.68), f(14.10)),
         r_p=(f(14.10), f(14.98)), r_c=(f(14.98), f(18.66)),
         trop=(f(18.66), f(21.56)))
CD_VO_END = f(24.40)
T["board"] = (f(21.56), CD_VO_END + 5.15)
T["end"] = (T["board"][1], T["board"][1] + 3.05)


def render():
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OW}x{OH}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                            "-pix_fmt", "yuv420p", f"{Z}/zag2_video.mp4"], stdin=subprocess.PIPE)
    total = T["end"][1]; n = int(round(total * FPS))
    def rel(t, key): return f(t) - T[key][0]
    for i in range(n):
        t = i / FPS
        if t < T["hook"][1]: im = s_hook(t, i)
        elif t < T["place"][1]: a = T["place"]; im = s_place(t - a[0], i, a[1] - a[0])
        elif t < T["intro"][1]:
            a = T["intro"]; im = s_card(t - a[0], i, a[1] - a[0], "Akta sprawy", "Organista Karol Szulc. Znaleziony w zakrystii. [Uduszony sznurem.]", rel(5.28, "intro"), ypos=820, base_zoom=0.06, cy_focus=1000)
        elif t < T["b_p"][1]: a = T["b_p"]; im = s_portrait(t - a[0], i, a[1] - a[0], "bernard")
        elif t < T["b_c"][1]:
            a = T["b_c"]; im = s_card(t - a[0], i, a[1] - a[0], "Bernard K. · alibi", "„Oglądałem Koło Fortuny u siebie w pokoju.” [Potwierdzić nie ma kto.]", rel(9.28, "b_c"), who="bernard")
        elif t < T["d_p"][1]: a = T["d_p"]; im = s_portrait(t - a[0], i, a[1] - a[0], "danuta")
        elif t < T["d_c"][1]:
            a = T["d_c"]; im = s_card(t - a[0], i, a[1] - a[0], "Danuta W. · alibi", "Od 19:40 do 21:25 w poczekalni pogotowia z sąsiadem. [Jest wpis w książce przyjęć.]", rel(12.16, "d_c"), who="danuta")
        elif t < T["r_p"][1]: a = T["r_p"]; im = s_portrait(t - a[0], i, a[1] - a[0], "ryszarda")
        elif t < T["r_c"][1]:
            a = T["r_c"]; im = s_card(t - a[0], i, a[1] - a[0], "Ryszarda W. · alibi", "Od 19:30 do 21:10 na zebraniu koła wędkarskiego. [Potwierdzają prezes i protokół.]", rel(16.72, "r_c"), who="ryszarda")
        elif t < T["trop"][1]:
            a = T["trop"]; im = s_card(t - a[0], i, a[1] - a[0], "Teczka Danuty W. · dopisek", "Mówi, że zebranie koła wędkarskiego [się nie odbyło,] bo w świetlicy wysiadło ogrzewanie.", rel(20.40, "trop"), ypos=760, base_zoom=0.08, cy_focus=960)
        elif t < T["board"][1]: a = T["board"]; im = s_board(t - a[0], i, a[1] - a[0], CD_VO_END - a[0] + 0.05)
        else: im = s_end(t - T["end"][0], i)
        enc.stdin.write(im.tobytes())
    enc.stdin.close(); enc.wait()
    return total


SR = 44100
def sound(total):
    a = np.zeros(int((total + 1) * SR)); r = np.random.default_rng(1); tt_all = np.arange(len(a)) / SR
    # drone
    a += (np.sin(2 * np.pi * 55 * tt_all) * 0.05 + np.sin(2 * np.pi * 82.4 * tt_all) * 0.03) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.11 * tt_all))
    def add(t, s):
        k = int(t * SR); a[k:k + len(s)] += s[: max(0, len(a) - k)]
    def whoosh(t):
        L = int(.22 * SR); s = np.convolve(r.standard_normal(L), np.ones(10) / 10, "same"); add(t, s * np.sin(np.linspace(0, np.pi, L)) ** 2 * .32)
    def rip(t):
        L = int(.16 * SR); s = r.standard_normal(L); s = s - np.convolve(s, np.ones(6) / 6, "same"); add(t, s * np.exp(-np.linspace(0, 6, L)) * .35)
    def clicks(t, n=5):
        for k in range(n):
            L = int(.02 * SR); tt = np.arange(L) / SR; add(t + k * 0.06 + r.uniform(0, .015), np.sin(2 * np.pi * 2400 * tt) * np.exp(-tt * 300) * .35 + r.standard_normal(L) * np.exp(-tt * 400) * .15)
    def thump(t, v=.8):
        L = int(.25 * SR); tt = np.arange(L) / SR; add(t, np.sin(2 * np.pi * 52 * tt) * np.exp(-tt * 14) * v)
    def pop_(t):
        L = int(.4 * SR); tt = np.arange(L) / SR; s = r.standard_normal(L) * np.exp(-tt * 25) * .5 + np.sin(2 * np.pi * 70 * tt) * np.exp(-tt * 10) * .6; add(t, s)
    pop_(0.02)
    for k in range(3): thump(k * 0.45 + 0.05, .5)
    for key in ["place", "intro", "b_p", "b_c", "d_p", "d_c", "r_p", "r_c", "trop", "board", "end"]:
        whoosh(T[key][0])
    for key in ["intro", "b_c", "d_c", "r_c", "trop"]: clicks(T[key][0] + 0.02)
    for tr in [f(5.28), f(9.28), f(12.16), f(16.72), f(20.40)]: rip(tr)
    t0 = CD_VO_END + 0.05
    for s in range(5):
        thump(t0 + s, .9); thump(t0 + s + 0.22, .55)
        L = int(.05 * SR); tt = np.arange(L) / SR; add(t0 + s + .5, np.sin(2 * np.pi * 1800 * tt) * np.exp(-tt * 90) * .3)
    L = int(.9 * SR); tt = np.arange(L) / SR; add(t0 + 5, (np.sin(2 * np.pi * 880 * tt) + .5 * np.sin(2 * np.pi * 1320 * tt)) * np.exp(-tt * 5) * .25)
    a = np.clip(a, -1, 1)
    with wave.open(f"{Z}/zag2_fx.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((a * 32767).astype(np.int16).tobytes())


def mix(total):
    pa = f"atrim=0.10:24.44,asetpts=PTS-STARTPTS,atempo={K},aformat=sample_rates=44100:channel_layouts=stereo,adelay={int((OFF+0.10/K)*1000)}|{int((OFF+0.10/K)*1000)}"
    pb_ms = int((T["end"][0] + 0.1) * 1000)
    pb = f"atrim=24.56:27.36,asetpts=PTS-STARTPTS,atempo={K},aformat=sample_rates=44100:channel_layouts=stereo,adelay={pb_ms}|{pb_ms}"
    fo = round(total - 1.2, 2)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{Z}/zag2_video.mp4", "-i", f"{Z}/vo.mp3", "-i", f"{Z}/vo.mp3",
        "-i", MUSIC, "-i", f"{Z}/zag2_fx.wav", "-filter_complex",
        f"[1:a]{pa}[va];[2:a]{pb}[vb];[va][vb]amix=inputs=2:normalize=0,"
        "highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-15:TP=-1.5:LRA=7,"
        f"aresample=44100,aformat=channel_layouts=stereo,apad=whole_dur={total},asplit=2[vo][key];"
        f"[3:a]afade=t=in:st=0:d=0.5,afade=t=out:st={fo}:d=1.2,volume=0.38,aformat=channel_layouts=stereo,apad=whole_dur={total},atrim=0:{total}[m0];"
        "[m0][key]sidechaincompress=threshold=0.03:ratio=7:attack=20:release=300[m];"
        f"[4:a]volume=0.7,aformat=channel_layouts=stereo,apad=whole_dur={total}[fx];"
        f"[vo][m][fx]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.95,atrim=0:{total}[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(total),
        "-movflags", "+faststart", f"{Z}/zagadka1_v2.mp4"], check=True)


if __name__ == "__main__":
    import sys
    total = T["end"][1]
    if "noaudio" not in sys.argv: pass
    total = render()
    sound(total); mix(total)
    print("seconds", round(total, 2), json.dumps({k: [round(v[0], 2), round(v[1], 2)] for k, v in T.items()}))
