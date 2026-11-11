"""Standalone SVG pie charts for the story-load analysis.

Plain SVG, no CSS or scripts: every slice is a <path id="slice-..."> and every label is live <text>,
so the files open cleanly in Figma, Illustrator or Inkscape. Colours are the Okabe-Ito set without
yellow, ordered so the two weakest pairs never sit next to each other; validated for all pairs under
protan, deutan and tritan vision (worst pair dE 7.6, which is why every slice also has a direct label).
"""
import collections, glob, json, math, os, re
from xml.sax.saxutils import escape

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PALETTE = ['#0072B2', '#E69F00', '#009E73', '#56B4E9', '#CC79A7', '#D55E00']
INK, MUTED, FONT = '#1f1f1e', '#5c5b56', "Inter, 'Helvetica Neue', Arial, sans-serif"
W, CX, CY, R = 880, 440, 280, 140
TOP, BOTTOM, GAP = 118, 455, 46

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def pie(filename, title, subtitle, slices, caption=()):
    """slices: [(label, count)] in drawing order, clockwise from 12 o'clock."""
    total = sum(n for _, n in slices)
    height = 500 + (26 + 19 * len(caption) if caption else 0)
    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" font-family="%s" role="img">' % (W, height, W, height, FONT),
           '<title>%s</title>' % escape(title),
           '<desc>%s</desc>' % escape('; '.join('%s %d (%d%%)' % (l, n, round(100 * n / total)) for l, n in slices)),
           '<rect id="background" width="%d" height="%d" fill="#ffffff"/>' % (W, height),
           '<text id="title" x="40" y="44" font-size="20" font-weight="600" fill="%s">%s</text>' % (INK, escape(title)),
           '<text id="subtitle" x="40" y="68" font-size="13.5" fill="%s">%s</text>' % (MUTED, escape(subtitle)),
           '<g id="slices" stroke="#ffffff" stroke-width="2" stroke-linejoin="round">']
    angle, labels = -math.pi / 2, []
    for k, (label, n) in enumerate(slices):
        sweep = 2 * math.pi * n / total
        a0, a1 = angle, angle + sweep
        x0, y0, x1, y1 = CX + R * math.cos(a0), CY + R * math.sin(a0), CX + R * math.cos(a1), CY + R * math.sin(a1)
        d = 'M%.1f,%.1f L%.2f,%.2f A%d,%d 0 %d 1 %.2f,%.2f Z' % (CX, CY, x0, y0, R, R, 1 if sweep > math.pi else 0, x1, y1)
        pct = round(100 * n / total)
        out.append('<path id="slice-%s" d="%s" fill="%s"><title>%s: %d of %d (%d%%)</title></path>' % (slug(label), d, PALETTE[k], escape(label), n, total, pct))
        labels.append({'label': label, 'n': n, 'pct': pct, 'mid': (a0 + a1) / 2, 'color': PALETTE[k]})
        angle = a1
    out.append('</g>')

    for side in (1, -1):
        group = sorted((l for l in labels if (math.cos(l['mid']) >= 0) == (side == 1)), key=lambda l: math.sin(l['mid']))
        ys = [CY + (R + 30) * math.sin(l['mid']) for l in group]
        if ys:
            ys[0] = max(ys[0], TOP)
        for i in range(1, len(ys)):
            ys[i] = max(ys[i], ys[i - 1] + GAP)
        if ys and ys[-1] > BOTTOM:
            ys[-1] = BOTTOM
            for i in range(len(ys) - 2, -1, -1):
                ys[i] = min(ys[i], ys[i + 1] - GAP)
        x = CX + side * (R + 70)
        for l, y in zip(group, ys):
            l.update(x=x, y=y, side=side)
    out.append('<g id="leaders" fill="none" stroke="%s" stroke-width="1">' % MUTED)
    for l in labels:
        c, s = math.cos(l['mid']), math.sin(l['mid'])
        out.append('<polyline points="%.1f,%.1f %.1f,%.1f %.1f,%.1f"/>' % (CX + (R + 5) * c, CY + (R + 5) * s, CX + (R + 20) * c, CY + (R + 20) * s, l['x'] - l['side'] * 8, l['y'] - 5))
    out.append('</g>')
    out.append('<g id="labels">')
    for l in labels:
        anchor = 'start' if l['side'] == 1 else 'end'
        sw = l['x'] if l['side'] == 1 else l['x'] - 11
        tx = l['x'] + l['side'] * 17
        out.append('<g id="label-%s">' % slug(l['label']))
        out.append('<rect x="%.1f" y="%.1f" width="11" height="11" rx="2" fill="%s"/>' % (sw, l['y'] - 11, l['color']))
        out.append('<text x="%.1f" y="%.1f" font-size="14.5" font-weight="600" fill="%s" text-anchor="%s">%s</text>' % (tx, l['y'], INK, anchor, escape(l['label'])))
        out.append('<text x="%.1f" y="%.1f" font-size="13" fill="%s" text-anchor="%s">%d loads · %d%%</text>' % (tx, l['y'] + 18, MUTED, anchor, l['n'], l['pct']))
        out.append('</g>')
    out.append('</g>')
    if caption:
        out.append('<text id="caption" x="40" y="%d" font-size="13.5" fill="%s">' % (505, INK))
        for i, line in enumerate(caption):
            out.append('<tspan x="40" dy="%d">%s</tspan>' % (0 if i == 0 else 19, escape(line)))
        out.append('</text>')
    out.append('</svg>')
    open(os.path.join(OUT, 'charts', filename), 'w').write('\n'.join(out) + '\n')
    print(filename, [(l, n, round(100 * n / total)) for l, n in slices])

calls = [json.loads(l) for l in open(os.path.join(OUT, 'story-loads.final.jsonl'))]
n = len(calls)

FAMILY = [('worked-example', 'Worked example'), ('undocumented-contract', 'Undocumented contract'), ('second-look', 'Second look'),
          ('component-basics', 'Component basics'), ('accessibility', 'Accessibility'), ('component-choice', 'Component choice')]
fam = collections.Counter(c['cluster_family'] for c in calls)
pie('reason-families.svg', 'Why agents loaded a specific story',
    '%d story loads in 600 runs with the Storybook MCP. Reasons reconstructed from transcripts.' % n,
    [(label, fam[k]) for k, label in FAMILY])

seen = collections.Counter(('Source already shown' if c['exposure_before'] == 'inlined' else 'Guessed name' if c['exposure_before'] == 'unseen'
                            else 'Name + description' if c['listing_description'] else 'Name only') for c in calls)
pie('what-agent-had-seen.svg', 'What the agent had seen of a story before loading it', '%d story loads.' % n,
    [(k, seen[k]) for k in ('Name only', 'Name + description', 'Source already shown', 'Guessed name')])

align = collections.Counter(c['name_alignment'] for c in calls)
pie('name-alignment.svg', 'How the story name related to what the agent needed', '%d story loads, each judged by three independent coders.' % n,
    [('Names the UI being built', align['context']), ('States the information', align['direct']), ('Does not match', align['none'])],
    caption=('In %d%% of loads the story name pointed at what the agent needed. It either named the piece of UI the agent was' % round(100 * (align['context'] + align['direct']) / n),
             'building ("Mealdrop Checkout Form") or stated the information it was after ("Test Defaults To Type Button").',
             'The rest were generic names such as "Anatomy" or "Empty", loaded as a fallback.',
             'Needs were reconstructed by an annotator who could see the story name, so part of this match is built in.'))

coded = sorted(glob.glob(os.path.join(OUT, 'clustering', 'cited-coded-*.json')))
if len(coded) == 3:
    key = json.load(open(os.path.join(OUT, 'clustering', 'cited-key.json')))
    votes = [json.load(open(p))['assignments'] for p in coded]
    cited = collections.Counter()
    for item in key:
        top, k = collections.Counter(v[item] for v in votes).most_common(1)[0]
        cited[top if k >= 2 else 'other'] += 1
    stated = sum(1 for c in calls if c['evidence'] == 'stated')
    pie('cited-reasons.svg', 'What agents said when they explained a story load', '%d loads where the agent stated its purpose.' % stated,
        [("Quotes the story's name", stated - sum(cited.values())), ('Points at the story', cited['points-at-story']),
         ('A decision hinges on it', cited['decision-hinges']), ('Sweeps remaining stories', cited['sweep']),
         ('Gap in the docs', cited['docs-gap']), ('Other', cited['other'])])
