import sys, random
from PIL import Image, ImageDraw, ImageFont

F = sys.argv[1]
W, H = 1080, 1920
CORK = (180, 130, 79)
CREAM = (239, 230, 210)
PAPER = (244, 239, 228)
INK = (30, 27, 23)
MUTED = (107, 95, 78)
RED = (179, 32, 30)


def font(name, size, bold=False):
    f = ImageFont.truetype(f"{F}/{name}", size)
    if bold:
        try:
            f.set_variation_by_name("Bold")
        except Exception:
            pass
    return f


rnd = random.Random(3)
im = Image.new("RGB", (W, H), CORK)
d = ImageDraw.Draw(im)
for _ in range(26000):
    x, y = rnd.randrange(W), rnd.randrange(H)
    c = rnd.choice([(150, 104, 58), (200, 156, 104), (165, 117, 68)])
    d.point((x, y), fill=c)
    if rnd.random() < 0.3:
        d.point((x + 1, y), fill=c)


def rotated_paste(base, layer, angle, center):
    r = layer.rotate(angle, resample=Image.BICUBIC, expand=True)
    base.paste(r, (int(center[0] - r.width / 2), int(center[1] - r.height / 2)), r)


def polaroid(caption):
    p = Image.new("RGBA", (300, 360), (0, 0, 0, 0))
    q = ImageDraw.Draw(p)
    q.rectangle([10, 14, 299, 359], fill=(40, 20, 5, 90))
    q.rectangle([0, 0, 288, 346], fill=PAPER + (255,))
    q.rectangle([18, 18, 270, 270], fill=(35, 32, 28, 255))
    q.ellipse([104, 70, 184, 150], fill=(74, 67, 59, 255))
    q.pieslice([60, 160, 228, 360], 180, 360, fill=(74, 67, 59, 255))
    q.rectangle([18, 262, 270, 270], fill=(35, 32, 28, 255))
    f = font("SpecialElite.ttf", 34)
    w = q.textlength(caption, font=f)
    q.text(((288 - w) / 2, 290), caption, font=f, fill=INK)
    return p


pol_a, pol_b = (250, 520), (830, 540)
rotated_paste(im, polaroid("sąsiad?"), 7, pol_a)
rotated_paste(im, polaroid("świadek?"), -6, pol_b)

# Case card
card = Image.new("RGBA", (920, 640), (0, 0, 0, 0))
c = ImageDraw.Draw(card)
c.rectangle([16, 20, 919, 639], fill=(40, 20, 5, 110))
c.rectangle([0, 0, 900, 620], fill=CREAM + (255,))
c.text((50, 46), "AKTA · NIKISZOWIEC, X 1992", font=font("SpecialElite.ttf", 34), fill=MUTED)
ft = font("PixelifySans.ttf", 112, True)
c.text((46, 110), "Kto zabił", font=ft, fill=INK)
c.text((46, 235), "krawcową?", font=ft, fill=INK)
c.text((50, 400), "Rozwiąż razem ze mną.", font=font("SpecialElite.ttf", 54), fill=INK)
c.text((50, 475), "Polska, lata 90.", font=font("SpecialElite.ttf", 44), fill=MUTED)
rotated_paste(im, card, -2, (W / 2, 1080))

# stamp
st = Image.new("RGBA", (520, 100), (0, 0, 0, 0))
s = ImageDraw.Draw(st)
s.rectangle([0, 0, 519, 99], fill=(239, 230, 210, 235), outline=RED, width=7)
fs = font("SpecialElite.ttf", 40)
tw = s.textlength("SPRAWA ZAMKNIĘTA?", font=fs)
s.text(((520 - tw) / 2, 28), "SPRAWA ZAMKNIĘTA?", font=fs, fill=RED)
rotated_paste(im, st, -8, (745, 1390))

# strings + pins
pins = [(250, 360), (830, 380), (112, 764)]
for a, b in [(0, 1), (0, 2), (1, 2)]:
    d.line([(pins[a][0] + 4, pins[a][1] + 6), (pins[b][0] + 4, pins[b][1] + 6)], fill=(60, 30, 10), width=7)
    d.line([pins[a], pins[b]], fill=RED, width=7)
for x, y in pins:
    d.ellipse([x - 22, y - 18, x + 26, y + 30], fill=(60, 30, 10))
    d.ellipse([x - 24, y - 24, x + 24, y + 24], fill=RED)
    d.ellipse([x - 14, y - 15, x - 3, y - 4], fill=(242, 160, 144))

# link strip
fl = font("CourierPrime-Bold.ttf", 54)
t = "siatkapowiazan.pl"
tw = d.textlength(t, font=fl)
x0 = (W - tw) / 2 - 30
d.rectangle([x0, 1460, x0 + tw + 60, 1550], fill=RED)
d.text((x0 + 30, 1474), t, font=fl, fill=(255, 255, 255))

im.save("cover.jpg", quality=92)
