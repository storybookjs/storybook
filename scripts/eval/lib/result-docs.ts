import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const TRANSCRIPT_TEMPLATE_URL = new URL('./result-doc-templates/transcript.tsx', import.meta.url);
const TRANSCRIPT_TYPES_TEMPLATE_URL = new URL(
  './result-doc-templates/transcript.types.ts',
  import.meta.url
);

export interface TranscriptTextContent {
  type: 'text';
  text: string;
}

export interface TranscriptToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
  isMCP: boolean;
}

export interface TranscriptToolResultBlock {
  type: string;
  text?: string;
  isError?: boolean;
}

export interface TranscriptToolResultContent {
  tool_use_id: string;
  type: 'tool_result';
  content: string | TranscriptToolResultBlock[];
}

export interface TranscriptMessageUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface TranscriptAssistantMessage {
  type: 'assistant';
  message: {
    content: Array<TranscriptTextContent | TranscriptToolUseContent>;
    usage: TranscriptMessageUsage;
  };
  ms: number;
  tokenCount?: number;
  costUSD?: number;
}

export interface TranscriptUserMessage {
  type: 'user';
  message: {
    content: TranscriptToolResultContent[];
  };
  ms: number;
  tokenCount?: number;
  costUSD?: number;
}

export interface TranscriptSystemMessage {
  type: 'system';
  subtype: 'init';
  agent: string;
  model: string;
  tools: string[];
  mcp_servers: Array<{
    name: string;
    status: 'connected' | 'disconnected' | 'unknown';
  }>;
  cwd: string;
  ms: number;
  tokenCount?: number;
  costUSD?: number;
}

export interface TranscriptResultMessage {
  type: 'result';
  subtype: 'success' | 'error';
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  total_cost_usd: number;
  ms: number;
  tokenCount?: number;
  costUSD?: number;
}

export type TranscriptMessage =
  | TranscriptAssistantMessage
  | TranscriptUserMessage
  | TranscriptSystemMessage
  | TranscriptResultMessage;

export interface TranscriptDocData {
  prompt: string;
  promptTokenCount: number;
  promptCost: number;
  messages: TranscriptMessage[];
}

interface EvalSummaryLike {
  variant?: {
    agent?: string;
    model?: string;
  };
  execution?: {
    cost?: number;
    duration?: number;
    durationApi?: number;
    turns?: number;
  };
}

export async function writeEvalResultDocs(resultsDir: string) {
  const [prompt, transcript, summary, transcriptTemplate, transcriptTypesTemplate] =
    await Promise.all([
      readOptionalText(join(resultsDir, 'prompt.md')),
      readOptionalJson(join(resultsDir, 'transcript.json')),
      readOptionalJson(join(resultsDir, 'summary.json')),
      readFile(TRANSCRIPT_TEMPLATE_URL, 'utf-8'),
      readFile(TRANSCRIPT_TYPES_TEMPLATE_URL, 'utf-8'),
    ]);

  const transcriptData = normalizeTranscriptForDocs({
    prompt: prompt ?? '',
    transcript: Array.isArray(transcript) ? transcript : [],
    summary,
  });

  await Promise.all([
    writeFile(join(resultsDir, 'summary.mdx'), createSummaryMdx()),
    writeFile(join(resultsDir, 'transcript.tsx'), transcriptTemplate),
    writeFile(join(resultsDir, 'transcript.types.ts'), transcriptTypesTemplate),
    writeFile(join(resultsDir, 'transcript-data.json'), JSON.stringify(transcriptData, null, 2)),
    writeFile(join(resultsDir, 'transcript.mdx'), createTranscriptMdx()),
    summary
      ? writeFile(join(resultsDir, 'summary.pretty.json'), JSON.stringify(summary, null, 2))
      : Promise.resolve(),
  ]);
}

export function normalizeTranscriptForDocs(opts: {
  prompt: string;
  transcript: unknown[];
  summary?: unknown;
}): TranscriptDocData {
  const summary = isEvalSummaryLike(opts.summary) ? opts.summary : undefined;
  const messages = opts.transcript.flatMap((entry, index) =>
    normalizeTranscriptEntry(entry, index, summary)
  );

  ensureSystemMessage(messages, summary);
  ensureResultMessage(messages, summary);

  return {
    prompt: opts.prompt,
    promptTokenCount: estimateTokenCount(opts.prompt),
    promptCost: 0,
    messages,
  };
}

function normalizeTranscriptEntry(
  entry: unknown,
  index: number,
  summary?: EvalSummaryLike
): TranscriptMessage[] {
  if (!entry || typeof entry !== 'object') {
    return [];
  }

  if (looksLikeClaudeSystem(entry)) {
    return [normalizeClaudeSystem(entry)];
  }

  if (looksLikeClaudeAssistant(entry)) {
    return [normalizeClaudeAssistant(entry)];
  }

  if (looksLikeClaudeUser(entry, index)) {
    return [normalizeClaudeUser(entry, index)];
  }

  if (looksLikeClaudeResult(entry)) {
    return [normalizeClaudeResult(entry, summary)];
  }

  if (looksLikeClaudeStatus(entry)) {
    return [createAssistantTextMessage(`Status: ${entry.status ?? 'unknown'}`, entry.ms)];
  }

  if (looksLikeClaudeApiRetry(entry)) {
    return [
      createAssistantTextMessage(
        `API retry: attempt ${entry.attempt ?? '?'} / ${entry.max_retries ?? '?'}`,
        entry.ms
      ),
    ];
  }

  if (looksLikeClaudeToolUseSummary(entry)) {
    return [createAssistantTextMessage(entry.summary, entry.ms)];
  }

  if (looksLikeClaudeRateLimitEvent(entry)) {
    const info = entry.rate_limit_info ?? {};
    return [
      createAssistantTextMessage(
        `Rate limited — status: ${info.status ?? 'unknown'}, resets at: ${info.resetsAt ?? 'unknown'}`,
        entry.ms
      ),
    ];
  }

  if (looksLikeCodexAgentMessage(entry)) {
    return [createAssistantTextMessage(entry.text)];
  }

  if (looksLikeCodexReasoning(entry)) {
    return [createAssistantTextMessage(`Reasoning\n\n${entry.text}`)];
  }

  if (looksLikeCodexCommand(entry)) {
    return normalizeCodexCommand(entry, index);
  }

  if (looksLikeCodexFileChange(entry)) {
    const summaryText = [
      'File changes:',
      ...entry.changes.map((change) => `- ${change.kind} ${change.path}`),
    ].join('\n');
    return [createAssistantTextMessage(summaryText)];
  }

  if (looksLikeCodexError(entry)) {
    return [createAssistantTextMessage(`Error\n\n${entry.message}`)];
  }

  return [
    createAssistantTextMessage(
      `Raw event\n\n\`\`\`json\n${JSON.stringify(entry, null, 2)}\n\`\`\``
    ),
  ];
}

function normalizeClaudeSystem(entry: ClaudeSystemEntry): TranscriptSystemMessage {
  return {
    type: 'system',
    subtype: 'init',
    agent: entry.agent ?? 'Claude',
    model: entry.model ?? 'unknown',
    tools: entry.tools?.filter(isString) ?? [],
    mcp_servers: normalizeMcpServers(entry.mcp_servers),
    cwd: entry.cwd ?? '',
    ms: getNumber(entry.ms),
    tokenCount: getOptionalNumber(entry.tokenCount),
    costUSD: getOptionalNumber(entry.costUSD),
  };
}

function normalizeClaudeAssistant(entry: ClaudeAssistantEntry): TranscriptAssistantMessage {
  const content = entry.message.content.flatMap(
    (block): Array<TranscriptTextContent | TranscriptToolUseContent> => {
      if (block.type === 'text' && typeof block.text === 'string') {
        return [{ type: 'text', text: block.text }];
      }

      if (block.type === 'tool_use' && typeof block.name === 'string') {
        return [
          {
            type: 'tool_use',
            id: typeof block.id === 'string' ? block.id : `tool-${block.name}`,
            name: block.name,
            input: isRecord(block.input) ? block.input : {},
            isMCP: isMcpToolName(block.name),
          },
        ];
      }

      return [];
    }
  );

  const outputTokens = getNumber(entry.message.usage?.output_tokens);
  const inputTokens = getNumber(entry.message.usage?.input_tokens);
  const tokenCount =
    getOptionalNumber(entry.tokenCount) ??
    (outputTokens || estimateAssistantContentTokens(content));

  return {
    type: 'assistant',
    message: {
      content,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
    },
    ms: getNumber(entry.ms),
    tokenCount: tokenCount || undefined,
    costUSD: getOptionalNumber(entry.costUSD),
  };
}

function normalizeClaudeUser(entry: ClaudeUserEntry, index: number): TranscriptUserMessage {
  const content = entry.message.content.map((block, blockIndex) => ({
    type: 'tool_result' as const,
    tool_use_id:
      typeof block.tool_use_id === 'string'
        ? block.tool_use_id
        : `tool-result-${index}-${blockIndex}`,
    content: normalizeToolResultContent(block.content),
  }));

  const tokenCount =
    getOptionalNumber(entry.tokenCount) ??
    content.reduce((sum, block) => sum + estimateToolResultTokens(block.content), 0);

  return {
    type: 'user',
    message: { content },
    ms: getNumber(entry.ms),
    tokenCount: tokenCount || undefined,
    costUSD: getOptionalNumber(entry.costUSD),
  };
}

function normalizeClaudeResult(
  entry: ClaudeResultEntry,
  summary?: EvalSummaryLike
): TranscriptResultMessage {
  return {
    type: 'result',
    subtype: entry.subtype,
    duration_ms:
      getNumber(entry.duration_ms) || Math.round(getNumber(summary?.execution?.duration) * 1000),
    duration_api_ms:
      getNumber(entry.duration_api_ms) ||
      Math.round(getNumber(summary?.execution?.durationApi) * 1000),
    num_turns: getNumber(entry.num_turns) || getNumber(summary?.execution?.turns),
    total_cost_usd: getNumber(entry.total_cost_usd) || getNumber(summary?.execution?.cost),
    ms: getNumber(entry.ms),
    tokenCount: getOptionalNumber(entry.tokenCount),
    costUSD: getOptionalNumber(entry.costUSD),
  };
}

function normalizeCodexCommand(entry: CodexCommandEntry, index: number): TranscriptMessage[] {
  const id = `codex-command-${index}`;
  const output = buildCodexCommandOutput(entry);

  return [
    {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id,
            name: 'Bash',
            input: { command: entry.command },
            isMCP: false,
          },
        ],
        usage: {
          input_tokens: 0,
          output_tokens: estimateTokenCount(entry.command),
        },
      },
      ms: 0,
      tokenCount: estimateTokenCount(entry.command),
    },
    {
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: id,
            content: output,
          },
        ],
      },
      ms: 0,
      tokenCount: estimateToolResultTokens(output),
    },
  ];
}

function ensureSystemMessage(messages: TranscriptMessage[], summary?: EvalSummaryLike) {
  if (messages.some((message) => message.type === 'system')) {
    return;
  }

  if (!summary?.variant) {
    return;
  }

  messages.unshift({
    type: 'system',
    subtype: 'init',
    agent: formatAgentName(summary.variant.agent),
    model: summary.variant.model ?? 'unknown',
    tools: [],
    mcp_servers: [],
    cwd: '',
    ms: 0,
  });
}

function ensureResultMessage(messages: TranscriptMessage[], summary?: EvalSummaryLike) {
  if (messages.some((message) => message.type === 'result')) {
    return;
  }

  if (!summary?.execution) {
    return;
  }

  messages.push({
    type: 'result',
    subtype: 'success',
    duration_ms: Math.round(getNumber(summary.execution.duration) * 1000),
    duration_api_ms: Math.round(getNumber(summary.execution.durationApi) * 1000),
    num_turns: getNumber(summary.execution.turns),
    total_cost_usd: getNumber(summary.execution.cost),
    ms: 0,
  });
}

function normalizeToolResultContent(content: unknown): string | TranscriptToolResultBlock[] {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((item) => ({
      type: isRecord(item) && typeof item.type === 'string' ? item.type : 'text',
      text: isRecord(item) && typeof item.text === 'string' ? item.text : undefined,
      isError: isRecord(item) && item.isError === true,
    }));
  }

  return JSON.stringify(content, null, 2);
}

function normalizeMcpServers(value: unknown): TranscriptSystemMessage['mcp_servers'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((server) => {
    if (!isRecord(server) || typeof server.name !== 'string') {
      return [];
    }

    const status = server.status;
    return [
      {
        name: server.name,
        status:
          status === 'connected' || status === 'disconnected' || status === 'unknown'
            ? status
            : 'unknown',
      },
    ];
  });
}

function buildCodexCommandOutput(entry: CodexCommandEntry) {
  const lines = [];

  if (typeof entry.exit_code === 'number') {
    lines.push(`Exit code: ${entry.exit_code}`);
  }
  if (typeof entry.aggregated_output === 'string' && entry.aggregated_output.trim()) {
    lines.push(entry.aggregated_output.trim());
  }
  if (lines.length === 0) {
    lines.push(entry.command);
  }

  return lines.join('\n\n');
}

function createAssistantTextMessage(text: string, ms = 0): TranscriptAssistantMessage {
  const tokenCount = estimateTokenCount(text);

  return {
    type: 'assistant',
    message: {
      content: [{ type: 'text', text }],
      usage: {
        input_tokens: 0,
        output_tokens: tokenCount,
      },
    },
    ms,
    tokenCount,
  };
}

function estimateAssistantContentTokens(
  content: Array<TranscriptTextContent | TranscriptToolUseContent>
) {
  return content.reduce((sum, item) => {
    if (item.type === 'text') {
      return sum + estimateTokenCount(item.text);
    }

    return sum + estimateTokenCount(`${item.name}\n${JSON.stringify(item.input)}`);
  }, 0);
}

function estimateToolResultTokens(content: string | TranscriptToolResultBlock[]) {
  if (typeof content === 'string') {
    return estimateTokenCount(content);
  }

  return content.reduce(
    (sum, item) => sum + estimateTokenCount([item.type, item.text].filter(Boolean).join('\n')),
    0
  );
}

function estimateTokenCount(text: string) {
  if (!text.trim()) {
    return 0;
  }

  return Math.max(1, Math.ceil(text.length / 4));
}

function formatAgentName(agent?: string) {
  if (agent === 'claude') {
    return 'Claude';
  }
  if (agent === 'codex') {
    return 'Codex';
  }

  return agent ?? 'Agent';
}

function isMcpToolName(name: string) {
  return /^mcp/i.test(name) || name.includes('mcp__') || name.includes('mcp_');
}

function isEvalSummaryLike(value: unknown): value is EvalSummaryLike {
  return isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

async function readOptionalText(path: string) {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return undefined;
  }
}

async function readOptionalJson(path: string) {
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as unknown;
  } catch {
    return undefined;
  }
}

function createSummaryMdx() {
  return `import summary from './summary.json';

# Eval Summary

<table>
  <tbody>
    <tr><td><strong>Project</strong></td><td>{summary.project.name}</td></tr>
    <tr><td><strong>Prompt</strong></td><td>{summary.prompt}</td></tr>
    <tr><td><strong>Agent</strong></td><td>{summary.variant.agent}</td></tr>
    <tr><td><strong>Model</strong></td><td>{summary.variant.model}</td></tr>
    <tr><td><strong>Effort</strong></td><td>{summary.variant.effort}</td></tr>
    <tr><td><strong>Score</strong></td><td>{summary.score.score}</td></tr>
    <tr><td><strong>Build</strong></td><td>{summary.grade.buildSuccess ? 'PASS' : 'FAIL'}</td></tr>
    <tr><td><strong>TypeScript errors</strong></td><td>{summary.grade.typeCheckErrors}</td></tr>
  </tbody>
</table>

## Changed Files

<ul>
  {summary.grade.fileChanges.map((change) => (
    <li key={change.path}>
      <code>{change.gitStatus}</code> <code>{change.path}</code>
    </li>
  ))}
</ul>

## Screenshots

<ul>
  {(summary.publish?.screenshots ?? []).map((screenshot) => (
    <li key={screenshot.imagePath}>
      <code>{screenshot.storyFilePath}</code> → <code>{screenshot.imagePath}</code>
    </li>
  ))}
</ul>
`;
}

function createTranscriptMdx() {
  return `import transcriptData from './transcript-data.json';
import { Transcript } from './transcript';

# Transcript

<Transcript {...transcriptData} />
`;
}

interface ClaudeSystemEntry {
  type: 'system';
  subtype: 'init';
  agent?: string;
  model?: string;
  tools?: unknown[];
  mcp_servers?: unknown;
  cwd?: string;
  ms?: number;
  tokenCount?: number;
  costUSD?: number;
}

interface ClaudeAssistantEntry {
  type: 'assistant';
  message: {
    content: Array<
      | {
          type: 'text';
          text: string;
        }
      | {
          type: 'tool_use';
          id?: string;
          name: string;
          input: Record<string, unknown>;
        }
    >;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  ms?: number;
  tokenCount?: number;
  costUSD?: number;
}

interface ClaudeUserEntry {
  type: 'user';
  message: {
    content: Array<{
      type: 'tool_result';
      tool_use_id?: string;
      content:
        | string
        | Array<{
            type: string;
            text?: string;
            isError?: boolean;
          }>;
    }>;
  };
  ms?: number;
  tokenCount?: number;
  costUSD?: number;
}

interface ClaudeResultEntry {
  type: 'result';
  subtype: 'success' | 'error';
  duration_ms?: number;
  duration_api_ms?: number;
  num_turns?: number;
  total_cost_usd?: number;
  ms?: number;
  tokenCount?: number;
  costUSD?: number;
}

interface CodexCommandEntry {
  type: 'command_execution';
  command: string;
  exit_code?: number;
  aggregated_output?: string;
}

function looksLikeClaudeSystem(entry: unknown): entry is ClaudeSystemEntry {
  return isRecord(entry) && entry.type === 'system' && entry.subtype === 'init';
}

function looksLikeClaudeAssistant(entry: unknown): entry is ClaudeAssistantEntry {
  return (
    isRecord(entry) &&
    entry.type === 'assistant' &&
    isRecord(entry.message) &&
    Array.isArray(entry.message.content)
  );
}

function looksLikeClaudeUser(entry: unknown, index: number): entry is ClaudeUserEntry {
  void index;
  return (
    isRecord(entry) &&
    entry.type === 'user' &&
    isRecord(entry.message) &&
    Array.isArray(entry.message.content)
  );
}

function looksLikeClaudeResult(entry: unknown): entry is ClaudeResultEntry {
  return (
    isRecord(entry) &&
    entry.type === 'result' &&
    (entry.subtype === 'success' || entry.subtype === 'error')
  );
}

function looksLikeClaudeStatus(
  entry: unknown
): entry is { type: 'system'; subtype: 'status'; status?: string; ms?: number } {
  return isRecord(entry) && entry.type === 'system' && entry.subtype === 'status';
}

function looksLikeClaudeApiRetry(entry: unknown): entry is {
  type: 'system';
  subtype: 'api_retry';
  attempt?: number;
  max_retries?: number;
  ms?: number;
} {
  return isRecord(entry) && entry.type === 'system' && entry.subtype === 'api_retry';
}

function looksLikeClaudeToolUseSummary(
  entry: unknown
): entry is { type: 'tool_use_summary'; summary: string; ms?: number } {
  return isRecord(entry) && entry.type === 'tool_use_summary' && typeof entry.summary === 'string';
}

function looksLikeClaudeRateLimitEvent(entry: unknown): entry is {
  type: 'rate_limit_event';
  rate_limit_info?: { status?: string; resetsAt?: string };
  ms?: number;
} {
  return isRecord(entry) && entry.type === 'rate_limit_event';
}

function looksLikeCodexAgentMessage(
  entry: unknown
): entry is { type: 'agent_message'; text: string } {
  return isRecord(entry) && entry.type === 'agent_message' && typeof entry.text === 'string';
}

function looksLikeCodexReasoning(entry: unknown): entry is { type: 'reasoning'; text: string } {
  return isRecord(entry) && entry.type === 'reasoning' && typeof entry.text === 'string';
}

function looksLikeCodexCommand(entry: unknown): entry is CodexCommandEntry {
  return isRecord(entry) && entry.type === 'command_execution' && typeof entry.command === 'string';
}

function looksLikeCodexFileChange(
  entry: unknown
): entry is { type: 'file_change'; changes: Array<{ kind: string; path: string }> } {
  return isRecord(entry) && entry.type === 'file_change' && Array.isArray(entry.changes);
}

function looksLikeCodexError(entry: unknown): entry is { type: 'error'; message: string } {
  return isRecord(entry) && entry.type === 'error' && typeof entry.message === 'string';
}
