"""Pick 10 calls for the replay pilot: one per reason cluster, thinking block present, smallest context, >=3 with stated purpose."""
import json, os

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.join(OUT, '..', '..', '..')
calls = [json.loads(l) for l in open(os.path.join(OUT, 'story-loads.final.jsonl'))]

def context_tokens(c):
    """Context size the original run had at this call, from the transcript's own usage record."""
    n = 0
    for line in open(os.path.join(ROOT, 'agent-eval', c['run_dir'], 'transcript-raw.jsonl')):
        try:
            o = json.loads(line)
        except Exception:
            continue
        m = o.get('message')
        if not isinstance(m, dict) or not isinstance(m.get('content'), list):
            continue
        for b in m['content']:
            if isinstance(b, dict) and b.get('type') == 'tool_use' and b['name'].endswith('get-documentation-for-story'):
                n += 1
                if n == c['call_ordinal_in_run']:
                    u = m.get('usage') or {}
                    return u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0) + u.get('cache_creation_input_tokens', 0)
    return None

TARGETS = ['example-model', 'native-contract', 'example-form-wiring', 'parts-wiring', 'a11y-name', 'variant-catalogue',
           'indirect-probe', 'usage-guidance', 'reload-isolate', 'reload-opaque']
WANT_STATED = {'native-contract', 'example-form-wiring', 'example-model'}
picked = []
for cluster in TARGETS:
    pool = [c for c in calls if c['cluster'] == cluster and c['thinking_block_before'] and c['story_found']]
    if cluster in WANT_STATED:
        pool = [c for c in pool if c['evidence'] == 'stated'] or pool
    for c in pool:
        c['context_tokens'] = context_tokens(c)
    pool = sorted((c for c in pool if c['context_tokens']), key=lambda c: c['context_tokens'])
    if pool:
        picked.append(pool[0])
json.dump([{k: c[k] for k in ('call_id', 'case', 'workflow_id', 'run_dir', 'component', 'component_id', 'story_name', 'call_ordinal_in_run',
                               'cluster', 'evidence', 'context_tokens')} for c in picked], open(os.path.join(OUT, 'replay', 'pilot-calls.json'), 'w'), indent=1)
for c in picked:
    print('%s %-20s %-13s %s %-9s ctx=%6d  %s / %s' % (c['call_id'], c['cluster'], c['case'], c['workflow_id'], c['evidence'], c['context_tokens'], c['component'], c['story_name']))
print('total context tokens', sum(c['context_tokens'] for c in picked))
