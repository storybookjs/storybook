// Replay pilot: ask the original model why it loaded a story, with its stored reasoning in context.
//
// For each selected call, the transcript is replayed to claude-opus-5 up to and including the story
// load's tool result, with every thinking block passed back unchanged (their text is empty; the
// signature carries the encrypted reasoning, which the API decrypts for the model). One short
// question is then appended. Nothing is executed: tools are stubs and tool_choice is "none".
//
//   node --env-file-if-exists=agent-eval/.env.local scripts/replay_probe.ts --dry
//   node --env-file-if-exists=agent-eval/.env.local scripts/replay_probe.ts
//   node --env-file-if-exists=agent-eval/.env.local scripts/replay_probe.ts --without-reasoning c208,c022,c109
//
// --without-reasoning repeats the named calls with the stored reasoning cleared server-side
// (clear_thinking_20251015). The response reports how many tokens were cleared, which is the
// measurement of how much reasoning the first variant carried.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Anthropic from '@anthropic-ai/sdk';

// The model that produced the thinking blocks. A newer model would answer for someone else.
const MODEL = 'claude-opus-5';
const USD_PER_MTOK = { input: 5, output: 25 };
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(OUT, '..', '..', '..');
const RESULTS = join(OUT, 'replay', 'results.jsonl');

const SYSTEM =
  'This is a replay of an earlier coding session of yours, loaded for a research review. ' +
  'The task is paused: do not continue it and do not call tools.';

function probe(component: string, story: string): string {
  return (
    `Pause here. Looking back at the step you just took: you loaded the "${story}" story of ${component}. ` +
    'In two or three sentences, say what you needed to find out at that point and what made that story the one to load. ' +
    'Then, in one more sentence, say whether it answered the question.'
  );
}

type Block = Record<string, unknown>;
interface ApiMessage {
  role: 'user' | 'assistant';
  content: Block[];
  id?: string;
}

/** Tool results as plain text or images; anything else (tool references) becomes a placeholder. */
function cleanResultContent(content: unknown): unknown {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content) || content.length === 0) return '[empty tool output]';
  return content.map((part: Block) => {
    if (part.type === 'text') return { type: 'text', text: String(part.text ?? '') || '[empty]' };
    if (part.type === 'image') return { type: 'image', source: part.source };
    return { type: 'text', text: '[non-text tool output omitted in replay]' };
  });
}

/** Keep only the fields the Messages API defines; thinking blocks pass through byte-for-byte. */
function cleanBlock(block: Block): Block | null {
  switch (block.type) {
    case 'thinking':
      return { type: 'thinking', thinking: block.thinking, signature: block.signature };
    case 'redacted_thinking':
      return { type: 'redacted_thinking', data: block.data };
    case 'text':
      return String(block.text ?? '').trim() ? { type: 'text', text: block.text } : null;
    case 'tool_use':
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input ?? {} };
    case 'tool_result':
      return {
        type: 'tool_result',
        tool_use_id: block.tool_use_id,
        content: cleanResultContent(block.content),
        ...(block.is_error ? { is_error: true } : {}),
      };
    default:
      return null;
  }
}

interface Built {
  messages: ApiMessage[];
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
  thinkingBlocks: number;
  targetToolUseId: string;
}

/** Rebuild the API conversation from a Claude Code session file, cut right after the Nth story load. */
function buildRequest(runDir: string, ordinal: number, component: string, story: string): Built {
  const lines = readFileSync(join(REPO, 'agent-eval', runDir, 'transcript-raw.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, any>;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is Record<string, any> => entry !== null && !entry.isSidechain)
    .filter((entry) => entry.message && (entry.message.role === 'user' || entry.message.role === 'assistant'))
    .filter((entry) => entry.message.model !== '<synthetic>');

  // Locate the target tool_use and the assistant message it belongs to.
  let seen = 0;
  let targetId = '';
  let targetMessageId = '';
  for (const entry of lines) {
    if (entry.message.role !== 'assistant' || !Array.isArray(entry.message.content)) continue;
    for (const block of entry.message.content) {
      if (block.type === 'tool_use' && String(block.name).endsWith('get-documentation-for-story')) {
        seen += 1;
        if (seen === ordinal) {
          targetId = block.id;
          targetMessageId = entry.message.id;
        }
      }
    }
  }
  if (!targetId) throw new Error(`story load #${ordinal} not found in ${runDir}`);

  // Every tool_use of that assistant message needs its result before the cut.
  const pending = new Set<string>();
  for (const entry of lines) {
    if (entry.message.role === 'assistant' && entry.message.id === targetMessageId && Array.isArray(entry.message.content)) {
      for (const block of entry.message.content) if (block.type === 'tool_use') pending.add(block.id);
    }
  }
  let cut = -1;
  lines.forEach((entry, index) => {
    if (entry.message.role === 'user' && Array.isArray(entry.message.content)) {
      for (const block of entry.message.content) {
        if (block.type === 'tool_result' && pending.has(block.tool_use_id)) cut = index;
      }
    }
  });
  if (cut < 0) throw new Error(`no tool result for the target call in ${runDir}`);

  // Claude Code writes one line per content block; blocks sharing a message id are one API message.
  const messages: ApiMessage[] = [];
  let lastAssistant: ApiMessage | null = null;
  for (const entry of lines.slice(0, cut + 1)) {
    const { role, content, id } = entry.message;
    const blocks: Block[] = (typeof content === 'string' ? [{ type: 'text', text: content }] : content)
      .map(cleanBlock)
      .filter((block: Block | null): block is Block => block !== null);
    if (blocks.length === 0) continue;
    if (role === 'assistant') {
      if (lastAssistant && lastAssistant.id === id) {
        lastAssistant.content.push(...blocks);
      } else {
        lastAssistant = { role: 'assistant', content: blocks, id };
        messages.push(lastAssistant);
      }
    } else {
      const previous = messages[messages.length - 1];
      if (previous && previous.role === 'user') previous.content.push(...blocks);
      else messages.push({ role: 'user', content: blocks });
    }
  }

  // Tool results first, then the question, in the same user message.
  const last = messages[messages.length - 1];
  if (last.role !== 'user') throw new Error('prefix does not end with tool results');
  last.content.sort((a, b) => Number(b.type === 'tool_result') - Number(a.type === 'tool_result'));
  last.content.push({ type: 'text', text: probe(component, story) });

  // Validate what the API will check: alternation, and a result for every tool call.
  messages.forEach((message, index) => {
    if (index > 0 && message.role === messages[index - 1].role) throw new Error(`two ${message.role} messages in a row at ${index}`);
    if (message.role === 'assistant') {
      const next = messages[index + 1];
      const results = new Set((next?.content ?? []).filter((b) => b.type === 'tool_result').map((b) => b.tool_use_id));
      for (const block of message.content) {
        if (block.type === 'tool_use' && !results.has(block.id)) throw new Error(`tool call ${String(block.id)} has no result`);
      }
    }
  });
  if (messages[0].role !== 'user') throw new Error('conversation does not start with the user');

  const names = new Set<string>();
  let thinkingBlocks = 0;
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === 'tool_use') names.add(String(block.name));
      if (block.type === 'thinking' && block.signature) thinkingBlocks += 1;
    }
  }
  const tools = [...names].sort().map((name) => ({
    name,
    description: 'Stub of a tool used earlier in this session. Not callable in this replay.',
    input_schema: { type: 'object', additionalProperties: true },
  }));
  return { messages: messages.map(({ role, content }) => ({ role, content })), tools, thinkingBlocks, targetToolUseId: targetId };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const without = args.indexOf('--without-reasoning');
  return {
    dry: args.includes('--dry'),
    withoutReasoning: without >= 0 ? new Set((args[without + 1] ?? '').split(',').filter(Boolean)) : null,
  };
}

const { dry, withoutReasoning } = parseArgs();
const pilot: Array<Record<string, any>> = JSON.parse(readFileSync(join(OUT, 'replay', 'pilot-calls.json'), 'utf8'));
const done = new Set(
  existsSync(RESULTS)
    ? readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean).map((line) => {
        const row = JSON.parse(line);
        return `${row.call_id}|${row.variant}`;
      })
    : []
);
const variant = withoutReasoning ? 'reasoning-cleared' : 'reasoning-kept';
const selected = pilot.filter((call) => !withoutReasoning || withoutReasoning.has(call.call_id));

if (!dry && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  throw new Error('No API credential: add ANTHROPIC_API_KEY to agent-eval/.env.local (see .env.example) or export it, then rerun.');
}
const client = dry ? null : new Anthropic();
let spent = 0;

for (const call of selected) {
  const built = buildRequest(call.run_dir, call.call_ordinal_in_run, call.component, call.story_name);
  const estimate = (call.context_tokens * USD_PER_MTOK.input + 800 * USD_PER_MTOK.output) / 1e6;
  if (dry) {
    console.log(
      `${call.call_id} ${String(call.cluster).padEnd(20)} messages=${built.messages.length} thinking blocks=${built.thinkingBlocks} ` +
        `tools=${built.tools.length} context<=${call.context_tokens} est<=$${estimate.toFixed(2)}`
    );
    continue;
  }
  if (done.has(`${call.call_id}|${variant}`)) {
    console.log(`${call.call_id} ${variant}: already done, skipped`);
    continue;
  }
  const request = {
    model: MODEL,
    max_tokens: 3000,
    system: SYSTEM,
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: 'medium' },
    tools: built.tools,
    tool_choice: { type: 'none' },
    messages: built.messages,
  };
  // The cleared variant keeps only the turn in progress, i.e. drops every stored thinking block.
  const message: any = withoutReasoning
    ? await (client as any).beta.messages
        .stream({
          ...request,
          betas: ['context-management-2025-06-27'],
          context_management: { edits: [{ type: 'clear_thinking_20251015', keep: { type: 'thinking_turns', value: 1 } }] },
        })
        .finalMessage()
    : await (client as any).messages.stream(request).finalMessage();

  const usage = message.usage ?? {};
  const inputTokens = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  const cost = (inputTokens * USD_PER_MTOK.input + (usage.output_tokens ?? 0) * USD_PER_MTOK.output) / 1e6;
  spent += cost;
  const row = {
    call_id: call.call_id,
    variant,
    cluster: call.cluster,
    evidence: call.evidence,
    component: call.component,
    story_name: call.story_name,
    stop_reason: message.stop_reason,
    // A refusal is an HTTP 200 with a stop reason, not an exception.
    refusal_category: message.stop_reason === 'refusal' ? (message.stop_details?.category ?? null) : null,
    answer: (message.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim(),
    new_thinking_summary: (message.content ?? []).filter((b: any) => b.type === 'thinking').map((b: any) => b.thinking).join('\n').trim(),
    stored_thinking_blocks_sent: built.thinkingBlocks,
    input_tokens: inputTokens,
    output_tokens: usage.output_tokens ?? 0,
    context_edits: message.context_management?.applied_edits ?? null,
    cost_usd: Number(cost.toFixed(4)),
  };
  appendFileSync(RESULTS, `${JSON.stringify(row)}\n`);
  console.log(`${call.call_id} ${variant}: ${row.stop_reason} in=${inputTokens} out=${row.output_tokens} $${cost.toFixed(3)}`);
}
if (!dry) console.log(`spent $${spent.toFixed(2)}`);
