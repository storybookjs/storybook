"""Build the deliverables: story-loads.csv (stats-ready), calls.md (every call with its reason), report.md."""
import collections, csv, json, os, re

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda name: json.load(open(os.path.join(OUT, name)))
calls = [json.loads(l) for l in open(os.path.join(OUT, 'story-loads.final.jsonl'))]
book, stats, by_kind = J('clustering/codebook-v1.json'), J('stats.json'), J('selection-by-kind.json')
clusters = {c['id']: c for c in book['clusters']}

def opaque_helper(result):
    """True when the story source is a single element that is not a design-system import (a local demo helper)."""
    imports = set(re.findall(r'\b([A-Z]\w+)\b', ' '.join(re.findall(r'import \{([^}]*)\}', result))))
    body = re.search(r'=> \(?\s*([\s\S]*?)\)?;\s*```', result)
    if not body:
        return False
    tags = re.findall(r'<([A-Z]\w*)', body.group(1))
    return len(tags) >= 1 and tags[0] not in imports and len(set(tags)) == 1

for c in calls:
    c['opaque_helper'] = bool(c['story_found'] and opaque_helper(c['result']))
name_alignment = J('clustering/name-alignment.json') if os.path.exists(os.path.join(OUT, 'clustering', 'name-alignment.json')) else {}
for c in calls:
    c['name_alignment'] = name_alignment.get(c['call_id'])

FIELDS = ['call_id', 'arm', 'workflow', 'workflow_id', 'run_key', 'run_dir', 'result_ts', 'run', 'run_status', 'component_id', 'component',
          'story_name', 'story_id', 'story_kind', 'story_found', 'name_alignment', 'exposure_before', 'listing_description', 'opaque_helper', 'call_ordinal_in_run',
          'story_calls_in_run', 'tool_call_index', 'tool_calls_in_run', 'run_position', 'phase', 'thinking_block_before', 'evidence', 'confidence',
          'outcome', 'cluster', 'cluster_family', 'cluster_unanimous', 'split', 'need', 'trigger', 'cue', 'reason', 'evidence_quote', 'outcome_note']
with open(os.path.join(OUT, 'story-loads.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction='ignore')
    w.writeheader(); w.writerows(calls)
with open(os.path.join(OUT, 'story-loads.final.jsonl'), 'w') as f:
    for c in calls:
        f.write(json.dumps(c) + '\n')

EXPOSURE = {'named_in_docs': 'listed without source in the component docs', 'inlined': 'already shown in full', 'named_in_listing': 'listed in the global listing only', 'unseen': 'never shown (guessed name)'}
fam_order = [f for f, _ in collections.Counter(c['cluster_family'] for c in calls).most_common()]
size = collections.Counter(c['cluster'] for c in calls)

# ---- calls.md -------------------------------------------------------------
L = ['# Story loads: every call and its reconstructed reason', '',
     '%d `get-documentation-for-story` calls from 650 current runs, grouped by reason cluster. Reasons are reconstructed by an annotator from the transcript; `evidence` says how directly the agent stated its purpose. The same rows are in `story-loads.csv`.' % len(calls), '']
for fam in fam_order:
    L += ['## Family: %s' % fam, '']
    for cid in sorted({c['cluster'] for c in calls if c['cluster_family'] == fam}, key=lambda k: -size[k]):
        L += ['### %s — %s (%d calls)' % (cid, clusters[cid]['label'], size[cid]), '', clusters[cid]['definition'], '']
        for c in sorted((c for c in calls if c['cluster'] == cid), key=lambda c: (c['workflow_id'], c['arm'], c['call_id'])):
            L += ['#### %s · %s · %s · %s / "%s"' % (c['call_id'], c['arm'], c['workflow_id'], c['component'], c['story_name']), '',
                  '`%s` · story call %d of %d in the run · tool call %d of %d · %s · story %s · kind `%s` · evidence `%s` · confidence `%s` · outcome `%s`%s' % (
                      c['run_dir'], c['call_ordinal_in_run'], c['story_calls_in_run'], c['tool_call_index'], c['tool_calls_in_run'], c['phase'].replace('_', ' '),
                      EXPOSURE[c['exposure_before']], c['story_kind'], c['evidence'], c['confidence'], c['outcome'], '' if c['cluster_unanimous'] else ' · coders split: %s' % ', '.join(c['cluster_votes'])), '',
                  '**Need.** %s' % c['need'], '', '**Reason.** %s' % c['reason'], '']
            if c.get('evidence_quote'):
                L += ['> %s' % c['evidence_quote'].replace('\n', ' '), '']
open(os.path.join(OUT, 'calls.md'), 'w').write('\n'.join(L))

# ---- tables for report.md -------------------------------------------------
def cluster_table():
    rows = ['| Family | Cluster | What the agent wanted | Calls | Runs | Arms | Most-loaded stories |', '|---|---|---|---:|---:|---:|---|']
    for fam in fam_order:
        for cid in sorted({c['cluster'] for c in calls if c['cluster_family'] == fam}, key=lambda k: -size[k]):
            cs = [c for c in calls if c['cluster'] == cid]
            top = collections.Counter('%s "%s"' % (c['component'], c['story_name']) for c in cs).most_common(2)
            rows.append('| %s | `%s` | %s | %d | %d | %d | %s |' % (fam, cid, clusters[cid]['label'], len(cs), len({c['run_key'] for c in cs}), len({c['arm'] for c in cs}),
                                                              '; '.join('%s (%d)' % t for t in top)))
    return '\n'.join(rows)

def test_table(key, groups_label):
    b = stats[key]
    rows = ['| %s | Cramér\'s V | p | q (BH) | Runs with it, by %s |' % ('Target', groups_label), '|---|---:|---:|---:|---|']
    for t in sorted(b['tests'], key=lambda t: t['p']):
        shares = ', '.join('%s %d/%d' % (g, p, n) for g, p, n in zip(t['groups'], t['present'], t['n']))
        rows.append('| `%s`%s | %.2f | %.4f | %.4f | %s |' % (t['target'], ' *' if t['significant'] else '', t['cramers_v'], t['p'], t['q'], shares))
    return '\n'.join(rows)

def kind_table():
    rows = ['| Story kind | Stories | `stories-full` | `full` | `purge-jsdoc` |', '|---|---:|---:|---:|---:|']
    idx = {(r['arm'], r['kind']): r for r in by_kind}
    for k in ('app-example', 'test', 'anatomy', 'showcase-highlight', 'api-ref-prop', 'default'):
        cell = lambda a: ('%.1f%% (%d/%d)' % (100 * idx[(a, k)]['selection_rate'], idx[(a, k)]['manual_loads'], idx[(a, k)]['listed_exposures'])) if (a, k) in idx and idx[(a, k)]['listed_exposures'] else '–'
        rows.append('| %s | %d | %s | %s | %s |' % (k, idx[('stories-full', k)]['stories'], cell('stories-full'), cell('full'), cell('purge-jsdoc')))
    return '\n'.join(rows)

def arm_table():
    arms = sorted({c['arm'] for c in calls}, key=lambda a: -sum(1 for c in calls if c['arm'] == a))
    rows = ['| Family | ' + ' | '.join(arms) + ' |', '|---|' + '---:|' * len(arms)]
    for fam in fam_order:
        rows.append('| %s | ' % fam + ' | '.join(str(sum(1 for c in calls if c['arm'] == a and c['cluster_family'] == fam)) for a in arms) + ' |')
    return '\n'.join(rows)

n = len(calls)
op = [c for c in calls if c['opaque_helper']]
ex = [c for c in calls if c['story_kind'] == 'app-example']
facts = {
    'n': n, 'runs': len({c['run_key'] for c in calls}),
    'opaque': len(op), 'opaque_examples': sum(1 for c in ex if c['opaque_helper']), 'examples': len(ex),
    'opaque_top': ', '.join('%s "%s" (%d)' % (k[0], k[1], v) for k, v in collections.Counter((c['component'], c['story_name']) for c in op if c['story_kind'] == 'app-example').most_common(3)),
    'cluster_table': cluster_table(), 'kind_table': kind_table(), 'arm_table': arm_table(),
    'b1': test_table('family_x_workflow', 'workflow'), 'b2': test_table('cluster_x_workflow', 'workflow'),
    'c1': test_table('family_x_arm_all_runs', 'arm'), 'c2': test_table('cluster_x_arm_all_runs', 'arm'),
    'c4': test_table('family_stories-full_vs_full', 'arm'),
    'kind_v': stats['family_x_kind']['cramers_v'], 'kind_pred': round(100 * stats['family_x_kind']['kind_predicts_family']),
}
json.dump({k: v for k, v in facts.items() if not k.endswith('table') and k not in ('b1', 'b2', 'c1', 'c2', 'c4')}, open(os.path.join(OUT, 'report-facts.json'), 'w'), indent=1)
template = open(os.path.join(OUT, 'scripts', 'report-template.md')).read()
open(os.path.join(OUT, 'report.md'), 'w').write(template.format(**facts))
print({k: v for k, v in facts.items() if k in ('n', 'runs', 'opaque', 'opaque_examples', 'examples', 'opaque_top', 'kind_v', 'kind_pred')})
print('calls.md lines', len(L))
