"""SVG line chart of exact counts: for each number of loads, how many stories received exactly that many.

Dots are the exact values. The curve joining them is a monotone cubic through every dot, so it rounds
the corners without moving any value or overshooting between points. The x-axis is logarithmic because
the counts run from 1 to 55 and most stories sit at the low end.
"""
import collections, json, math, os
from xml.sax.saxutils import escape

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INK, MUTED, GRID, LINE = '#1f1f1e', '#5c5b56', '#e4e3df', '#0072B2'
FONT = "Inter, 'Helvetica Neue', Arial, sans-serif"
W, H, LEFT, RIGHT, TOP, BASE = 880, 540, 70, 840, 138, 410

# purge-docgen prints every story in its docs output, so its loads are re-loads, not picks from a list.
EXCLUDED_ARMS = ('purge-docgen',)
calls = [c for c in map(json.loads, open(os.path.join(OUT, 'story-loads.final.jsonl'))) if c['arm'] not in EXCLUDED_ARMS]
found = [c for c in calls if c['story_found']]
per_story = collections.Counter(c['story_id'] for c in found)
label = {c['story_id']: c['story_name'] for c in found}
points = sorted(collections.Counter(per_story.values()).items())      # (loads, number of stories)
X_MIN, X_MAX, Y_MAX = 0.88, 64, 12
px = lambda loads: LEFT + (RIGHT - LEFT) * (math.log10(loads) - math.log10(X_MIN)) / (math.log10(X_MAX) - math.log10(X_MIN))
py = lambda n: BASE - (BASE - TOP) * n / Y_MAX

def monotone_path(pts):
    """Fritsch-Carlson monotone cubic through pts, as an SVG path of cubic Beziers."""
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    d = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(len(pts) - 1)]
    m = [d[0]] + [0 if d[i - 1] * d[i] <= 0 else (d[i - 1] + d[i]) / 2 for i in range(1, len(d))] + [d[-1]]
    for i, slope in enumerate(d):
        if slope == 0:
            m[i] = m[i + 1] = 0
            continue
        a, b = m[i] / slope, m[i + 1] / slope
        if a * a + b * b > 9:
            t = 3 / math.sqrt(a * a + b * b)
            m[i], m[i + 1] = t * a * slope, t * b * slope
    path = 'M%.1f,%.1f' % pts[0]
    for i in range(len(d)):
        h = xs[i + 1] - xs[i]
        path += ' C%.1f,%.1f %.1f,%.1f %.1f,%.1f' % (xs[i] + h / 3, ys[i] + m[i] * h / 3, xs[i + 1] - h / 3, ys[i + 1] - m[i + 1] * h / 3, xs[i + 1], ys[i + 1])
    return path

pix = [(px(loads), py(n)) for loads, n in points]
top_five = {n for _, n in per_story.most_common(5)}
title = 'How many stories received exactly this many loads'
subtitle = '%d distinct stories, %d loads, 550 runs across 11 arms. Each dot is an exact count.' % (len(per_story), len(found))
out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" font-family="%s" role="img">' % (W, H, W, H, FONT),
       '<title>%s</title>' % escape(title),
       '<desc>%s</desc>' % escape('; '.join('%d loads: %d stories' % p for p in points)),
       '<rect id="background" width="%d" height="%d" fill="#ffffff"/>' % (W, H),
       '<text id="title" x="40" y="44" font-size="20" font-weight="600" fill="%s">%s</text>' % (INK, escape(title)),
       '<text id="subtitle" x="40" y="68" font-size="13.5" fill="%s">%s</text>' % (MUTED, escape(subtitle)),
       '<text id="y-title" x="%d" y="%d" font-size="12.5" fill="%s">Number of stories</text>' % (LEFT - 30, TOP - 32, MUTED),
       '<g id="grid" stroke="%s" stroke-width="1">' % GRID]
for v in (4, 8, 12):
    out.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>' % (LEFT, py(v), RIGHT, py(v)))
out.append('</g>')
out.append('<g id="y-ticks" font-size="12.5" fill="%s" text-anchor="end">' % MUTED)
for v in (0, 4, 8, 12):
    out.append('<text x="%d" y="%.1f">%d</text>' % (LEFT - 10, py(v) + 4, v))
out.append('</g>')
out.append('<line id="baseline" x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1"/>' % (LEFT, BASE, RIGHT, BASE, MUTED))
out.append('<g id="x-ticks" font-size="13" fill="%s" text-anchor="middle" stroke="none">' % INK)
for v in (1, 2, 5, 10, 20, 50):
    out.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="%s" stroke-width="1"/>' % (px(v), BASE, px(v), BASE + 5, MUTED))
    out.append('<text x="%.1f" y="%d">%d</text>' % (px(v), BASE + 22, v))
out.append('</g>')
out.append('<text id="x-title" x="%.1f" y="%d" font-size="12.5" fill="%s" text-anchor="middle">Loads received by one story (logarithmic scale)</text>' % ((LEFT + RIGHT) / 2, BASE + 48, MUTED))
out.append('<path id="curve" d="%s" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' % (monotone_path(pix), LINE))
out.append('<g id="dots" fill="%s" stroke="#ffffff" stroke-width="2">' % LINE)
for (loads, n), (x, y) in zip(points, pix):
    out.append('<circle id="dot-%d" cx="%.1f" cy="%.1f" r="5"><title>%d %s received exactly %d %s</title></circle>' % (
        loads, x, y, n, 'story' if n == 1 else 'stories', loads, 'load' if loads == 1 else 'loads'))
out.append('</g>')
out.append('<g id="point-labels" font-size="12.5" fill="%s">' % INK)
out.append('<text x="%.1f" y="%.1f" font-weight="600">%d stories were loaded once</text>' % (pix[0][0] + 12, pix[0][1] + 4, points[0][1]))
out.append('<text x="%.1f" y="%.1f" font-weight="600">%d were loaded twice</text>' % (pix[1][0] + 12, pix[1][1] + 4, points[1][1]))
previous_x, raised = None, False
for (loads, n), (x, y) in zip(points, pix):
    if loads in top_five:
        # Neighbouring counts sit close together on a log axis; lift every other label so they do not collide.
        raised = previous_x is not None and x - previous_x < 24 and not raised
        out.append('<text x="%.1f" y="%.1f" text-anchor="middle" fill="%s">%d</text>' % (x, y - (27 if raised else 12), MUTED, loads))
        previous_x = x
out.append('</g>')
out.append('<g id="most-loaded" text-anchor="end">')
out.append('<text x="%d" y="%d" font-size="12.5" font-weight="600" fill="%s">The five dots on the right, one story each</text>' % (RIGHT, TOP + 22, INK))
for i, (sid, n) in enumerate(per_story.most_common(5)):
    out.append('<text x="%d" y="%d" font-size="12.5" fill="%s">%s · %d loads</text>' % (RIGHT, TOP + 42 + 18 * i, MUTED, escape(label[sid]), n))
out.append('</g>')
missing = [v for v in range(1, 12) if v not in dict(points)]
next_seen = min(v for v, _ in points if v > 11)
out.append('<g id="note" font-size="12.5" fill="%s">' % MUTED)
out.append('<text x="40" y="%d">The line joins observed values only: no story received %s, or 12 to %d, loads.</text>' % (H - 40, ' or '.join(str(v) for v in missing), next_seen - 1))
out.append('<text x="40" y="%d">The curve passes through every dot; smoothing rounds the corners and changes no value.</text>' % (H - 22))
out.append('</g>')
out.append('</svg>')
open(os.path.join(OUT, 'charts', 'loads-per-story-line.svg'), 'w').write('\n'.join(out) + '\n')
print(points)
