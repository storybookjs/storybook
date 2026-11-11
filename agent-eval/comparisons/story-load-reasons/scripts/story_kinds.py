"""Deterministic story-kind taxonomy, independent of the LLM reason clusters.

Kind comes from the story name and from which content tier of the design-system Storybook first
ships the story (the cases are nested content variants, so set membership recovers the authoring facet).
Also reports the selection rate per kind: manual loads / runs that listed the story without source.
"""
import collections, csv, json, os

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
universe = json.load(open(os.path.join(OUT, 'universe.json')))
basic, apiref, anatomy_tier = set(universe['basic-docs']), set(universe['api-ref']), set(universe['docs-full'])

def kind(story_id, name):
    if name.startswith('Mealdrop ') or name.startswith('Drop Board '):
        return 'app-example'
    if name.startswith('Test '):
        return 'test'
    if name == 'Anatomy':
        return 'anatomy'
    if name == 'Empty':
        return 'autogen-empty'
    if name == 'Default':
        return 'default'
    if story_id in basic:
        return 'showcase-highlight'
    if story_id in apiref:
        return 'api-ref-prop'
    return 'other-full-only'

kinds = {}
for case, stories in universe.items():
    for sid, name in stories.items():
        kinds[sid] = kind(sid, name)
json.dump(dict(sorted(kinds.items())), open(os.path.join(OUT, 'story-kinds.json'), 'w'), indent=1)

rows = list(csv.DictReader(open(os.path.join(OUT, 'story-selection.csv'))))
order = ['app-example', 'test', 'anatomy', 'showcase-highlight', 'api-ref-prop', 'other-full-only', 'default', 'autogen-empty']
print('kind counts in the full instance:', collections.Counter(kinds[s] for s in universe['stories-full']).most_common())
print('examples of other-full-only:', [n for s, n in universe['stories-full'].items() if kinds[s] == 'other-full-only'][:14])
table = []
for case in ('stories-full', 'full', 'purge-jsdoc', 'api-ref', 'stories-api-ref', 'purge-docgen'):
    print('\n%s — per kind: stories | listed-without-source run-exposures | manual loads | rate | stories ever loaded' % case)
    for k in order:
        rs = [r for r in rows if r['case'] == case and r['workflow_id'] == 'all' and kinds[r['story_id']] == k]
        if not rs:
            continue
        listed = sum(int(r['runs_listed_no_source']) for r in rs)
        manual = sum(int(r['runs_manual']) for r in rs)
        ever = sum(1 for r in rs if int(r['runs_manual']))
        auto = sum(int(r['runs_auto_inlined']) for r in rs)
        rate = manual / listed if listed else float('nan')
        print('  %-19s %3d | %5d | %3d | %5.1f%% | %2d   (auto-inlined exposures %d)' % (k, len(rs), listed, manual, 100 * rate if listed else 0, ever, auto))
        table.append({'case': case, 'kind': k, 'stories': len(rs), 'listed_exposures': listed, 'manual_loads': manual,
                      'selection_rate': round(rate, 4) if listed else None, 'stories_ever_loaded': ever, 'auto_inlined_exposures': auto})
json.dump(table, open(os.path.join(OUT, 'selection-by-kind.json'), 'w'), indent=1)
recs = [json.loads(l) for l in open(os.path.join(OUT, 'story-loads.annotated.jsonl'))]
print('\nmanual calls by kind:', collections.Counter(kinds.get(r['story_id'], 'not-in-instance') for r in recs).most_common())
