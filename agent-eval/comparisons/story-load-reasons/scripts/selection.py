"""Story selection rates: how each story of a Storybook instance reached the agent.

Per run a story is, in priority order:
  manual   the agent loaded it with get-documentation-for-story
  auto     its full source was inlined in a component docs output (pushed, not chosen)
  listed   it appeared without source (name, sometimes a one-line description) and was not loaded
  unseen   it never appeared in any output of the run
Selection rate of a story = runs that loaded it manually / runs that listed it without source.
"""
import collections, csv, json, os, statistics

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
exposures = [json.loads(l) for l in open(os.path.join(OUT, 'exposures.jsonl'))]
universe = json.load(open(os.path.join(OUT, 'universe.json')))
cases = sorted({e['case'] for e in exposures})
wfs = sorted({e['workflow_id'] for e in exposures})

rows, summary = [], {}
for case in cases:
    stories = universe.get(case, {})
    for scope in wfs + ['all']:
        runs = [e for e in exposures if e['case'] == case and (scope == 'all' or e['workflow_id'] == scope)]
        cat = collections.Counter()
        for sid, name in stories.items():
            n_manual = sum(sid in e['manual'] for e in runs)
            n_auto = sum(sid in e['inlined'] for e in runs)
            # offered without source: listed in the run and never inlined in it
            n_listed = sum((sid in e['named']) and (sid not in e['inlined']) for e in runs)
            category = 'manual' if n_manual else 'auto' if n_auto else 'listed' if n_listed else 'unseen'
            cat[category] += 1
            rows.append({'case': case, 'workflow_id': scope, 'story_id': sid, 'story_name': name, 'component_id': sid.split('--')[0],
                         'runs': len(runs), 'runs_manual': n_manual, 'runs_auto_inlined': n_auto, 'runs_listed_no_source': n_listed,
                         'selection_rate': round(n_manual / n_listed, 3) if n_listed else '', 'category': category})
        summary[(case, scope)] = dict(cat, stories=len(stories), runs=len(runs))

with open(os.path.join(OUT, 'story-selection.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader(); w.writerows(rows)

def pct(n, d):
    return '%4.0f%%' % (100 * n / d) if d else '   –'

lines = ['| case | stories seen | manual | auto (inlined) | listed, never loaded | unseen |', '|---|---:|---:|---:|---:|---:|']
print('PER CASE, all 50 runs (share of the case\'s known stories)')
for case in cases:
    s = summary[(case, 'all')]; n = s['stories']
    if not n:
        continue
    print('%-16s stories=%3d  manual %s  auto %s  listed-only %s  unseen %s' % (case, n, pct(s.get('manual', 0), n), pct(s.get('auto', 0), n), pct(s.get('listed', 0), n), pct(s.get('unseen', 0), n)))
    lines.append('| %s | %d | %s | %s | %s | %s |' % (case, n, pct(s.get('manual', 0), n).strip(), pct(s.get('auto', 0), n).strip(), pct(s.get('listed', 0), n).strip(), pct(s.get('unseen', 0), n).strip()))
print('\nPER CELL (10 runs): manual / auto / listed-only / unseen as % of case stories')
for case in cases:
    if not summary[(case, 'all')]['stories']:
        continue
    cells = []
    for wf in wfs:
        s = summary[(case, wf)]; n = s['stories']
        cells.append('%s:%s/%s/%s/%s' % (wf, pct(s.get('manual', 0), n).strip(), pct(s.get('auto', 0), n).strip(), pct(s.get('listed', 0), n).strip(), pct(s.get('unseen', 0), n).strip()))
    print('%-16s %s' % (case, '  '.join(cells)))

print('\nSELECTION-RATE DISTRIBUTION (case level, stories listed without source in >=5 runs)')
for case in cases:
    rs = [r for r in rows if r['case'] == case and r['workflow_id'] == 'all' and r['runs_listed_no_source'] >= 5]
    if not rs:
        continue
    rates = sorted(r['selection_rate'] for r in rs)
    zero = sum(1 for x in rates if x == 0)
    print('%-16s n=%3d  never selected %s  median %.2f  p90 %.2f  max %.2f' % (case, len(rates), pct(zero, len(rates)), statistics.median(rates), rates[int(len(rates) * .9) - 1 if len(rates) > 1 else 0], rates[-1]))
print('\nTOP STORIES by selection rate, per (case, workflow) cell with >=5 listings')
top = sorted((r for r in rows if r['workflow_id'] != 'all' and r['runs_listed_no_source'] >= 5 and r['runs_manual']), key=lambda r: (-r['selection_rate'], -r['runs_manual']))
for r in top[:28]:
    print('  %.2f  %2d/%2d  %-14s %s  %s' % (r['selection_rate'], r['runs_manual'], r['runs_listed_no_source'], r['case'], r['workflow_id'], r['story_id']))
json.dump({'%s|%s' % k: v for k, v in summary.items()}, open(os.path.join(OUT, 'selection-summary.json'), 'w'), indent=1)
open(os.path.join(OUT, 'selection-table.md'), 'w').write('\n'.join(lines) + '\n')
listing_cases = sorted({a for a in cases if any(True for e in exposures if e['case'] == a)})
print('\nuniverse sizes', {a: len(universe.get(a, {})) for a in cases})
