"""Icône de l'appli et écran de démarrage, faits à partir des dessins de la planche 1.
python tools/make_icons.py  (remplace les images par défaut de Capacitor dans android/)"""
import glob
from PIL import Image, ImageDraw, ImageFilter

BG = (42, 24, 56)
lucas = Image.open('assets/persos/lucas_rire.webp').convert('RGBA')
roteur = Image.open('assets/persos/roteur.webp').convert('RGBA')

def head(size):
    """Le visage de Lucas qui rit, en carré."""
    w = lucas.width
    cx, cy, r = 0.40 * w, 0.27 * lucas.height, 0.36 * w
    im = Image.new('RGBA', (int(2 * r), int(2 * r)), (0, 0, 0, 0))
    im.alpha_composite(lucas.crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r))))
    return im.resize((size, size), Image.LANCZOS)

def glow_bg(size, round_=False):
    im = Image.new('RGBA', (size, size), BG + (255,))
    g = Image.new('L', (size, size), 0)
    ImageDraw.Draw(g).ellipse((size * .12, size * .12, size * .88, size * .88), fill=200)
    g = g.filter(ImageFilter.GaussianBlur(size * .12))
    im.paste(Image.new('RGBA', (size, size), (110, 230, 70, 255)), (0, 0), g)
    if round_:
        m = Image.new('L', (size, size), 0)
        ImageDraw.Draw(m).ellipse((0, 0, size - 1, size - 1), fill=255)
        im.putalpha(m)
    return im

def icon(size, round_=False):
    im = glow_bg(size, round_)
    h = head(int(size * .92))
    im.alpha_composite(h, ((size - h.width) // 2, int(size * .06)))
    if round_:
        m = Image.new('L', (size, size), 0); ImageDraw.Draw(m).ellipse((0, 0, size - 1, size - 1), fill=255)
        im.putalpha(Image.composite(im.getchannel('A'), Image.new('L', (size, size), 0), m))
    return im

for p in glob.glob('android/app/src/main/res/mipmap-*/ic_launcher*.png'):
    size = Image.open(p).size[0]
    if p.endswith('foreground.png'):
        im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        h = head(int(size * .62))
        im.alpha_composite(h, ((size - h.width) // 2, (size - h.height) // 2))
    else:
        im = icon(size, p.endswith('round.png'))
    im.save(p)

for p in glob.glob('android/app/src/main/res/drawable*/splash.png'):
    w, h = Image.open(p).size
    im = glow_bg(max(w, h)).resize((max(w, h), max(w, h))).crop((0, 0, w, h)).convert('RGBA')
    im.paste(Image.new('RGBA', (w, h), BG + (255,)), (0, 0))
    g = Image.new('L', (w, h), 0)
    ImageDraw.Draw(g).ellipse((w * .1, h * .25, w * .9, h * .85), fill=150)
    g = g.filter(ImageFilter.GaussianBlur(min(w, h) * .12))
    im.paste(Image.new('RGBA', (w, h), (90, 200, 60, 255)), (0, 0), g)
    fh = int(min(h * .5, w * .55))
    for src, x in ((lucas, .3), (roteur, .67)):
        f = src.resize((int(fh * src.width / src.height), fh), Image.LANCZOS)
        im.alpha_composite(f, (int(w * x - f.width / 2), int(h * .6 - fh / 2)))
    im.convert('RGB').save(p)

# pour la page GitHub
icon(512).save('publication/icone-512.png')
print('icônes et écrans de démarrage faits')
