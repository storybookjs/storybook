"""Agreement between partitions of the same items.

usage: agreement.py open  A.json B.json C.json          (open clusterings of the dev split)
       agreement.py coded codebook.json c1.json c2.json c3.json   (closed coding, all items)
Each coder file is {"assignments": {item_id: cluster_id}}; the codebook lists clusters with a "family".
"""
import collections, itertools, json, os, sys

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key = json.load(open(os.path.join(OUT, 'clustering', 'key.json')))

def comb2(n):
    return n * (n - 1) / 2

def ari(a, b, items):
    """Adjusted Rand index of two labelings over the same items."""
    cont = collections.Counter((a[i], b[i]) for i in items)
    sa, sb = collections.Counter(a[i] for i in items), collections.Counter(b[i] for i in items)
    index = sum(comb2(v) for v in cont.values())
    ea, eb = sum(comb2(v) for v in sa.values()), sum(comb2(v) for v in sb.values())
    expected, maximum = ea * eb / comb2(len(items)), (ea + eb) / 2
    return (index - expected) / (maximum - expected) if maximum != expected else 1.0

def pair_agreement(a, b, items):
    """Share of item pairs on which two partitions agree (same-cluster vs different-cluster)."""
    same = tot = 0
    for x, y in itertools.combinations(items, 2):
        same += (a[x] == a[y]) == (b[x] == b[y]); tot += 1
    return same / tot

def alpha_nominal(labelings, items):
    """Krippendorff's alpha, nominal, complete data."""
    m = len(labelings)
    o = collections.Counter()
    for i in items:
        vals = [l[i] for l in labelings]
        for x, y in itertools.permutations(range(m), 2):
            o[(vals[x], vals[y])] += 1 / (m - 1)
    n_c = collections.Counter()
    for (c, _), v in o.items():
        n_c[c] += v
    n = sum(n_c.values())
    d_o = sum(v for (c, k), v in o.items() if c != k)
    d_e = sum(n_c[c] * n_c[k] for c in n_c for k in n_c if c != k) / (n - 1)
    return 1 - d_o / d_e if d_e else 1.0

def load(path):
    return json.load(open(path))['assignments']

mode = sys.argv[1]
if mode == 'open':
    labs = [load(p) for p in sys.argv[2:]]
    items = sorted(set.intersection(*[set(l) for l in labs]))
    print('items', len(items), 'cluster counts', [len(set(l.values())) for l in labs])
    for (i, a), (j, b) in itertools.combinations(enumerate(labs), 2):
        print('  %s vs %s: ARI %.2f  pair agreement %.1f%%' % (sys.argv[2 + i][-6:-5], sys.argv[2 + j][-6:-5], ari(a, b, items), 100 * pair_agreement(a, b, items)))
else:
    book = json.load(open(sys.argv[2]))
    family = {c['id']: c.get('family', c['id']) for c in book['clusters']}
    family['none'] = 'none'
    labs = [load(p) for p in sys.argv[3:]]
    unknown = sorted({v for l in labs for v in l.values() if v not in family})
    assert not unknown, 'ids not in codebook: %s' % unknown
    def report(name, items):
        if not items:
            return
        for level, f in (('fine', lambda v: v), ('family', lambda v: family[v])):
            ls = [{i: f(l[i]) for i in items} for l in labs]
            pairs = [sum(a[i] == b[i] for i in items) / len(items) for a, b in itertools.combinations(ls, 2)]
            unanimous = sum(len({l[i] for l in ls}) == 1 for i in items) / len(items)
            print('  %-8s %-6s n=%3d  pairwise agreement %s (mean %.1f%%)  unanimous %.1f%%  alpha %.3f' % (
                name, level, len(items), ' '.join('%.1f%%' % (100 * p) for p in pairs), 100 * sum(pairs) / len(pairs), 100 * unanimous, alpha_nominal(ls, items)))
    prim = [i for i in key if key[i]['annotator'] == 'primary' and all(i in l for l in labs)]
    report('holdout', [i for i in prim if key[i]['split'] == 'holdout'])
    report('dev', [i for i in prim if key[i]['split'] == 'dev'])
    report('all', prim)
    none = [sum(l[i] == 'none' for i in prim) / len(prim) for l in labs]
    print('  none-fits rate per coder: %s' % ' '.join('%.1f%%' % (100 * x) for x in none))
    # majority label, and the confusions that cost the most agreement
    conf = collections.Counter()
    for i in prim:
        vals = sorted({l[i] for l in labs})
        for a, b in itertools.combinations(vals, 2):
            conf[(a, b)] += 1
    print('  most confused pairs:', conf.most_common(8))
    # annotation-induced instability: same call, two annotators, one coder
    by_call = collections.defaultdict(dict)
    for i, k in key.items():
        by_call[k['call_id']][k['annotator']] = i
    both = [(v['primary'], v['second']) for v in by_call.values() if len(v) == 2 and all(v['primary'] in l and v['second'] in l for l in labs)]
    if both:
        for level, f in (('fine', lambda v: v), ('family', lambda v: family[v])):
            rates = [sum(f(l[p]) == f(l[s]) for p, s in both) / len(both) for l in labs]
            print('  two annotators, same coder, %-6s n=%d: same cluster %s' % (level, len(both), ' '.join('%.1f%%' % (100 * r) for r in rates)))
