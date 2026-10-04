# Draws the home-screen icons (icons/*.png): a white fuel pump on the site's
# blue, kept inside the central ~60% so it survives circular/rounded masks.
# One-off tool:  pip install pillow && python icons/build-icons.py
import math, os
from PIL import Image, ImageDraw
OUT = os.path.dirname(os.path.abspath(__file__))
BLUE, WHITE = (31, 111, 235), (255, 255, 255)
S = 2048  # draw big, scale down
def icon():
    im = Image.new('RGB', (S, S), BLUE)   # full bleed: platforms apply their own mask
    d = ImageDraw.Draw(im)
    u = S / 100  # design on a 100-unit grid; content inside the central ~60%
    # pump body
    d.rounded_rectangle([30*u, 24*u, 60*u, 78*u], radius=5*u, fill=WHITE)
    # display window
    d.rounded_rectangle([35*u, 30*u, 55*u, 44*u], radius=2.5*u, fill=BLUE)
    # base
    d.rounded_rectangle([26*u, 74*u, 64*u, 80*u], radius=2*u, fill=WHITE)
    # hose: out from the body, down and up into the nozzle holder
    w = int(4.5*u)
    x0, x1, top, bot = 65*u, 75*u, 50*u, 60*u   # out, down, a U-bend, up to the nozzle
    r = (x1 - x0) / 2
    pts = [(60*u, top), (x0, top), (x0, bot)]
    pts += [(x0 + r - r*math.cos(math.pi*k/24), bot + r*math.sin(math.pi*k/24)) for k in range(25)]
    pts += [(x1, 36*u)]
    d.line(pts, fill=WHITE, width=w, joint='curve')
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - w/2, y - w/2, x + w/2, y + w/2], fill=WHITE)
    # nozzle
    d.rounded_rectangle([71*u, 26*u, 79*u, 38*u], radius=2*u, fill=WHITE)
    return im
for name, size in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)]:
    icon().resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)
print('ok')
