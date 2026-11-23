"""Encode a recording's frames to animated WebP with regular keyframes.

ffmpeg's libwebp_anim can't set keyframe intervals, and its lossy sub-frame
diffing leaves faint ghosts of closed dialogs that persist to the end. This
re-encodes with Pillow (libwebp's WebPAnimEncoder) using kmin/kmax, so a full
keyframe lands about once per second at 15 fps and clears any ghosting.

    python encode_webp.py <frames.apng> <out.webp> [quality] [kmin] [kmax]

Frames are read one at a time from the (lossless) APNG, so memory stays flat.
"""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
quality = float(sys.argv[3]) if len(sys.argv) > 3 else 75
kmin = int(sys.argv[4]) if len(sys.argv) > 4 else 9
kmax = int(sys.argv[5]) if len(sys.argv) > 5 else 15

im = Image.open(src)
im.save(dst, format='WEBP', save_all=True, loop=0, duration=round(1000 / 15),
        quality=quality, method=4, kmin=kmin, kmax=kmax, minimize_size=False,
        allow_mixed=False, lossless=False)
print(f'{dst}: {im.n_frames} frames')
