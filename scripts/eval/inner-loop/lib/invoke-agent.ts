/**
 * Invokes Claude via @anthropic-ai/claude-agent-sdk's `query`. Mirrors the
 * pattern in scripts/eval/lib/agents/claude-code.ts (subscription-based auth
 * via the local Claude Code install — no ANTHROPIC_API_KEY required).
 *
 * For inner-loop the agent does a single one-shot reasoning pass over the
 * provided ChangeContext, returning a clustering JSON. We do not allow any
 * tools (Read/Write/Bash) because the agent shouldn't touch the filesystem
 * or shell — its only input is the payload, its only output is JSON.
 */
// SDK imported dynamically so the harness can load on any branch — the
// `@anthropic-ai/claude-agent-sdk` dep is only present on `next` (where
// scripts/eval lives natively). Baseline-only runs work without it.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChangeContextPayload } from './build-payload.ts';
import type { Cluster } from './score.ts';
import { expandSignatures, type SignatureCluster } from './expand-signatures.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

export interface AgentRun {
  model: string;
  costUsd: number | undefined;
  durationS: number;
  durationApiS: number | undefined;
  turns: number;
  raw: string;
  parsed: { clusters: Cluster[] } | null;
  parseError?: string;
  /** Per-message-type counts and first/last timestamps, for diagnosing hangs. */
  messageTrace?: {
    typeCounts: Record<string, number>;
    firstMessageMs?: number;
    lastMessageMs?: number;
    totalMessages: number;
    /** Output token estimate based on assembled assistant text length / 4. */
    estimatedOutputTokens: number;
  };
  /** Pulled from the `result` message when available. */
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  /** Present when signature-prompt was used; contains unmatched IDs. */
  signatureExpansion?: { clusters: Cluster[]; unmatched: string[] };
  /** Raw signature clusters as emitted by the model (signature variant only). */
  rawSignatureClusters?: SignatureCluster[];
}

export interface InvokeOptions {
  /** SDK model id. Default: `claude-sonnet-4-6`. */
  sdkModel?: string;
  /** Effort level. Default: `medium`. */
  effort?: 'low' | 'medium' | 'high' | 'max';
  /** Custom prompt path. Default: prompts/categoriser.md. */
  promptPath?: string;
  /** Verbose stdout. */
  verbose?: boolean;
  /** Log every SDK message to stdout with timestamps for diagnosing hangs. */
  trace?: boolean;
  /**
   * Prompt variant. `enumerate` = original prompt asking for every story to
   * be placed in a cluster. `signature` = signature-based prompt asking the
   * model to emit cluster definitions only; deterministic system expands.
   */
  promptVariant?: 'enumerate' | 'signature';
}

export async function invokeAgent(
  payload: ChangeContextPayload,
  options: InvokeOptions = {}
): Promise<AgentRun> {
  const sdkModel = options.sdkModel || 'claude-sonnet-4-6';
  const effort = options.effort || 'medium';
  const variant = options.promptVariant || 'enumerate';
  const defaultPrompt =
    variant === 'signature' ? 'categoriser-signature.md' : 'categoriser.md';
  const promptPath = options.promptPath || join(HERE, '..', 'prompts', defaultPrompt);
  const systemPrompt = await readFile(promptPath, 'utf8');

  const userMessage = `Categorise this ChangeContext:\n\n${JSON.stringify(payload, null, 2)}`;

  const startTime = Date.now();
  let cost: number | undefined;
  let turns = 0;
  let durationApiS: number | undefined;
  let lastAssistantText = '';
  const messages: unknown[] = [];

  // Dynamically import the SDK so module load works without it.
  const { query } = await import('@anthropic-ai/claude-agent-sdk').catch(() => {
    throw new Error(
      `@anthropic-ai/claude-agent-sdk is not installed. Run the eval on a branch where scripts/eval/ is present (e.g. \`next\`), or run with --baseline-only to skip agent invocation.`
    );
  });

  const typeCounts: Record<string, number> = {};
  let firstMessageMs: number | undefined;
  let lastMessageMs: number | undefined;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let cacheReadTokens: number | undefined;

  for await (const message of query({
    prompt: userMessage,
    options: {
      model: sdkModel,
      // No tools: the agent's job is pure reasoning over the supplied payload.
      allowedTools: [],
      effort,
      systemPrompt,
    },
  })) {
    messages.push(message);
    const elapsedMs = Date.now() - startTime;
    if (firstMessageMs === undefined) firstMessageMs = elapsedMs;
    lastMessageMs = elapsedMs;
    typeCounts[message.type] = (typeCounts[message.type] || 0) + 1;
    if (options.trace) {
      const summary = traceSummary(message);
      console.log(`[+${(elapsedMs / 1000).toFixed(1)}s] ${message.type}${summary ? ' ' + summary : ''}`);
    }
    if (options.verbose) {
      logMessage(message);
    }
    if (
      message.type === 'assistant' &&
      message.message &&
      Array.isArray(message.message.content)
    ) {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          lastAssistantText = block.text;
        }
      }
    }
    if (message.type === 'result') {
      const m = message as Record<string, unknown> & { usage?: Record<string, unknown> };
      cost = m.total_cost_usd as number | undefined;
      turns = (m.num_turns as number | undefined) ?? 0;
      const durationApiMs = m.duration_api_ms as number | undefined;
      durationApiS = typeof durationApiMs === 'number' ? durationApiMs / 1000 : undefined;
      const usage = m.usage;
      if (usage) {
        inputTokens = usage.input_tokens as number | undefined;
        outputTokens = usage.output_tokens as number | undefined;
        cacheReadTokens = usage.cache_read_input_tokens as number | undefined;
      }
    }
  }

  let parsed: { clusters: Cluster[] } | null = null;
  let parseError: string | undefined;
  let signatureExpansion:
    | { clusters: Cluster[]; unmatched: string[] }
    | undefined;
  let rawSignatureClusters: SignatureCluster[] | undefined;
  try {
    const cleaned = lastAssistantText
      .replace(/^```json\s*/i, '')
      .replace(/```$/, '')
      .trim();
    const raw = JSON.parse(cleaned) as { clusters: unknown[] };
    if (variant === 'signature') {
      rawSignatureClusters = raw.clusters as SignatureCluster[];
      const allIds = [
        ...payload.modified,
        ...payload.affected,
        ...payload.new,
        ...payload.cssAffected,
      ];
      signatureExpansion = expandSignatures(rawSignatureClusters, allIds);
      parsed = { clusters: signatureExpansion.clusters };
    } else {
      parsed = raw as { clusters: Cluster[] };
    }
  } catch (e) {
    parseError = e instanceof Error ? e.message : String(e);
  }

  return {
    model: sdkModel,
    costUsd: cost,
    durationS: (Date.now() - startTime) / 1000,
    durationApiS,
    turns,
    raw: lastAssistantText,
    parsed,
    parseError,
    signatureExpansion,
    rawSignatureClusters,
    messageTrace: {
      typeCounts,
      firstMessageMs,
      lastMessageMs,
      totalMessages: messages.length,
      estimatedOutputTokens: Math.ceil(lastAssistantText.length / 4),
    },
    inputTokens,
    outputTokens,
    cacheReadTokens,
  };
}

function traceSummary(message: any): string {
  if (message.type === 'assistant' && Array.isArray(message.message?.content)) {
    const parts = message.message.content
      .map((b: { type: string; text?: string }) => {
        if (b.type === 'text') return `text(${(b.text ?? '').length}c)`;
        return b.type;
      })
      .join(',');
    return `[${parts}]`;
  }
  if (message.type === 'result') {
    const m = message as Record<string, unknown> & { usage?: Record<string, unknown> };
    const u = m.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    return `cost=$${m.total_cost_usd ?? '?'} turns=${m.num_turns ?? '?'} in=${u?.input_tokens ?? '?'} out=${u?.output_tokens ?? '?'}`;
  }
  if (message.type === 'system') {
    return `subtype=${(message as { subtype?: string }).subtype ?? '?'}`;
  }
  return '';
}

function logMessage(message: any /* SDKMessage at runtime */) {
  switch (message.type) {
    case 'assistant':
      if (Array.isArray(message.message?.content)) {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            const preview = block.text.length > 200 ? block.text.slice(0, 200) + '…' : block.text;
            console.log(`[assistant] ${preview}`);
          }
        }
      }
      break;
    case 'result':
      console.log(
        `[result] cost=$${(message as { total_cost_usd?: number }).total_cost_usd ?? '?'}, turns=${(message as { num_turns?: number }).num_turns ?? '?'}`
      );
      break;
    default:
      break;
  }
}
