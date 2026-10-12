"""Portraits ronds de la radio : un carré autour du visage de chaque personnage (assets/persos)."""
from PIL import Image
# nom : (centre x, centre y, demi-côté) en fraction de la largeur de l'image
FACES = {
    'lucas': (0.37, 0.24, 0.31), 'gazou': (0.42, 0.38, 0.40), 'hanpopo': (0.47, 0.22, 0.25),
    'pqr': (0.46, 0.18, 0.30), 'r2wc': (0.47, 0.30, 0.42), 'roteur': (0.57, 0.28, 0.22),
    'soldat': (0.58, 0.20, 0.24),
}
for n, (cx, cy, r) in FACES.items():
    im = Image.open(f'assets/persos/{n}.webp').convert('RGBA')
    w = im.width; x, y, h = cx * w, cy * im.height, r * w
    out = Image.new('RGBA', (int(2 * h), int(2 * h)), (0, 0, 0, 0))
    out.alpha_composite(im.crop((int(x - h), int(y - h), int(x + h), int(y + h))))
    out = out.resize((160, 160), Image.LANCZOS)
    out.save(f'assets/portraits/{n}.webp', quality=92)
