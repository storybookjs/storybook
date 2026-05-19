// Anthropic SDK dispatch for the recipe-author agent.
//
// Lane A — PR Verify Harness v4. Owns the Anthropic SDK call surface:
//   - buildAnthropicRequest: pure helper that returns the exact
//     MessageCreateParams object we send (used in unit tests).
//   - dispatchRecipeAuthor: live wrapper with stub mode + transport retry.
//   - resolveModelId / MODEL_ID_MAP: bundle agent-model hint -> public id.
//
// Stub mode (VERIFY_PR_AUTHOR_STUB_REPLY=<absolute path>) reads the file
// contents and returns them as if they were the assistant reply — no API
// call, no key required. Used by AC-V4-3a fixture tests.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import Anthropic from '@anthropic-ai/sdk';

import { sanitizeUntrustedText } from './agent-prompt.ts';
import { assertAnthropicBaseUrl } from './anthropic-env.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RECIPES_DIR = path.resolve(repoRoot, '.verify-recipes');
const AUTHORING_GUIDE_PATH = path.resolve(RECIPES_DIR, '_recipe-authoring-guide.md');
const CANONICAL_SMOKE_PATH = path.resolve(RECIPES_DIR, 'example-smoke.spec.ts');

// Public SDK model ids. The bundle's `metadata.agentModel` is the internal
// Claude Code hint (e.g. `claude-opus-4-7[1m]`); the SDK only accepts the
// canonical public id. Update this map when newer ids become available.
export const MODEL_ID_MAP: Record<string, string> = {
  'claude-opus-4-7[1m]': 'claude-opus-4-7',
  'claude-opus-4-7': 'claude-opus-4-7',
  'claude-opus-4-6': 'claude-opus-4-6',
  'claude-opus-4-5': 'claude-opus-4-5-20251101',
  'claude-sonnet-4-5': 'claude-sonnet-4-5',
  'claude-sonnet-4-6': 'claude-sonnet-4-6',
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
};

const DEFAULT_MAX_TOKENS = 8192;
const MAX_COST_USD_PER_RUN = 2.0;

// Realistic output token estimate for budget assertions. Recipe replies are
// typically 500–800 tokens; pad to 2048 to leave room for retries and tool
// output. Decoupled from request `max_tokens` so the budget check reflects
// actual realized cost expectations, not the hard cap.
const BUDGET_OUTPUT_TOKEN_ESTIMATE = 2048;

const MODEL_PRICING: Record<string, { inputUsd: number; outputUsd: number }> = {
  'claude-opus-4-7': { inputUsd: 0.000015, outputUsd: 0.000075 },
  'claude-opus-4-6': { inputUsd: 0.000015, outputUsd: 0.000075 },
  'claude-haiku-4-5-20251001': { inputUsd: 0.000001, outputUsd: 0.000005 },
  'claude-sonnet-4-5': { inputUsd: 0.000003, outputUsd: 0.000015 },
  'claude-sonnet-4-6': { inputUsd: 0.000003, outputUsd: 0.000015 },
};

// The budget gate and the realized-cost ledger must never run an uncosted
// model: an unknown id silently priced as opus would let a more expensive
// model slip past the cap (under-charge) or skew the ledger. The gate's job
// is to be conservative, so an unknown resolved id is a hard failure here.
// KNOWN ids (including the legitimate opus keys) keep their exact pricing.
function getPricing(modelId: string): { inputUsd: number; outputUsd: number } {
  const pricing = MODEL_PRICING[modelId];
  if (pricing === undefined) {
    throw new VerifyCostBudgetError(
      `[verify-pr-author] no pricing entry for model id ${JSON.stringify(
        modelId
      )}; refusing to run an uncosted model through the budget/ledger path. ` +
        `Add it to MODEL_PRICING.`
    );
  }
  return pricing;
}

export function resolveModelId(hint: string): string {
  if (MODEL_ID_MAP[hint]) return MODEL_ID_MAP[hint];
  // Already a public id — pass through (forward-compatible).
  if (/^claude-[a-z]+-\d+-\d+-\d{8}$/.test(hint)) return hint;
  // Fallback to the canonical opus public id.
  return MODEL_ID_MAP['claude-opus-4-7[1m]'];
}

let _guide: string | null = null;
let _smoke: string | null = null;

function readGuide(): string {
  if (_guide === null) _guide = fs.readFileSync(AUTHORING_GUIDE_PATH, 'utf-8');
  return _guide;
}

function readSmoke(): string {
  if (_smoke === null) _smoke = fs.readFileSync(CANONICAL_SMOKE_PATH, 'utf-8');
  return _smoke;
}

export interface BuildAnthropicRequestInput {
  prompt: string;
  model: string;
  retryMessage?: string;
}

// Anthropic.MessageCreateParams is exported by the SDK but we keep the
// return type as `unknown`-shaped (cast at call site) to avoid coupling
// unit tests to SDK-internal types.
export function buildAnthropicRequest(
  input: BuildAnthropicRequestInput
): Anthropic.MessageCreateParamsNonStreaming {
  // After W3's dedup, the cached block is the sole source of guide+smoke
  // (agent-prompt.ts no longer emits section 3). Keep it cached so the
  // prompt-cache hit covers both.
  const guide = readGuide();
  const smoke = readSmoke();
  const cachedBlock = `${guide}\n\n${smoke}`;

  const perPrParts: string[] = [input.prompt];
  if (input.retryMessage) {
    perPrParts.push('', '---', '', '# Retry guidance (attempt 2)', '', input.retryMessage);
  }
  const perPr = perPrParts.join('\n');

  return {
    model: input.model,
    max_tokens: DEFAULT_MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: cachedBlock,
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: perPr,
          },
        ],
      },
    ],
  };
}

export interface DispatchRecipeAuthorInput {
  prompt: string;
  model: string;
  retryMessage?: string;
  runDir?: string;
  // Optional cancellation signal. When provided it is forwarded to the
  // Anthropic SDK call so a SIGINT (CI cancel / Ctrl-C) can interrupt a
  // hung or slow request mid-flight. Behavior is unchanged when omitted
  // (the SDK simply receives no signal) — wiring an actual controller
  // from verify-pr.ts is the caller's concern.
  signal?: AbortSignal;
}

export interface DispatchRecipeAuthorResult {
  assistantText: string;
  usage: Anthropic.Usage;
}

const STUB_USAGE: Anthropic.Usage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation: null,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
} as Anthropic.Usage;

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_TRANSPORT_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30_000;
const JITTER_MS = 250;
const MAX_ASSISTANT_LOG_CHARS = 4096;
const TRUNCATED_SUFFIX = '... [truncated]';
const BASE64_LIKE_RE = /[A-Za-z0-9+/=]{256,}/g;

export class VerifyCostBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerifyCostBudgetError';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function redactRequestBody(req: Anthropic.MessageCreateParams): unknown {
  // Allowlist redaction — only emit known-safe fields. Never serialize
  // headers, api keys, base URLs, or anything we can't account for.
  return {
    model: req.model,
    max_tokens: req.max_tokens,
    messages: Array.isArray(req.messages)
      ? req.messages.map((m) => ({
          role: m.role,
          content: Array.isArray(m.content)
            ? m.content.map((c) =>
                c.type === 'text'
                  ? {
                      type: 'text',
                      text: typeof c.text === 'string' ? c.text : '',
                      cache_control: c.cache_control ?? undefined,
                    }
                  : { type: c.type }
              )
            : m.content,
        }))
      : [],
  };
}

function maxCostUsd(): number {
  const raw = process.env.VERIFY_MAX_COST_USD;
  if (raw === undefined) return MAX_COST_USD_PER_RUN;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new VerifyCostBudgetError(
      `[verify-pr-author] VERIFY_MAX_COST_USD must be a non-negative number, got ${JSON.stringify(raw)}.`
    );
  }
  return parsed;
}

export function assertWithinCostBudget(prompt: string, modelId: string): void {
  const pricing = getPricing(modelId);
  const estimatedInputTokens = Math.ceil(prompt.length / 4);
  const estimatedCostUsd =
    estimatedInputTokens * pricing.inputUsd + BUDGET_OUTPUT_TOKEN_ESTIMATE * pricing.outputUsd;
  const budgetUsd = maxCostUsd();
  if (estimatedCostUsd > budgetUsd) {
    throw new VerifyCostBudgetError(
      `[verify-pr-author] estimated dispatch cost $${estimatedCostUsd.toFixed(
        4
      )} exceeds budget cap $${budgetUsd.toFixed(
        2
      )}. Set VERIFY_MAX_COST_USD to override the cap.`
    );
  }
}

// Run-level cost ledger. Each successful Anthropic call appends one entry
// keyed by ts so the orchestrator (verify-pr-generate retry gate) can sum
// totalUsd and refuse a retry once the run's realized cost approaches the
// per-run budget cap.
//
// Schema (each line is one JSON object in the array on disk):
//   {
//     ts: ISO-8601 string,
//     attempt: number,           // dispatch attempt within the call
//     model: string,             // public SDK model id
//     inputTokens: number,
//     outputTokens: number,
//     costUsd: number
//   }
//
// File path: `<runDir>/cost-ledger.json`. Total is computed by summing
// costUsd across entries; see loadCostLedger.
export interface CostLedgerEntry {
  ts: string;
  attempt: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export function recordDispatchCost(
  runDir: string,
  entry: Omit<CostLedgerEntry, 'ts'>
): void {
  try {
    fs.mkdirSync(runDir, { recursive: true });
    const ledgerPath = path.join(runDir, 'cost-ledger.json');
    let existing: CostLedgerEntry[] = [];
    try {
      const raw = fs.readFileSync(ledgerPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) existing = parsed as CostLedgerEntry[];
    } catch {
      // missing or unreadable — start fresh
    }
    existing.push({ ts: new Date().toISOString(), ...entry });
    // Atomic write: serialize to a tmp file then rename over the real path.
    // rename(2) is atomic on a single filesystem, so a concurrent reader
    // (loadCostLedger in the C11 retry-cost gate) can never observe a
    // half-written / torn JSON document.
    const tmpPath = path.join(
      runDir,
      `cost-ledger.json.${process.pid}.${Date.now()}.tmp`
    );
    fs.writeFileSync(tmpPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmpPath, ledgerPath);
  } catch {
    // ledger emission is best-effort; never break the dispatch on this
  }
}

// FAIL-SAFE contract: the sole consumer is the C11 retry-cost gate in
// verify-pr-generate.ts, which refuses a retry when `totalUsd > budget*0.5`.
// A genuinely absent ledger (ENOENT) means no spend yet → legitimately
// `{ totalUsd: 0 }`. ANY other read/parse failure (corrupt, torn mid-write,
// EBUSY, EACCES, non-array JSON) is exactly the concurrent/torn-ledger
// failure this gate exists to guard — silently zeroing it would bypass the
// budget cap on its own worst case. So on any non-ENOENT failure we return
// `totalUsd: Number.POSITIVE_INFINITY`, which the existing `> budget*0.5`
// comparison treats as over-budget WITHOUT any caller change required.
export function loadCostLedger(runDir: string): { totalUsd: number; entries: CostLedgerEntry[] } {
  const ledgerPath = path.join(runDir, 'cost-ledger.json');
  let raw: string;
  try {
    raw = fs.readFileSync(ledgerPath, 'utf-8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      // Ledger genuinely absent — no dispatch recorded any cost yet.
      return { totalUsd: 0, entries: [] };
    }
    // Corrupt / torn / locked / unreadable — fail safe (assume over budget).
    console.warn(
      `[verify-pr-author] cost ledger unreadable at ${ledgerPath} (${
        (err as Error)?.message ?? err
      }); treating run as over budget to fail safe.`
    );
    return { totalUsd: Number.POSITIVE_INFINITY, entries: [] };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(
        `[verify-pr-author] cost ledger at ${ledgerPath} is not a JSON array; treating run as over budget to fail safe.`
      );
      return { totalUsd: Number.POSITIVE_INFINITY, entries: [] };
    }
    const entries = parsed as CostLedgerEntry[];
    const totalUsd = entries.reduce((acc, e) => acc + (Number(e.costUsd) || 0), 0);
    return { totalUsd, entries };
  } catch (err: unknown) {
    // Present but unparseable (torn write / corruption) — fail safe.
    console.warn(
      `[verify-pr-author] cost ledger at ${ledgerPath} failed to parse (${
        (err as Error)?.message ?? err
      }); treating run as over budget to fail safe.`
    );
    return { totalUsd: Number.POSITIVE_INFINITY, entries: [] };
  }
}

export function computeRealizedCostUsd(modelId: string, usage: Anthropic.Usage): number {
  const pricing = getPricing(modelId);
  const inputTokens = Number(usage.input_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? 0);
  return inputTokens * pricing.inputUsd + outputTokens * pricing.outputUsd;
}

function writeDispatchArtifacts(
  runDir: string,
  req: Anthropic.MessageCreateParams,
  result: { assistantText: string; usage: Anthropic.Usage } | null,
  err: unknown,
  attempt: number
): void {
  try {
    fs.mkdirSync(runDir, { recursive: true });
    const redacted = redactRequestBody(req);
    fs.writeFileSync(
      path.join(runDir, 'dispatch-request.json'),
      JSON.stringify(redacted, null, 2) + '\n',
      'utf-8'
    );
    if (result) {
      fs.writeFileSync(
        path.join(runDir, 'dispatch-response.json'),
        JSON.stringify(
          {
            model: req.model,
            usage: result.usage,
            assistantText: result.assistantText,
          },
          null,
          2
        ) + '\n',
        'utf-8'
      );
    }
    const logLine = {
      ts: new Date().toISOString(),
      attempt,
      model: req.model,
      ok: result !== null,
      error: err ? (err instanceof Error ? err.message : String(err)) : undefined,
      usage: result?.usage ?? undefined,
    };
    fs.appendFileSync(path.join(runDir, 'dispatch.log'), JSON.stringify(logLine) + '\n', 'utf-8');
  } catch {
    // artifact emission is best-effort
  }
}

function logAssistantText(label: string, text: string): void {
  const redactedText = text.replace(
    BASE64_LIKE_RE,
    (value) => `[BASE64_REDACTED:${value.length}]`
  );
  const truncated =
    redactedText.length <= MAX_ASSISTANT_LOG_CHARS
      ? redactedText
      : `${redactedText.slice(0, MAX_ASSISTANT_LOG_CHARS - TRUNCATED_SUFFIX.length)}${TRUNCATED_SUFFIX}`;
  // Strip ANSI/control chars from LLM output before printing so a prompt
  // injection can't repaint the terminal log.
  const displayText = sanitizeUntrustedText(truncated);
  const banner = `===== ${label} (assistant response) =====`;
  console.error(banner);
  console.error(displayText);
  console.error('='.repeat(banner.length));
}

export async function dispatchRecipeAuthor(
  input: DispatchRecipeAuthorInput
): Promise<DispatchRecipeAuthorResult> {
  const stubPath = process.env.VERIFY_PR_AUTHOR_STUB_REPLY;
  if (stubPath) {
    const abs = path.isAbsolute(stubPath) ? stubPath : path.resolve(process.cwd(), stubPath);
    const assistantText = fs.readFileSync(abs, 'utf-8');
    const result = { assistantText, usage: STUB_USAGE };
    if (input.runDir) {
      // AC-V4-9: redaction is verified via stub-mode dispatch; emit the
      // would-be request body (with cache_control markers preserved) so
      // verification can grep for absence of api-key headers.
      const request = buildAnthropicRequest({
        prompt: input.prompt,
        model: input.model,
        retryMessage: input.retryMessage,
      });
      writeDispatchArtifacts(input.runDir, request, result, null, 1);
    }
    return result;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      '[verify-pr-author] ANTHROPIC_API_KEY is not set. Refusing to call the Anthropic API without credentials.'
    );
  }

  const request = buildAnthropicRequest({
    prompt: input.prompt,
    model: input.model,
    retryMessage: input.retryMessage,
  });

  assertWithinCostBudget(input.prompt, request.model);

  // UC2: refuse to construct the SDK client against an untrusted base URL.
  assertAnthropicBaseUrl();

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL ?? undefined,
    maxRetries: 0,
  });

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_TRANSPORT_ATTEMPTS; attempt += 1) {
    try {
      const response = await client.messages.create(
        request,
        input.signal ? { signal: input.signal } : undefined
      );
      const assistantText = Array.isArray(response.content)
        ? response.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('')
        : '';
      const result = { assistantText, usage: response.usage };
      if (input.runDir) {
        writeDispatchArtifacts(input.runDir, request, result, null, attempt + 1);
        recordDispatchCost(input.runDir, {
          attempt: attempt + 1,
          model: request.model,
          inputTokens: Number(response.usage?.input_tokens ?? 0),
          outputTokens: Number(response.usage?.output_tokens ?? 0),
          costUsd: computeRealizedCostUsd(request.model, response.usage),
        });
      }
      logAssistantText(
        `[verify-pr-author] dispatch attempt ${attempt + 1} (model ${request.model})`,
        assistantText
      );
      return result;
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const retryable = typeof status === 'number' && RETRYABLE_STATUSES.has(status);
      if (input.runDir) {
        writeDispatchArtifacts(input.runDir, request, null, err, attempt + 1);
      }
      if (!retryable || attempt === MAX_TRANSPORT_ATTEMPTS - 1) {
        throw err;
      }
      const backoff =
        Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS) +
        Math.floor(Math.random() * JITTER_MS);
      await delay(backoff);
    }
  }

  // Unreachable in practice, but TypeScript needs an explicit throw here.
  throw lastErr ?? new Error('[verify-pr-author] transport retry loop exhausted');
}
