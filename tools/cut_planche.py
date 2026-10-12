"""Découpe une planche Gemini (fond blanc) en dessins PNG/WebP transparents, à la résolution
d'origine (réduits seulement si plus grands que --max).

  python tools/cut_planche.py PLANCHE DOSSIER nom=x0,y0,x1,y1 [nom=...] [--glow nom ...] [--max 512]

- Le fond blanc est retiré en partant des bords de chaque zone : il s'arrête aux contours,
  donc un dessin blanc (le WC) garde son blanc.
- Le bord du dessin est adouci (pas de liseré blanc).
- --glow : pour les tirs lumineux, le blanc devient transparent partout (la lueur reste douce).
"""
import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def flood_bg(rgb):
    light = rgb.mean(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    white = (light > 228) & (spread < 28)
    h, w = white.shape
    seen = np.zeros_like(white)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if white[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if white[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    return seen


def biggest_pieces(fg, keep_ratio=0.002):
    """Retire les miettes (petits bouts isolés)."""
    from scipy import ndimage  # noqa
    lab, n = ndimage.label(fg)
    if n == 0:
        return fg
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * keep_ratio])
    return keep


def white_to_alpha(rgb):
    """Couleur → transparence : le blanc pur devient transparent, la couleur est récupérée."""
    c = rgb.astype(np.float32) / 255
    a = np.clip((1 - c).max(axis=2) * 1.15, 0, 1)
    safe = np.maximum(a, 1e-4)[..., None]
    col = np.clip((c - (1 - a[..., None])) / safe, 0, 1)
    return col, a


def cut(img, box, glow):
    zone = np.asarray(img.crop(box).convert('RGB'))
    if glow:
        col, a = white_to_alpha(zone)
    else:
        bg = flood_bg(zone)
        try:
            fg = biggest_pieces(~bg)
        except ImportError:
            fg = ~bg
        # bord adouci : près du fond, la transparence vient de la blancheur du pixel
        near = np.asarray(Image.fromarray((~fg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
        col_e, a_e = white_to_alpha(zone)
        a = np.where(fg, 1.0, 0.0)
        edge = fg & near
        a[edge] = np.minimum(1.0, a_e[edge] * 1.3)
        col = zone.astype(np.float32) / 255
        col[edge] = col_e[edge]
    out = np.dstack([col, a]) * 255
    im = Image.fromarray(out.astype(np.uint8), 'RGBA')
    bbox = im.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
    return im.crop(bbox) if bbox else im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet'); ap.add_argument('out'); ap.add_argument('zones', nargs='+')
    ap.add_argument('--glow', nargs='*', default=[])
    ap.add_argument('--max', type=int, default=512)
    a = ap.parse_args()
    img = Image.open(a.sheet)
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    for z in a.zones:
        name, coords = z.split('=')
        box = tuple(int(v) for v in coords.split(','))
        im = cut(img, box, name in a.glow)
        if max(im.size) > a.max:
            im.thumbnail((a.max, a.max), Image.LANCZOS)
        im.save(out / f'{name}.webp', quality=92, method=6)
        print(f'{name}: {im.size[0]}x{im.size[1]}')


if __name__ == '__main__':
    main()
