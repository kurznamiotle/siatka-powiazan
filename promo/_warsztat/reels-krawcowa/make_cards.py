import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
BG = (26, 23, 20, 255)
CREAM = (239, 230, 210, 255)
MUTED = (181, 168, 143, 255)
RED = (179, 32, 30, 255)
F = sys.argv[1]


def font(name, size, bold=False):
    f = ImageFont.truetype(f"{F}/{name}", size)
    if bold:
        try:
            f.set_variation_by_name("Bold")
        except Exception:
            pass
    return f


def centered(d, y, text, f, fill):
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, y), text, font=f, fill=fill)


def caption(path, big, small):
    """Top band caption: transparent frame, text inside the dark band above the video."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    centered(d, 215, big, font("PixelifySans.ttf", 76, True), CREAM)
    if small:
        centered(d, 315, small, font("SpecialElite.ttf", 40), MUTED)
    im.save(path)


caption("cap_a.png", "Kto zabił krawcową?", "Nikiszowiec, październik 1992")
caption("cap_b.png", "Czytam akta, łączę fakty", "przewijam ×8")
caption("cap_d.png", "Akt oskarżenia", "trzy próby, jedna odpowiedź")
caption("cap_e.png", "Sprawa zamknięta", "A Ty ile byś potrzebował?")

# End card
im = Image.new("RGBA", (W, H), BG)
d = ImageDraw.Draw(im)
# pins and string
pts = [(260, 520), (820, 470), (540, 700)]
for a, b in [(0, 1), (1, 2), (2, 0)]:
    d.line([pts[a], pts[b]], fill=RED, width=8)
for x, y in pts:
    d.ellipse([x - 26, y - 26, x + 26, y + 26], fill=RED)
    d.ellipse([x - 16, y - 16, x - 4, y - 4], fill=(242, 160, 144, 255))
centered(d, 860, "Siatka Powiązań", font("PixelifySans.ttf", 104, True), CREAM)
centered(d, 1010, "Codziennie nowa sprawa.", font("SpecialElite.ttf", 48), CREAM)
centered(d, 1075, "Polska, lata 90. Za darmo, bez reklam.", font("SpecialElite.ttf", 40), MUTED)
fl = font("CourierPrime-Bold.ttf", 64)
t = "siatkapowiazan.pl"
tw = d.textlength(t, font=fl)
x0 = (W - tw) / 2 - 34
d.rectangle([x0, 1210, x0 + tw + 68, 1320], fill=RED)
d.text((x0 + 34, 1228), t, font=fl, fill=(255, 255, 255, 255))
centered(d, 1370, "link w bio", font("SpecialElite.ttf", 44), MUTED)
im.convert("RGB").save("endcard.png")
