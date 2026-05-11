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
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
};

export const MODEL_MAX_TOKENS: Record<string, number> = {
  'claude-opus-4-7': 8192,
  'claude-opus-4-6': 8192,
  'claude-opus-4-5-20251101': 8192,
  'claude-haiku-4-5-20251001': 4096,
};

const DEFAULT_MAX_TOKENS = 8192;

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

// Sentinels for AC-V4-3a: first 80 chars of guide/smoke files. Exposed so
// the unit test can assert the cached block of the assembled request body
// starts with these strings without reading the files itself.
export const GUIDE_SENTINEL = (() => {
  try {
    return readGuide().slice(0, 80);
  } catch {
    return '';
  }
})();

export const SMOKE_SENTINEL = (() => {
  try {
    return readSmoke().slice(0, 80);
  } catch {
    return '';
  }
})();

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
): Anthropic.MessageCreateParams {
  const guide = readGuide();
  const smoke = readSmoke();
  const cachedBlock = `${guide}\n\n${smoke}`;

  const perPrParts: string[] = [input.prompt];
  if (input.retryMessage) {
    perPrParts.push('', '---', '', '# Retry guidance (attempt 2)', '', input.retryMessage);
  }
  const perPr = perPrParts.join('\n');

  const maxTokens = MODEL_MAX_TOKENS[input.model] ?? DEFAULT_MAX_TOKENS;

  return {
    model: input.model,
    max_tokens: maxTokens,
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
}

export interface DispatchRecipeAuthorResult {
  assistantText: string;
  usage: Anthropic.Usage;
}

const STUB_USAGE: Anthropic.Usage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  server_tool_use: null,
  service_tier: null,
};

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_TRANSPORT_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;
const JITTER_MS = 250;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isDebugEnabled(): boolean {
  return Boolean(process.env.DEBUG && process.env.DEBUG.includes('verify-pr-author'));
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

function writeDebugArtifacts(
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
    // debug logging is best-effort
  }
}

export async function dispatchRecipeAuthor(
  input: DispatchRecipeAuthorInput
): Promise<DispatchRecipeAuthorResult> {
  const stubPath = process.env.VERIFY_PR_AUTHOR_STUB_REPLY;
  if (stubPath) {
    const abs = path.isAbsolute(stubPath) ? stubPath : path.resolve(process.cwd(), stubPath);
    const assistantText = fs.readFileSync(abs, 'utf-8');
    const result = { assistantText, usage: STUB_USAGE };
    if (isDebugEnabled() && input.runDir) {
      // AC-V4-9: redaction is verified via stub-mode dispatch; emit the
      // would-be request body (with cache_control markers preserved) so
      // verification can grep for absence of api-key headers.
      const request = buildAnthropicRequest({
        prompt: input.prompt,
        model: input.model,
        retryMessage: input.retryMessage,
      });
      writeDebugArtifacts(input.runDir, request, result, null, 1);
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

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL ?? undefined,
    maxRetries: 0,
  });

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_TRANSPORT_ATTEMPTS; attempt += 1) {
    try {
      const response = await client.messages.create(request);
      const assistantText = Array.isArray(response.content)
        ? response.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('')
        : '';
      const result = { assistantText, usage: response.usage };
      if (isDebugEnabled() && input.runDir) {
        writeDebugArtifacts(input.runDir, request, result, null, attempt + 1);
      }
      return result;
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const retryable = typeof status === 'number' && RETRYABLE_STATUSES.has(status);
      if (isDebugEnabled() && input.runDir) {
        writeDebugArtifacts(input.runDir, request, null, err, attempt + 1);
      }
      if (!retryable || attempt === MAX_TRANSPORT_ATTEMPTS - 1) {
        throw err;
      }
      const backoff = BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * JITTER_MS);
      await delay(backoff);
    }
  }

  // Unreachable in practice, but TypeScript needs an explicit throw here.
  throw lastErr ?? new Error('[verify-pr-author] transport retry loop exhausted');
}
