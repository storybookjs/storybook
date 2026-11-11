"""Render this Claude Code session as a readable, shareable text file.

Keeps every message the user typed and every reply in full, plus each tool call and a capped view of
its output. Drops harness-injected context (system reminders, skill instruction bodies, nudges) and
hidden reasoning. Redacts email addresses and anything shaped like an API key.
"""
import json, re, sys

SRC, DEST = sys.argv[1], sys.argv[2]
INPUT_CAP, RESULT_CAP = 3000, 1500
QUIET_TOOLS = ('update_plan', 'wrap_up', 'mark_chapter')

def clean(text):
    text = re.sub(r'<system-reminder[^>]*>[\s\S]*?</system-reminder[^>]*>', '', text or '')
    text = re.sub(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}\b', '[email redacted]', text)
    text = re.sub(r'sk-ant-[A-Za-z0-9_-]{8,}', '[key redacted]', text)
    return text.strip()

def cap(text, limit):
    text = clean(text)
    return text if len(text) <= limit else text[:limit].rstrip() + '\n[... %d more characters not shown]' % (len(text) - limit)

def indent(text, pad='    '):
    return '\n'.join(pad + line if line else '' for line in text.split('\n'))

def result_text(block):
    c = block.get('content')
    if isinstance(c, str):
        return c
    parts = []
    for part in c or []:
        if isinstance(part, dict):
            parts.append(part.get('text', '') if part.get('type') == 'text' else '[%s]' % part.get('type'))
    return '\n'.join(parts)

def describe_call(name, i):
    short = name.split('__')[-1]
    if short == 'Bash':
        return 'Bash: %s\n%s' % (i.get('description', ''), indent(cap(i.get('command', ''), INPUT_CAP)))
    if short == 'Read':
        return 'Read: %s' % i.get('file_path', '')
    if short == 'Write':
        return 'Write: %s\n%s' % (i.get('file_path', ''), indent(cap(i.get('content', ''), INPUT_CAP)))
    if short == 'Edit':
        return 'Edit: %s\n%s\n    -->\n%s' % (i.get('file_path', ''), indent(cap(i.get('old_string', ''), INPUT_CAP // 2)), indent(cap(i.get('new_string', ''), INPUT_CAP // 2)))
    if short == 'Agent':
        return 'Agent (%s%s): %s\n%s' % (i.get('subagent_type', 'general-purpose'), ', model ' + i['model'] if i.get('model') else '', i.get('description', ''), indent(cap(i.get('prompt', ''), INPUT_CAP)))
    if short == 'Skill':
        return 'Skill: %s' % i.get('skill', '')
    if short == 'update_plan':
        if i.get('items'):
            return 'Plan:\n' + indent('\n'.join('[%s] %s' % ({'completed': 'x', 'in_progress': '>'}.get(it.get('status'), ' '), it.get('content', '')) for it in i['items']))
        return None
    if short == 'wrap_up':
        return 'Status recap: %s%s' % (i.get('recap', ''), '\n    Question to user: ' + i['ask'] if i.get('ask') else '')
    return '%s: %s' % (short, cap(json.dumps(i, ensure_ascii=False), 700))

def strings_in(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from strings_in(v)
    elif isinstance(value, list):
        for v in value:
            yield from strings_in(v)

out, names, counts = [], {}, {'user': 0, 'assistant': 0, 'tool': 0, 'subagent': 0}
RULE = '=' * 78

def emit(header, body, stamp=''):
    out.append('\n%s\n%s%s\n%s\n%s' % (RULE, header, ('   ' + stamp) if stamp else '', RULE, body))

for line in open(SRC):
    try:
        o = json.loads(line)
    except Exception:
        continue
    kind, m = o.get('type'), o.get('message')
    if kind == 'attachment':
        # Subagent reports that arrived while a step was running are stored as attachments.
        for text in strings_in(o.get('attachment')):
            for report in re.findall(r'<agent-message[^>]*>([\s\S]*?)</agent-message>', text):
                body = re.sub(r'^[\s\S]*?The report follows:\s*', '', report)
                emit('SUBAGENT REPORT', clean('\n'.join(l[2:] if l.startswith('  ') else l for l in body.split('\n'))), (o.get('timestamp') or '')[:16].replace('T', ' '))
                counts['subagent'] += 1
        continue
    if kind not in ('user', 'assistant') or not isinstance(m, dict):
        continue
    stamp = (o.get('timestamp') or '')[:16].replace('T', ' ')
    content = m.get('content')
    blocks = [{'type': 'text', 'text': content}] if isinstance(content, str) else [b for b in content or [] if isinstance(b, dict)]
    origin = (o.get('origin') or {}).get('kind')
    for b in blocks:
        t = b.get('type')
        if kind == 'assistant':
            if t == 'text' and clean(b.get('text')):
                emit('CLAUDE', clean(b['text']), stamp); counts['assistant'] += 1
            elif t == 'tool_use':
                names[b['id']] = b['name'].split('__')[-1]
                desc = describe_call(b['name'], b.get('input') or {})
                if desc:
                    out.append('\n  [tool] ' + desc.replace('\n', '\n  ')); counts['tool'] += 1
        elif t == 'tool_result':
            name = names.get(b.get('tool_use_id'), '')
            if name in QUIET_TOOLS or name == 'Skill':
                continue
            text = cap(result_text(b), RESULT_CAP)
            if text:
                out.append('  [%s] %s' % ('error' if b.get('is_error') else 'result', text.replace('\n', '\n      ')))
        elif t == 'text':
            text = b.get('text') or ''
            if origin == 'human':
                if clean(text):
                    emit('USER', clean(text), stamp); counts['user'] += 1
            elif origin == 'peer' or '<agent-message' in text:
                report = re.search(r'<agent-message[^>]*>([\s\S]*?)</agent-message>', text)
                body = report.group(1) if report else text
                body = re.sub(r'^[\s\S]*?The report follows:\s*', '', body)
                emit('SUBAGENT REPORT', clean('\n'.join(l[2:] if l.startswith('  ') else l for l in body.split('\n'))), stamp); counts['subagent'] += 1
            elif origin == 'task-notification' or '<task-notification>' in text:
                s = re.search(r'<summary>([\s\S]*?)</summary>', text)
                out.append('\n  [background task] %s' % clean(s.group(1) if s else 'finished'))
            elif text.startswith('Base directory for this skill:'):
                out.append('\n  [skill instructions loaded; body omitted]')

header = """TRANSCRIPT: Agent-eval story tool calls analysis
Claude Code session, 2026-11-11. Times are UTC.

What is in this file
  - Every message the user typed and every reply from Claude, in full.
  - Every tool call, with its input capped at %d characters and its output capped at %d.
  - The final report of each subagent.
What is left out
  - Harness-injected context (system reminders, skill instruction bodies, progress nudges).
  - The model's hidden reasoning, and the subagents' own working transcripts.
  - Email addresses and anything shaped like an API key are redacted.
The analysis outputs referred to throughout are in agent-eval/comparisons/story-load-reasons/.

%d user messages, %d replies, %d tool calls, %d subagent reports.
""" % (INPUT_CAP, RESULT_CAP, counts['user'], counts['assistant'], counts['tool'], counts['subagent'])
open(DEST, 'w').write(header + '\n'.join(out) + '\n')
print(counts)
