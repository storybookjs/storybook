"""Extract every get-documentation-for-story call from the current-generation runs.

Reads current-runs.json (650 runs: pin droppy-70pc, provider anthropic, no harness error) and writes:
  story-loads.jsonl   one record per call, with everything needed to regroup for statistics
  exposures.jsonl     one record per run: which stories were inlined, named, manually loaded
  universe.json       per arm: every story id seen in any MCP output of that arm
  packets/*.json      arm-blind context packets for the rationale annotators
"""
import collections, hashlib, json, os, re, sys

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNS = json.load(open(os.path.join(OUT, 'current-runs.json')))
N_BATCHES = int(sys.argv[1]) if len(sys.argv) > 1 else 8


def clip(s, n):
    s = (s or '').strip()
    return s if len(s) <= n else s[:n] + ' …[+%d chars]' % (len(s) - n)


def result_text(block):
    c = block.get('content')
    if isinstance(c, list):
        return '\n'.join(x.get('text', '') for x in c if isinstance(x, dict))
    return str(c or '')


def kebab(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def parse_docs(text):
    """Component docs output -> (component name, inline [(name,id)], other [(name,id)], props excerpt)."""
    title = re.match(r'# (.+)', text)
    stories = re.search(r'^## Stories\n([\s\S]*?)(?=^## (?:Props|Docs)\b|\Z)', text, flags=re.M)
    body = stories.group(1) if stories else ''
    other_m = re.search(r'^### Other Stories\n([\s\S]*)', body, flags=re.M)
    # Items read "- Name (story-id)" or "- Name (story-id): one-line description".
    other3 = re.findall(r'^- (.+?) \(([a-z0-9-]+--[a-z0-9-]+)\)(?::[ \t]*(.*))?$', other_m.group(1), flags=re.M) if other_m else []
    other = [(n, sid) for n, sid, _ in other3]
    parse_docs.descriptions = {sid: d.strip() for _, sid, d in other3 if d and d.strip()}
    inline_body = body[:other_m.start()] if other_m else body
    inline = re.findall(r'^### (.+)\n\nStory ID: (\S+)', inline_body, flags=re.M)
    props = re.search(r'^## Props\n([\s\S]*?)(?=^## Docs\b|\Z)', text, flags=re.M)
    return (title.group(1).strip() if title else None, inline, other, clip(props.group(1), 500) if props else '')


def parse_listing(text):
    """list-all-documentation withStoryIds output -> [(name, story id)]."""
    return re.findall(r'^\s+- (.+?) \(([a-z0-9-]+--[a-z0-9-]+)\)\s*$', text, flags=re.M)


def load_events(path):
    """Flatten a raw Claude Code transcript into ordered events with tool results attached."""
    events, by_id, think_pending = [], {}, False
    for line in open(path):
        try:
            o = json.loads(line)
        except Exception:
            continue
        m = o.get('message')
        if o.get('isSidechain') or not isinstance(m, dict) or not isinstance(m.get('content'), list):
            continue
        for b in m['content']:
            if not isinstance(b, dict):
                continue
            t = b.get('type')
            if t == 'thinking':
                think_pending = True
            elif t == 'text' and m.get('role') == 'assistant' and b.get('text', '').strip():
                events.append({'kind': 'say', 'text': b['text'].strip()})
            elif t == 'text' and m.get('role') == 'user' and not events:
                events.append({'kind': 'prompt', 'text': b['text'].strip()})
            elif t == 'tool_use':
                e = {'kind': 'tool', 'name': b['name'], 'short': b['name'].split('__')[-1], 'input': b.get('input') or {},
                     'result': None, 'error': False, 'thinking_before': think_pending}
                think_pending = False
                by_id[b['id']] = e
                events.append(e)
            elif t == 'tool_result':
                e = by_id.get(b.get('tool_use_id'))
                if e is not None:
                    e['result'] = result_text(b)
                    e['error'] = bool(b.get('is_error'))
        if isinstance(m.get('content'), str) and m.get('role') == 'user' and not events:
            events.append({'kind': 'prompt', 'text': m['content'].strip()})
    return events


def first_prompt(path):
    for line in open(path):
        try:
            o = json.loads(line)
        except Exception:
            continue
        m = o.get('message')
        if isinstance(m, dict) and m.get('role') == 'user':
            c = m.get('content')
            if isinstance(c, str):
                return c.strip()
            if isinstance(c, list):
                for b in c:
                    if isinstance(b, dict) and b.get('type') == 'text':
                        return b['text'].strip()
    return ''


def is_edit(e):
    if e['kind'] != 'tool':
        return False
    if e['short'] in ('Edit', 'Write'):
        return True
    cmd = e['input'].get('command', '') if e['short'] == 'Bash' else ''
    return bool(re.search(r"cat\s*>+\s*\S+\s*<<|\bsed\s+-i\b|\btee\s+\S|python3?\s+-\s*<<|node\s+-e\b.*writeFile", cmd))


def render(e, target=False, docs_cache=None):
    """One compact line (or short block) per event, for the annotator packet."""
    if e['kind'] in ('say', 'prompt'):
        return 'AGENT SAYS: ' + clip(e['text'], 600)
    s, i, r = e['short'], e['input'], e['result'] or ''
    if s == 'get-documentation-for-story':
        head = '%sLOAD STORY %s / "%s"' % ('>>> TARGET CALL: ' if target else '', i.get('componentId'), i.get('storyName'))
        return head + '\n   -> ' + clip(r, 1600 if target else 500)
    if s == 'get-documentation':
        name, inline, other, props = parse_docs(r)
        if not inline and not other:
            return 'GET DOCS %s\n   -> %s' % (i.get('id'), clip(r, 400))
        desc = parse_docs.descriptions
        listed = ['%s — %s' % (n, clip(desc[sid], 110)) if sid in desc else n for n, sid in other]
        return ('GET DOCS %s\n   -> %d chars. Stories shown in full: %s. Stories listed without their source: %s. Props: %s'
                % (i.get('id'), len(r), [n for n, _ in inline] or 'none', listed or 'none', clip(props, 350) or 'none documented'))
    if s == 'list-all-documentation':
        return 'LIST ALL DOCS %s\n   -> %d chars: %s' % (json.dumps(i) if i else '', len(r), clip(r, 300))
    if s == 'Bash':
        return 'RUN: %s\n   -> %s' % (clip(i.get('command', ''), 320), clip(r, 260))
    if s in ('Edit', 'Write'):
        body = i.get('new_string') or i.get('content') or ''
        return '%s %s: %s' % (s.upper(), i.get('file_path', ''), clip(body, 420))
    if s == 'Read':
        return 'READ %s\n   -> %s' % (i.get('file_path', ''), clip(r, 200))
    return '%s %s' % (s, clip(json.dumps(i), 160))


records, exposures, packets = [], [], []
universe = collections.defaultdict(dict)   # arm -> story id -> name
prompts = {}

for run in sorted(RUNS, key=lambda r: r['runDir']):
    arm = run['experiment'].replace('agentic-ref-cc-', '').replace('-opus-high', '')
    wf = run['evalName'][:3]
    raw = os.path.join(run['runDir'], 'transcript-raw.jsonl')
    if not os.path.exists(raw):
        continue
    run_key = 'r' + hashlib.sha1(run['runDir'].encode()).hexdigest()[:7]
    events = load_events(raw)
    prompts.setdefault(wf, first_prompt(raw))
    try:
        status = json.load(open(os.path.join(run['runDir'], 'result.json'))).get('status')
    except Exception:
        status = None

    inlined, named, manual, comp_names, fetched, described = {}, {}, [], {}, [], {}
    name_to_id = collections.defaultdict(dict)       # componentId -> story name -> story id
    tool_idx = [k for k, e in enumerate(events) if e['kind'] == 'tool']
    first_edit = next((k for k, e in enumerate(events) if is_edit(e)), None)
    story_calls = [k for k, e in enumerate(events) if e['kind'] == 'tool' and e['short'] == 'get-documentation-for-story']

    def exposure_at(k, comp, sname):
        sid = name_to_id[comp].get(sname) or '%s--%s' % (comp, kebab(sname))
        if sid in inlined and inlined[sid] < k:
            return sid, 'inlined'
        if sid in named and named[sid][0] < k:
            return sid, named[sid][1]
        return sid, 'unseen'

    for k, e in enumerate(events):
        if e['kind'] != 'tool':
            continue
        r = e['result'] or ''
        if e['short'] == 'get-documentation' and not e['error']:
            cname, inline, other, _ = parse_docs(r)
            cid = e['input'].get('id', '')
            if inline or other:
                fetched.append(cid)
                comp_names[cid] = cname
            for n, sid in inline:
                inlined.setdefault(sid, k); name_to_id[sid.split('--')[0]][n] = sid; universe[arm][sid] = n
            for n, sid in other:
                named.setdefault(sid, (k, 'named_in_docs')); name_to_id[sid.split('--')[0]][n] = sid; universe[arm][sid] = n
                if sid in parse_docs.descriptions:
                    described[sid] = parse_docs.descriptions[sid]
        elif e['short'] == 'list-all-documentation' and not e['error']:
            for n, sid in parse_listing(r):
                named.setdefault(sid, (k, 'named_in_listing')); name_to_id[sid.split('--')[0]][n] = sid; universe[arm][sid] = n
        elif e['short'] == 'get-documentation-for-story':
            comp, sname = e['input'].get('componentId', ''), e['input'].get('storyName', '')
            sid, exposure = exposure_at(k, comp, sname)
            found = not (e['error'] or re.match(r'\s*Story ".*" not found', r))
            if found:
                manual.append(sid); universe[arm].setdefault(sid, sname)
            # narration: assistant text since the previous tool result, else nearest earlier text
            stated, j = None, k - 1
            while j >= 0 and events[j]['kind'] != 'tool':
                if events[j]['kind'] == 'say':
                    stated = events[j]['text']; break
                j -= 1
            if stated is None:   # parallel batch: text may sit before sibling tool calls issued together
                j = k - 1
                while j >= 0 and events[j]['kind'] == 'tool' and events[j]['short'].startswith('get-documentation'):
                    j -= 1
                if j >= 0 and events[j]['kind'] == 'say' and (k - j) <= 4:
                    stated = events[j]['text']
            cexport = comp_names.get(comp) or comp.split('-')[-1]
            later_edit = next((x for x in events[k + 1:] if x['kind'] == 'tool' and x['short'] in ('Edit', 'Write')
                               and re.search(r'\b%s\b' % re.escape(cexport), (x['input'].get('new_string') or x['input'].get('content') or ''), re.I)), None)
            call_id = 'c%03d' % (len(records) + 1)
            ordinal = story_calls.index(k) + 1
            rec = {
                'call_id': call_id, 'arm': arm, 'workflow': run['evalName'], 'workflow_id': wf,
                'run_key': run_key, 'run_dir': os.path.relpath(run['runDir'], os.path.join(OUT, '..', '..')),
                'result_ts': run['ts'], 'run': run['run'], 'run_status': status,
                'component_id': comp, 'component': cexport, 'story_name': sname, 'story_id': sid,
                'story_found': found, 'exposure_before': exposure, 'listing_description': described.get(sid),
                'call_ordinal_in_run': ordinal, 'story_calls_in_run': len(story_calls),
                'tool_call_index': tool_idx.index(k) + 1, 'tool_calls_in_run': len(tool_idx),
                'run_position': round((tool_idx.index(k) + 1) / len(tool_idx), 3),
                'phase': 'before_first_edit' if first_edit is None or k < first_edit else 'after_first_edit',
                'thinking_block_before': e['thinking_before'], 'stated_narration': stated,
                'result_chars': len(r), 'result': r,
            }
            records.append(rec)
            lo = k
            steps = 0
            while lo > 0 and steps < 9:
                lo -= 1
                steps += events[lo]['kind'] == 'tool'
            hi, steps = k, 0
            while hi < len(events) - 1 and steps < 7:
                hi += 1
                steps += events[hi]['kind'] == 'tool'
            packets.append({
                'call_id': call_id, 'workflow_id': wf, 'run_key': run_key,
                'call_ordinal_in_run': ordinal, 'story_calls_in_run': len(story_calls),
                'progress': 'tool call %d of %d in the run; %s' % (tool_idx.index(k) + 1, len(tool_idx), rec['phase'].replace('_', ' ')),
                'component_id': comp, 'story_name': sname,
                'exposure_before': {'inlined': 'the full source of this story had ALREADY been shown to the agent in an earlier docs output',
                                    'named_in_docs': 'the agent had only seen this story listed (name, sometimes a one-line description) in the component docs, without its source',
                                    'named_in_listing': 'the agent had only seen this story NAME, in the global list-all listing',
                                    'unseen': 'this story name had NOT appeared in any earlier output: the agent guessed it'}[exposure],
                'other_story_calls_in_run': [(events[x]['input'].get('componentId'), events[x]['input'].get('storyName')) for x in story_calls if x != k],
                'before': [render(x) for x in events[lo:k]],
                'target': render(e, target=True),
                'after': [render(x) for x in events[k + 1:hi + 1]],
                'first_later_edit_mentioning_component': render(later_edit) if later_edit else None,
            })
    exposures.append({'arm': arm, 'workflow_id': wf, 'run_key': run_key, 'components_fetched': fetched,
                      'inlined': sorted(inlined), 'named': sorted(named), 'manual': manual, 'n_tool_calls': len(tool_idx)})

with open(os.path.join(OUT, 'story-loads.jsonl'), 'w') as f:
    for r in records:
        f.write(json.dumps(r) + '\n')
with open(os.path.join(OUT, 'exposures.jsonl'), 'w') as f:
    for r in exposures:
        f.write(json.dumps(r) + '\n')
json.dump({a: dict(sorted(s.items())) for a, s in sorted(universe.items())}, open(os.path.join(OUT, 'universe.json'), 'w'), indent=1)
json.dump(prompts, open(os.path.join(OUT, 'workflow-prompts.json'), 'w'), indent=1)

# Arm-blind batches: whole runs stay together, batches balanced by call count.
by_run = collections.defaultdict(list)
for p in packets:
    by_run[p['run_key']].append(p)
batches = [[] for _ in range(N_BATCHES)]
for key in sorted(by_run, key=lambda k: hashlib.sha1(('shuffle' + k).encode()).hexdigest()):
    min(batches, key=len).extend(by_run[key])
for n, b in enumerate(batches, 1):
    json.dump({'workflow_prompts': {w: prompts[w] for w in sorted({p['workflow_id'] for p in b})}, 'calls': b},
              open(os.path.join(OUT, 'packets', 'batch-%02d.json' % n), 'w'), indent=1)

c = collections.Counter
print('runs', len(exposures), 'calls', len(records), 'runs with calls', len(by_run))
print('exposure_before', c(r['exposure_before'] for r in records).most_common())
print('found', c(r['story_found'] for r in records), 'stated narration', sum(1 for r in records if r['stated_narration']),
      'thinking before', sum(r['thinking_block_before'] for r in records))
print('phase', c(r['phase'] for r in records).most_common())
print('by arm', sorted(c(r['arm'] for r in records).items()))
print('by workflow', sorted(c(r['workflow_id'] for r in records).items()))
print('batch sizes', [len(b) for b in batches], 'batch bytes', [os.path.getsize(os.path.join(OUT, 'packets', 'batch-%02d.json' % n)) for n in range(1, N_BATCHES + 1)])
