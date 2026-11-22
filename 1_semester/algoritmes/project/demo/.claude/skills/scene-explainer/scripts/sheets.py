#!/usr/bin/env python3
"""Tile screenshots into contact sheets so a few images cover every step.
Usage: python3 sheets.py <dir> <prefix> [per_sheet=4] [cols=2] [tile_width=720]"""
import glob, os, re, sys
from PIL import Image

d, prefix = sys.argv[1], sys.argv[2]
per, cols, w = (int(sys.argv[i]) if len(sys.argv) > i else v for i, v in ((3, 4), (4, 2), (5, 720)))
files = sorted(glob.glob(os.path.join(d, prefix + '*.png')), key=lambda p: int(re.findall(r'(\d+)\.png$', p)[0]))
for k in range(0, len(files), per):
    ims = [Image.open(f).convert('RGB') for f in files[k:k + per]]
    hs = [int(im.height * w / im.width) for im in ims]; h = min(max(hs), 1600)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * w + (cols - 1) * 8, rows * h + (rows - 1) * 8), (255, 0, 255))
    for j, im in enumerate(ims):
        t = im.resize((w, hs[j])).crop((0, 0, w, min(hs[j], h)))
        sheet.paste(t, ((j % cols) * (w + 8), (j // cols) * (h + 8)))
    out = os.path.join(d, f'sheet_{prefix}{k // per + 1}.png'); sheet.save(out)
    print(out, [os.path.basename(f) for f in files[k:k + per]])
