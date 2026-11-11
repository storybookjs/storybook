"""Merge annotations into the call records and build blind inputs for the clustering steps.

Writes:
  story-loads.annotated.jsonl   call records + primary annotation
  clustering/items.json         every item to code: opaque item id -> need / trigger / cue
                                (primary annotations for all calls, plus the second-opinion
                                annotations of the 25% subsample under separate opaque ids)
  clustering/key.json           private map item id -> call id, annotator, split (never shown to coders)
  clustering/dev-A|B|C.json     the 60% development split in three different orders, for open induction
"""
import glob, hashlib, json, os, random

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(OUT, 'clustering'), exist_ok=True)
records = [json.loads(l) for l in open(os.path.join(OUT, 'story-loads.jsonl'))]

def load(pattern):
    out = {}
    for f in sorted(glob.glob(os.path.join(OUT, 'annotations', pattern))):
        for a in json.load(open(f)):
            out[a['call_id']] = a
    return out

primary, second = load('batch-*.json'), load('dup-*.json')
missing = [r['call_id'] for r in records if r['call_id'] not in primary]
assert not missing, 'calls without a primary annotation: %s' % missing

with open(os.path.join(OUT, 'story-loads.annotated.jsonl'), 'w') as f:
    for r in records:
        a = primary[r['call_id']]
        f.write(json.dumps({**r, **{k: a.get(k) for k in ('need', 'trigger', 'cue', 'reason', 'evidence', 'evidence_quote', 'confidence', 'outcome', 'outcome_note')},
                            'second_opinion': second.get(r['call_id'])}) + '\n')

def split_of(run_key):   # by run, so calls of one run never straddle the split
    return 'dev' if int(hashlib.sha1(('split' + run_key).encode()).hexdigest(), 16) % 10 < 6 else 'holdout'

rows = [(r['call_id'], 'primary', split_of(r['run_key']), primary[r['call_id']]) for r in records]
rows += [(r['call_id'], 'second', split_of(r['run_key']), second[r['call_id']]) for r in records if r['call_id'] in second]
random.Random(20261111).shuffle(rows)
items, key = {}, {}
for n, (call_id, who, split, a) in enumerate(rows, 1):
    iid = 'i%03d' % n
    items[iid] = {'need': a['need'], 'trigger': a['trigger'], 'cue': a['cue']}
    key[iid] = {'call_id': call_id, 'annotator': who, 'split': split}
json.dump(items, open(os.path.join(OUT, 'clustering', 'items.json'), 'w'), indent=1)
json.dump(key, open(os.path.join(OUT, 'clustering', 'key.json'), 'w'), indent=1)

dev = [i for i in items if key[i]['split'] == 'dev' and key[i]['annotator'] == 'primary']
for label, seed in (('A', 1), ('B', 2), ('C', 3)):
    order = dev[:]
    random.Random(seed).shuffle(order)
    json.dump({i: items[i] for i in order}, open(os.path.join(OUT, 'clustering', 'dev-%s.json' % label), 'w'), indent=1)

import collections
print('items', len(items), 'primary', sum(1 for k in key.values() if k['annotator'] == 'primary'), 'second', len(second))
print('split (primary)', collections.Counter(k['split'] for k in key.values() if k['annotator'] == 'primary'))
print('evidence', collections.Counter(a['evidence'] for a in primary.values()).most_common())
print('confidence', collections.Counter(a['confidence'] for a in primary.values()).most_common())
print('outcome', collections.Counter(a['outcome'] for a in primary.values()).most_common())
