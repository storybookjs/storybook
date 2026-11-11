"""Do reason clusters associate with workflow or case?  Unit of analysis: the run.

Every test is a stratified Monte Carlo permutation test on a chi-square statistic of a
presence-by-group table, so sparse cells and non-independent calls within a run are not a problem.
P-values are corrected with Benjamini-Hochberg at 5% within each block of tests.
"""
import collections, itertools, json, math, os, random

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N_PERM, SEED, MIN_RUNS = 20000, 20261111, 8
calls = [json.loads(l) for l in open(os.path.join(OUT, 'story-loads.final.jsonl'))]
runs = [json.loads(l) for l in open(os.path.join(OUT, 'exposures.jsonl'))]
by_run = collections.defaultdict(list)
for c in calls:
    by_run[c['run_key']].append(c)
for r in runs:
    cs = by_run.get(r['run_key'], [])
    r['n_calls'] = len(cs)
    r['clusters'] = {c['cluster'] for c in cs}
    r['families'] = {c['cluster_family'] for c in cs}
    r['clusters_stated'] = {c['cluster'] for c in cs if c['evidence'] != 'inferred'}
    r['families_stated'] = {c['cluster_family'] for c in cs if c['evidence'] != 'inferred'}

def chi2(table):
    rows = [sum(r) for r in table]; cols = [sum(c) for c in zip(*table)]; n = sum(rows)
    s = 0.0
    for i, r in enumerate(table):
        for j, o in enumerate(r):
            e = rows[i] * cols[j] / n if n else 0
            if e:
                s += (o - e) ** 2 / e
    return s

def cramers_v(table):
    n = sum(map(sum, table)); k = min(len(table), len(table[0])) - 1
    return math.sqrt(chi2(table) / (n * k)) if n and k else 0.0

def perm_test(units, group, present, strata, rng):
    """units: list; group(u)->label; present(u)->bool; shuffle group labels within strata(u)."""
    groups = sorted({group(u) for u in units})
    def table(labels):
        t = [[0] * len(groups) for _ in range(2)]
        for u, g in zip(units, labels):
            t[1 if present(u) else 0][groups.index(g)] += 1
        return t
    labels = [group(u) for u in units]
    obs_t = table(labels); obs = chi2(obs_t)
    idx = collections.defaultdict(list)
    for k, u in enumerate(units):
        idx[strata(u)].append(k)
    ge = 0
    for _ in range(N_PERM):
        perm = labels[:]
        for ks in idx.values():
            vals = [labels[k] for k in ks]; rng.shuffle(vals)
            for k, v in zip(ks, vals):
                perm[k] = v
        ge += chi2(table(perm)) >= obs - 1e-12
    return {'groups': groups, 'present': obs_t[1], 'n': [a + b for a, b in zip(*obs_t)], 'chi2': round(obs, 3),
            'cramers_v': round(cramers_v(obs_t), 3), 'p': (ge + 1) / (N_PERM + 1)}

def bh(tests, alpha=0.05):
    order = sorted(range(len(tests)), key=lambda i: tests[i]['p'])
    m, prev = len(tests), 1.0
    for rank in range(m, 0, -1):
        i = order[rank - 1]
        prev = min(prev, tests[i]['p'] * m / rank)
        tests[i]['q'] = round(prev, 4)
        tests[i]['significant'] = prev <= alpha
    return tests

def block(title, units, group, strata, level_sets, rng, note=''):
    names = collections.Counter(x for u in units for x in level_sets(u))
    tests = []
    for name, n in names.most_common():
        if n < MIN_RUNS or name in ('unresolved', 'none'):
            continue
        t = perm_test(units, group, lambda u, name=name: name in level_sets(u), strata, rng)
        t['target'] = name
        tests.append(t)
    bh(tests)
    print('\n## %s  (units=%d%s)' % (title, len(units), '; ' + note if note else ''))
    for t in sorted(tests, key=lambda t: t['p']):
        shares = ' '.join('%s:%d/%d' % (g, p, n) for g, p, n in zip(t['groups'], t['present'], t['n']))
        print('  %-22s V=%.2f p=%.4f q=%.4f %s  %s' % (t['target'], t['cramers_v'], t['p'], t['q'], '*' if t['significant'] else ' ', shares))
    return {'title': title, 'units': len(units), 'note': note, 'tests': tests}

rng = random.Random(SEED)
results = {}
loaders = [r for r in runs if r['n_calls']]
CASES3 = ('stories-full', 'full', 'purge-jsdoc')

# A. propensity to load any story
print('## A. Runs that loaded at least one story')
cases = sorted({r['case'] for r in runs}); wfs = sorted({r['workflow_id'] for r in runs})
prop = {a: {w: [sum(1 for r in runs if r['case'] == a and r['workflow_id'] == w and r['n_calls']), sum(r['n_calls'] for r in runs if r['case'] == a and r['workflow_id'] == w)] for w in wfs} for a in cases}
print('%-16s' % 'runs/10 (calls)' + ' '.join('%9s' % w for w in wfs) + '   total')
for a in cases:
    print('%-16s' % a + ' '.join('%4d (%2d) ' % tuple(prop[a][w]) for w in wfs) + '  %3d/50 (%d)' % (sum(prop[a][w][0] for w in wfs), sum(prop[a][w][1] for w in wfs)))
results['propensity'] = prop
pair_tests = []
for a, b, note in (('stories-full', 'full', 'role of docs'), ('purge-jsdoc', 'full', 'role of JSDoc'), ('purge-docgen', 'full', 'role of docgen; purge-docgen inlines every story, so its loads are re-loads')):
    units = [r for r in runs if r['case'] in (a, b)]
    t = perm_test(units, lambda u: u['case'], lambda u: u['n_calls'] > 0, lambda u: u['workflow_id'], rng)
    # mean calls per run, permutation on the difference of means, stratified by workflow
    def diff(labels):
        xa = [u['n_calls'] for u, l in zip(units, labels) if l == a]; xb = [u['n_calls'] for u, l in zip(units, labels) if l == b]
        return sum(xa) / len(xa) - sum(xb) / len(xb)
    labels = [u['case'] for u in units]; obs = diff(labels)
    idx = collections.defaultdict(list)
    for k, u in enumerate(units):
        idx[u['workflow_id']].append(k)
    ge = 0
    for _ in range(N_PERM):
        perm = labels[:]
        for ks in idx.values():
            vals = [labels[k] for k in ks]; rng.shuffle(vals)
            for k, v in zip(ks, vals):
                perm[k] = v
        ge += abs(diff(perm)) >= abs(obs) - 1e-12
    t.update({'target': '%s vs %s' % (a, b), 'note': note, 'mean_calls_diff': round(obs, 3), 'p_mean_calls': (ge + 1) / (N_PERM + 1)})
    pair_tests.append(t)
    print('  %s vs %s (%s): runs with a load %s  p=%.4f | mean calls/run diff %+.2f  p=%.4f' % (a, b, note, dict(zip(t['groups'], ['%d/%d' % (p, n) for p, n in zip(t['present'], t['n'])])), t['p'], obs, t['p_mean_calls']))
results['case_pairs_propensity'] = pair_tests

# B. cluster x workflow, among runs that loaded a story, shuffling workflow within case
results['family_x_workflow'] = block('B1. Family x workflow', loaders, lambda u: u['workflow_id'], lambda u: u['case'], lambda u: u['families'], rng, 'runs with >=1 load; workflow shuffled within case')
results['cluster_x_workflow'] = block('B2. Cluster x workflow', loaders, lambda u: u['workflow_id'], lambda u: u['case'], lambda u: u['clusters'], rng, 'runs with >=1 load; workflow shuffled within case')
results['family_x_workflow_stated'] = block('B3. Family x workflow, stated or partial evidence only', [r for r in loaders if r['families_stated']], lambda u: u['workflow_id'], lambda u: u['case'], lambda u: u['families_stated'], rng, 'sensitivity check')

# C. cluster x case among the three cases that serve the same stories behind a name-only list
u3 = [r for r in runs if r['case'] in CASES3]
results['family_x_case_all_runs'] = block('C1. Family x case (stories-full, full, purge-jsdoc), all 150 runs', u3, lambda u: u['case'], lambda u: u['workflow_id'], lambda u: u['families'], rng, 'case shuffled within workflow')
results['cluster_x_case_all_runs'] = block('C2. Cluster x case, all 150 runs', u3, lambda u: u['case'], lambda u: u['workflow_id'], lambda u: u['clusters'], rng, 'case shuffled within workflow')
l3 = [r for r in u3 if r['n_calls']]
results['family_x_case_loaders'] = block('C3. Family x case, only runs with >=1 load', l3, lambda u: u['case'], lambda u: u['workflow_id'], lambda u: u['families'], rng, 'mix of reasons given that the run loaded something')
for a, b in (('stories-full', 'full'), ('purge-jsdoc', 'full'), ('purge-docgen', 'full')):
    units = [r for r in runs if r['case'] in (a, b)]
    results['family_%s_vs_%s' % (a, b)] = block('C4. Family, %s vs %s, all 100 runs' % (a, b), units, lambda u: u['case'], lambda u: u['workflow_id'], lambda u: u['families'], rng, 'case shuffled within workflow')

# D. reason cluster vs deterministic story kind (call level, descriptive)
kinds = sorted({c['story_kind'] for c in calls}); fams = sorted({c['cluster_family'] for c in calls})
tab = [[sum(1 for c in calls if c['cluster_family'] == f and c['story_kind'] == k) for k in kinds] for f in fams]
purity = sum(max(col) for col in zip(*tab)) / len(calls)
print('\n## D. Family x story kind (calls)   Cramers V=%.2f   share of calls whose family is the modal family of their story kind=%.1f%%' % (cramers_v(tab), 100 * purity))
print('%-24s' % '' + ' '.join('%9s' % k[:9] for k in kinds))
for f, row in zip(fams, tab):
    print('%-24s' % f + ' '.join('%9d' % v for v in row))
ctab = collections.defaultdict(collections.Counter)
for c in calls:
    ctab[c['story_kind']][c['cluster']] += 1
results['family_x_kind'] = {'kinds': kinds, 'families': fams, 'table': tab, 'cramers_v': round(cramers_v(tab), 3), 'kind_predicts_family': round(purity, 3),
                            'cluster_by_kind': {k: dict(v) for k, v in ctab.items()}}

# E. what the agent did with the story, per cluster (descriptive)
print('\n## E. Outcome by cluster (calls)')
outcomes = ['adopted', 'confirmed', 'answered_negative', 'no_new_info', 'unclear']
oc = collections.defaultdict(collections.Counter)
for c in calls:
    oc[c['cluster']][c['outcome']] += 1
print('%-22s %4s  ' % ('', 'n') + ' '.join('%9s' % o[:9] for o in outcomes))
for k, v in sorted(oc.items(), key=lambda kv: -sum(kv[1].values())):
    print('%-22s %4d  ' % (k, sum(v.values())) + ' '.join('%9d' % v[o] for o in outcomes))
results['outcome_by_cluster'] = {k: dict(v) for k, v in oc.items()}
results['params'] = {'n_perm': N_PERM, 'seed': SEED, 'min_runs_per_test': MIN_RUNS, 'fdr': 0.05}
json.dump(results, open(os.path.join(OUT, 'stats.json'), 'w'), indent=1)
