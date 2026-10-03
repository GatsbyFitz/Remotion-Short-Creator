#!/usr/bin/env python3
"""Composite rendered overlay stills onto a footage frame (or onto dark and light
fields when there is no footage) and lay them out as one review sheet, optionally
with the coordinate grid drawn over everything.

usage:
  composite.py OUT.png OVERLAY.png [OVERLAY.png ...]
               (--base FRAME.png | --fields) [--grid STEP] [--columns 2]
               [--tile-width 960] [--detail x0,y0,x1,y1 ...]

Render stills with `--scale=1` so they are in composition pixels. --detail appends
full-resolution crops of the LAST composite, for checking exactly how a graphic
meets what it's anchored to. --grid labels tiles and crops in composition pixels,
so a correction can be read straight off the sheet.
"""
import argparse
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from grid import BACKGROUNDS, gridded  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("out")
    parser.add_argument("overlays", nargs="+")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--base", help="footage frame, e.g. saved by grid.py --save-normalised")
    group.add_argument("--fields", action="store_true", help="composite over dark and light fields instead")
    parser.add_argument("--grid", type=int, default=0, help="grid step in composition pixels; 0 for none")
    parser.add_argument("--columns", type=int, default=2)
    parser.add_argument("--tile-width", type=int, default=960)
    parser.add_argument("--detail", action="append", default=[])
    args = parser.parse_args()

    composites = []
    for path in args.overlays:
        overlay = Image.open(path).convert("RGBA")
        if args.base:
            base = Image.open(args.base).convert("RGBA")
            backgrounds = [base.resize(overlay.size, Image.LANCZOS) if base.size != overlay.size else base]
        else:
            backgrounds = [Image.new("RGBA", overlay.size, BACKGROUNDS[k] + (255,)) for k in ("dark", "light")]
        for background in backgrounds:
            composite = background.copy()
            composite.alpha_composite(overlay)
            composites.append(composite.convert("RGB"))

    w, h = composites[0].size
    scale = args.tile_width / w
    tiles = [
        gridded(c, (0, 0, w, h), args.grid, scale) if args.grid else c.resize((args.tile_width, round(h * scale)), Image.LANCZOS)
        for c in composites
    ]
    details = []
    for spec in args.detail:
        box = tuple(int(v) for v in spec.split(","))
        details.append(gridded(composites[-1], box, max(25, args.grid // 2), 1) if args.grid else composites[-1].crop(box))

    tile_w, tile_h = tiles[0].size
    rows = -(-len(tiles) // args.columns)
    sheet = Image.new(
        "RGB",
        (max([args.columns * tile_w] + [d.width for d in details]), rows * tile_h + sum(d.height + 10 for d in details)),
        (0, 0, 0),
    )
    for i, tile in enumerate(tiles):
        sheet.paste(tile, ((i % args.columns) * tile_w, (i // args.columns) * tile_h))
    y = rows * tile_h
    for detail in details:
        sheet.paste(detail, (0, y + 10))
        y += detail.height + 10
    sheet.save(args.out)
    print(f"wrote {args.out}: {len(tiles)} composites, {len(details)} detail crops" + (f", grid every {args.grid}px" if args.grid else ""))


if __name__ == "__main__":
    main()
