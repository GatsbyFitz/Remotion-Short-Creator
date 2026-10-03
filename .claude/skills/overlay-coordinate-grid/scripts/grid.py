#!/usr/bin/env python3
"""Draw a labelled coordinate grid over an image so positions can be read off it
exactly rather than estimated.

Works on a footage frame (a screenshot, or a frame pulled from a clip) or on a
render of the overlay itself. The image is normalised to the composition size
first, so every label is in composition pixels and a number read off the sheet
goes straight into code.

usage:
  grid.py IMAGE OUT.png [--size 1920x1080] [--step 100] [--background dark]
          [--region NAME=x0,y0,x1,y1[,step[,zoom]] ...] [--save-normalised PATH]

With no --region, the whole image is gridded at --step. Each --region adds a
zoomed, finer-gridded crop instead; crops are stacked into OUT.png. Transparent
renders are flattened onto --background (dark, light, or #rrggbb) so both light
and dark elements stay visible.
"""
import argparse
from PIL import Image, ImageDraw, ImageFont

BACKGROUNDS = {"dark": (24, 26, 30), "light": (208, 210, 214)}


def label_font(size):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        try:
            return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", size)
        except OSError:
            return ImageFont.load_default()


def gridded(image, box, step, scale, name="", font_size=16):
    """Crop `box` from `image`, scale it, and grid it with labels in the image's own
    (unscaled) coordinates."""
    x0, y0, x1, y1 = box
    crop = image.crop(box).resize((round((x1 - x0) * scale), round((y1 - y0) * scale)), Image.LANCZOS)
    draw = ImageDraw.Draw(crop)
    font = label_font(font_size)

    def label(xy, text, colour):
        left, top, right, bottom = draw.textbbox(xy, text, font=font)
        draw.rectangle((left - 2, top - 1, right + 2, bottom + 1), fill=(0, 0, 0))
        draw.text(xy, text, fill=colour, font=font)

    for x in range(-(-x0 // step) * step, x1 + 1, step):
        px = (x - x0) * scale
        draw.line([(px, 0), (px, crop.height)], fill=(0, 255, 255), width=1)
        label((px + 3, 3), str(x), (0, 255, 255))
    for y in range(-(-y0 // step) * step, y1 + 1, step):
        py = (y - y0) * scale
        draw.line([(0, py), (crop.width, py)], fill=(255, 0, 255), width=1)
        label((3, py + 3), str(y), (255, 0, 255))
    if name:
        label((6, crop.height - font_size - 6), name, (255, 255, 0))
    return crop


def parse_region(text):
    name, _, spec = text.partition("=")
    parts = [int(v) for v in spec.split(",")]
    if len(parts) < 4:
        raise SystemExit(f"region {text!r}: need NAME=x0,y0,x1,y1[,step[,zoom]]")
    return name, tuple(parts[:4]), (parts[4] if len(parts) > 4 else 50), (parts[5] if len(parts) > 5 else 1)


def parse_background(value):
    if value in BACKGROUNDS:
        return BACKGROUNDS[value]
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("image")
    parser.add_argument("out")
    parser.add_argument("--size", default="1920x1080")
    parser.add_argument("--step", type=int, default=100)
    parser.add_argument("--background", default="dark")
    parser.add_argument("--region", action="append", default=[], type=parse_region)
    parser.add_argument("--save-normalised", help="also save the resized image, alpha intact, e.g. to composite onto later")
    args = parser.parse_args()

    width, height = (int(v) for v in args.size.split("x"))
    source = Image.open(args.image)
    source_aspect, target_aspect = source.width / source.height, width / height
    drift = abs(source_aspect - target_aspect) / target_aspect
    print(f"source {source.width}x{source.height} (aspect {source_aspect:.4f}), target {width}x{height} (aspect {target_aspect:.4f})")
    if drift > 0.01:
        print(f"WARNING: aspect differs by {drift:.1%} — likely player chrome or letterboxing in a screenshot. "
              "Crop to the video area first or every coordinate will be skewed.")

    normalised = source.convert("RGBA")
    if normalised.size != (width, height):
        normalised = normalised.resize((width, height), Image.LANCZOS)
    if args.save_normalised:
        normalised.save(args.save_normalised)

    flat = Image.new("RGBA", (width, height), parse_background(args.background) + (255,))
    flat.alpha_composite(normalised)
    flat = flat.convert("RGB")

    if args.region:
        crops = [gridded(flat, box, step, zoom, name) for name, box, step, zoom in args.region]
    else:
        crops = [gridded(flat, (0, 0, width, height), args.step, 1)]

    sheet = Image.new("RGB", (max(c.width for c in crops), sum(c.height for c in crops) + 10 * (len(crops) - 1)))
    y = 0
    for crop in crops:
        sheet.paste(crop, (0, y))
        y += crop.height + 10
    sheet.save(args.out)
    print(f"wrote {args.out}" + (f" and {args.save_normalised}" if args.save_normalised else ""))


if __name__ == "__main__":
    main()
