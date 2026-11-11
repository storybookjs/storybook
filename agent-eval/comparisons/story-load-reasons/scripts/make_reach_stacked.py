"""SVG 100%-stacked bars: how an instance's stories reached the agent, grouped by instance size.

Reads story-reach-by-case.json. Cases with 404 to 406 stories are grouped as "400+". Each bar is the mean
of the per-case shares in its group, so every case weighs the same whatever its size.
"""
import collections, json, os
from xml.sax.saxutils import escape

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INK, MUTED, GRID = '#1f1f1e', '#5c5b56', '#e4e3df'
SERIES = [('individually', 'Loaded individually', '#0072B2'), ('first3_only', 'Inlined by the first-three rule only', '#E69F00'), ('never', 'Never loaded', '#b9b8b2')]
FONT = "Inter, 'Helvetica Neue', Arial, sans-serif"
W, X0, X1, TOP, ROW, BAR = 880, 210, 840, 126, 72, 28

# purge-docgen inlines every story of a fetched component, so the first-three rule does not apply to it.
EXCLUDED_CASES = ('purge-docgen',)
cases = [a for a in json.load(open(os.path.join(OUT, 'story-reach-by-case.json'))) if a['case'] not in EXCLUDED_CASES]
groups = collections.defaultdict(list)
for a in cases:
    groups['400+' if a['stories'] >= 400 else str(a['stories'])].append(a)
order = sorted(groups, key=lambda g: min(a['stories'] for a in groups[g]))
rows = []
for g in order:
    members = groups[g]
    share = {k: sum(100 * a[k] / a['stories'] for a in members) / len(members) for k, _, _ in SERIES}
    count = {k: sum(a[k] for a in members) / len(members) for k, _, _ in SERIES}
    rows.append((g, members, share, count))
H = TOP + ROW * (len(rows) - 1) + 20 + BAR + 8 + 40
num = lambda v: ('%d' % v) if abs(v - round(v)) < 0.05 else ('%.1f' % v)

title = 'How stories reached the agent, by size of the Storybook instance'
subtitle = 'Share of an instance\'s stories over 50 runs. 11 cases with the Storybook MCP, grouped by story count.'
out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" font-family="%s" role="img">' % (W, H, W, H, FONT),
       '<title>%s</title>' % escape(title),
       '<desc>%s</desc>' % escape(subtitle + ' ' + '; '.join('%s stories: %s' % (g, ', '.join('%s %.1f%%' % (lab, share[k]) for k, lab, _ in SERIES)) for g, _, share, _ in rows)),
       '<rect id="background" width="%d" height="%d" fill="#ffffff"/>' % (W, H),
       '<text id="title" x="40" y="44" font-size="20" font-weight="600" fill="%s">%s</text>' % (INK, escape(title)),
       '<g id="legend" font-size="13" fill="%s">' % INK]
lx = 40
for k, lab, color in SERIES:
    out.append('<rect x="%d" y="67" width="11" height="11" rx="2" fill="%s"/>' % (lx, color))
    out.append('<text x="%d" y="77">%s</text>' % (lx + 17, escape(lab)))
    lx += 17 + 7.2 * len(lab) + 26
out.append('</g>')
bottom = TOP + ROW * (len(rows) - 1) + 20 + BAR + 8
out.append('<g id="grid" stroke="%s" stroke-width="1">' % GRID)
for t in (0, 25, 50, 75, 100):
    x = X0 + (X1 - X0) * t / 100
    out.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>' % (x, TOP - 6, x, bottom))
out.append('</g>')
out.append('<g id="x-ticks" font-size="12.5" fill="%s" text-anchor="middle">' % MUTED)
for t in (0, 25, 50, 75, 100):
    out.append('<text x="%.1f" y="%d">%d%%</text>' % (X0 + (X1 - X0) * t / 100, bottom + 18, t))
out.append('</g>')
for i, (g, members, share, count) in enumerate(rows):
    y = TOP + ROW * i + 20
    out.append('<g id="row-%s">' % g.replace('+', 'plus'))
    out.append('<text x="40" y="%d" font-size="15" font-weight="600" fill="%s">%s stories</text>' % (y + 13, INK, g))
    out.append('<text x="40" y="%d" font-size="12.5" fill="%s">%d %s</text>' % (y + 30, MUTED, len(members), 'case' if len(members) == 1 else 'cases'))
    x = X0
    for k, lab, color in SERIES:
        w = (X1 - X0) * share[k] / 100
        out.append('<rect id="seg-%s-%s" x="%.1f" y="%d" width="%.1f" height="%d" fill="%s" stroke="#ffffff" stroke-width="2"><title>%s stories, %s: %.1f%% (%s stories per case)</title></rect>' % (
            g.replace('+', 'plus'), k, x, y, w, BAR, color, g, lab.lower(), share[k], num(count[k])))
        text = '%.1f%% · %s %s' % (share[k], num(count[k]), 'story' if num(count[k]) == '1' else 'stories')
        if k == 'individually':
            out.append('<text x="%.1f" y="%d" font-size="12.5" fill="%s">%s</text>' % (X0, y - 7, INK, text))
        else:
            inner = text if w >= 125 else text.rsplit(' ', 1)[0]   # a narrow segment has no room for the unit
            out.append('<text x="%.1f" y="%d" font-size="12.5" fill="%s" text-anchor="middle">%s</text>' % (x + w / 2, y + BAR / 2 + 4.5, INK, inner))
        x += w
    out.append('</g>')
out.append('</svg>')
open(os.path.join(OUT, 'charts', 'story-reach-by-size.svg'), 'w').write('\n'.join(out) + '\n')
for g, members, share, count in rows:
    print('%-5s %d cases  %s' % (g, len(members), '  '.join('%s %.1f%% (%s)' % (k, share[k], num(count[k])) for k, _, _ in SERIES)))
