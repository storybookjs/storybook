#!/usr/bin/env python3
"""Classify each trial's trace: what clamped the scroll, which mechanisms fired."""

import glob
import json
import os
from collections import defaultdict

RESULTS = '/tmp/claude-0/-home-user-storybook/10a8e711-1b08-5701-8d8b-52ba7c733784/scratchpad/results'

rows = []
for f in sorted(glob.glob(os.path.join(RESULTS, 'trace-*.json'))):
    d = json.load(open(f))
    trace = d['trace']
    trial = os.path.basename(f)[len('trace-') : -len('.json')]

    spinner_fired = any('sb-show-preparing-story' in e['cls'] for e in trace)
    unmounts = [e for e in trace if e['type'] == 'dom' and 'storybook-root +0/-1' in e['d']]
    remounts = [e for e in trace if e['type'] == 'dom' and 'storybook-root +1/-0' in e['d']]

    # first frame where y collapsed from high to low
    clamp = None
    prev_y = None
    for e in trace:
        if e['type'] == 'frame' and '->' in e['d']:
            try:
                part = e['d'].split(',')[0].replace('y ', '')
                y_from, y_to = (int(x) for x in part.split('->'))
            except ValueError:
                continue
            if y_from >= 1000 and y_to < 200:
                clamp = e
                break

    clamp_cause = '-'
    if clamp is not None:
        # h at clamp time tells us if the doc was collapsed
        collapsed = clamp['h'] < 1500
        spin_at_clamp = 'sb-show-preparing-story' in clamp['cls'] and 'sb-show-main' not in clamp['cls']
        if spin_at_clamp:
            clamp_cause = 'spinner-collapse'
        elif collapsed:
            clamp_cause = 'unmount-collapse'
        else:
            clamp_cause = 'explicit-or-other'

    rows.append(
        {
            'trial': trial,
            'config': d['config'],
            'story': d['storyName'],
            'kept': (not d['reloaded']) and d['finalY'] >= 1495,
            'finalY': d['finalY'],
            'reloaded': d['reloaded'],
            'tokenApplied': d['tokenApplied'],
            'spinnerFired': spinner_fired,
            'unmounts': len(unmounts),
            'remounts': len(remounts),
            'clampCause': clamp_cause,
            'clampT': None if clamp is None else clamp['t'] - trace[0]['t'],
        }
    )

print(f"{'trial':<24} {'kept':<5} {'finalY':<7} {'clampCause':<18} {'spinner':<8} {'unmts':<6} {'reload'}")
for r in rows:
    print(
        f"{r['trial']:<24} {str(r['kept']):<5} {r['finalY']:<7} {r['clampCause']:<18} "
        f"{str(r['spinnerFired']):<8} {r['unmounts']:<6} {r['reloaded']}"
    )

print('\n=== per config/story ===')
agg = defaultdict(list)
for r in rows:
    agg[(r['config'], r['story'])].append(r)
print(f"{'config':<16} {'story':<5} {'kept':<7} {'causes'}")
for (config, story), rs in agg.items():
    causes = defaultdict(int)
    for r in rs:
        if not r['kept']:
            causes[r['clampCause'] if not r['reloaded'] else 'full-reload'] += 1
    kept = sum(1 for r in rs if r['kept'])
    print(f"{config:<16} {story:<5} {kept}/{len(rs):<5} {dict(causes) if causes else 'all kept'}")
