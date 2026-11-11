"""Attach majority-vote cluster labels to every call.  usage: finalize_labels.py codebook.json coder1.json coder2.json coder3.json"""
import collections, json, os, sys

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
book = json.load(open(sys.argv[1]))
family = {c['id']: c['family'] for c in book['clusters']}
family['none'] = 'none'
coders = [json.load(open(p))['assignments'] for p in sys.argv[2:]]
key = json.load(open(os.path.join(OUT, 'clustering', 'key.json')))
kinds = json.load(open(os.path.join(OUT, 'story-kinds.json')))
item_of = {k['call_id']: i for i, k in key.items() if k['annotator'] == 'primary'}

def majority(values):
    top, n = collections.Counter(values).most_common(1)[0]
    return (top, n) if n >= 2 else ('unresolved', n)

out = []
for line in open(os.path.join(OUT, 'story-loads.annotated.jsonl')):
    r = json.loads(line)
    votes = [c[item_of[r['call_id']]] for c in coders]
    cluster, n = majority(votes)
    fam, nf = majority([family[v] for v in votes])
    r.update({'cluster': cluster, 'cluster_family': fam, 'cluster_votes': votes, 'cluster_unanimous': n == len(votes),
              'family_unanimous': nf == len(votes), 'story_kind': kinds.get(r['story_id'], 'not-in-instance'),
              'split': key[item_of[r['call_id']]]['split']})
    out.append(r)
with open(os.path.join(OUT, 'story-loads.final.jsonl'), 'w') as f:
    for r in out:
        f.write(json.dumps(r) + '\n')
c = collections.Counter
print('calls', len(out), 'unanimous fine %.1f%%' % (100 * sum(r['cluster_unanimous'] for r in out) / len(out)),
      'unanimous family %.1f%%' % (100 * sum(r['family_unanimous'] for r in out) / len(out)))
print('clusters', c(r['cluster'] for r in out).most_common())
print('families', c(r['cluster_family'] for r in out).most_common())
