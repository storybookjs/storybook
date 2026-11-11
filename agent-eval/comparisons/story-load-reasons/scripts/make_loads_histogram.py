"""SVG histogram: how many stories received how many loads. Same plain-SVG conventions as make_pies.py."""
import collections, json, os
from xml.sax.saxutils import escape

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INK, MUTED, GRID, BAR = '#1f1f1e', '#5c5b56', '#e4e3df', '#0072B2'
FONT = "Inter, 'Helvetica Neue', Arial, sans-serif"
W, H, LEFT, RIGHT, TOP, BASE = 880, 480, 70, 840, 138, 410

# purge-docgen prints every story in its docs output, so its loads are re-loads, not picks from a list.
EXCLUDED_CASES = ('purge-docgen',)
calls = [c for c in map(json.loads, open(os.path.join(OUT, 'story-loads.final.jsonl'))) if c['arm'] not in EXCLUDED_CASES]
found = [c for c in calls if c['story_found']]
per_story = collections.Counter(c['story_id'] for c in found)
label = {c['story_id']: c['story_name'] for c in found}
most = max(per_story.values())
BINS = [(1, 1), (2, 2), (3, 5), (6, 10), (11, 20), (21, 40), (41, most)]
counts = [sum(1 for n in per_story.values() if lo <= n <= hi) for lo, hi in BINS]
assert sum(counts) == len(per_story)
top = (max(counts) + 3) // 4 * 4
band = (RIGHT - LEFT) / len(BINS)
y = lambda v: BASE - (BASE - TOP) * v / top

title = 'How often each story was loaded'
subtitle = '%d distinct stories received %d loads in 550 runs across 11 cases. Five stories account for %d%% of them.' % (
    len(per_story), len(found), round(100 * sum(n for _, n in per_story.most_common(5)) / len(found)))
out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" font-family="%s" role="img">' % (W, H, W, H, FONT),
       '<title>%s</title>' % escape(title),
       '<desc>%s</desc>' % escape(subtitle + ' ' + '; '.join('%s loads: %d stories' % ('%d' % lo if lo == hi else '%d to %d' % (lo, hi), n) for (lo, hi), n in zip(BINS, counts))),
       '<rect id="background" width="%d" height="%d" fill="#ffffff"/>' % (W, H),
       '<text id="title" x="40" y="44" font-size="20" font-weight="600" fill="%s">%s</text>' % (INK, escape(title)),
       '<text id="y-title" x="%d" y="%d" font-size="12.5" fill="%s">Number of stories</text>' % (LEFT - 30, TOP - 32, MUTED),
       '<g id="grid" stroke="%s" stroke-width="1">' % GRID]
for v in range(4, top + 1, 4):
    out.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>' % (LEFT, y(v), RIGHT, y(v)))
out.append('</g>')
out.append('<g id="y-ticks" font-size="12.5" fill="%s" text-anchor="end">' % MUTED)
for v in range(0, top + 1, 4):
    out.append('<text x="%d" y="%.1f">%d</text>' % (LEFT - 10, y(v) + 4, v))
out.append('</g>')
out.append('<g id="bars" fill="%s">' % BAR)
bar_w = 58
for k, ((lo, hi), n) in enumerate(zip(BINS, counts)):
    cx = LEFT + band * (k + 0.5)
    x0, x1, yt = cx - bar_w / 2, cx + bar_w / 2, y(n)
    name = '%d' % lo if lo == hi else '%d to %d' % (lo, hi)
    out.append('<path id="bar-%s" d="M%.1f,%d L%.1f,%.1f Q%.1f,%.1f %.1f,%.1f L%.1f,%.1f Q%.1f,%.1f %.1f,%.1f L%.1f,%d Z"><title>%s loads: %d stories</title></path>' % (
        name.replace(' ', '-'), x0, BASE, x0, yt + 4, x0, yt, x0 + 4, yt, x1 - 4, yt, x1, yt, x1, yt + 4, x1, BASE, name, n))
out.append('</g>')
out.append('<line id="baseline" x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1"/>' % (LEFT, BASE, RIGHT, BASE, MUTED))
out.append('<g id="bar-values" font-size="14" font-weight="600" fill="%s" text-anchor="middle">' % INK)
for k, n in enumerate(counts):
    out.append('<text x="%.1f" y="%.1f">%d</text>' % (LEFT + band * (k + 0.5), y(n) - 8, n))
out.append('</g>')
out.append('<g id="x-labels" font-size="13" fill="%s" text-anchor="middle">' % INK)
for k, (lo, hi) in enumerate(BINS):
    out.append('<text x="%.1f" y="%d">%s</text>' % (LEFT + band * (k + 0.5), BASE + 22, '%d' % lo if lo == hi else '%d–%d' % (lo, hi)))
out.append('</g>')
out.append('<text id="x-title" x="%.1f" y="%d" font-size="12.5" fill="%s" text-anchor="middle">Loads received by one story (bins widen to the right)</text>' % ((LEFT + RIGHT) / 2, BASE + 48, MUTED))
out.append('<g id="most-loaded" text-anchor="end">')
out.append('<text x="%d" y="%d" font-size="12.5" font-weight="600" fill="%s">Most-loaded stories</text>' % (RIGHT, TOP + 22, INK))
for i, (sid, n) in enumerate(per_story.most_common(5)):
    out.append('<text x="%d" y="%d" font-size="12.5" fill="%s">%s · %d</text>' % (RIGHT, TOP + 42 + 18 * i, MUTED, escape(label[sid]), n))
out.append('</g>')
out.append('</svg>')
open(os.path.join(OUT, 'charts', 'loads-per-story.svg'), 'w').write('\n'.join(out) + '\n')
print(list(zip(BINS, counts)), 'y max', top)
