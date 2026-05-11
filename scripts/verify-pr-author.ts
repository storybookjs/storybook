// CLI entry for the PR Verify Harness recipe-author dispatcher (Lane A v4).
//
// Two dispatch modes:
//   --dispatch-mode sdk    (default) — calls Anthropic via @anthropic-ai/sdk
//   --dispatch-mode stdin              — reads the assistant reply from stdin
//
// Stdin mode is the v3 hand-off path: the verify-recipe-author skill runs
// the LLM call under human review and pipes the reply here. On lint/regex
// failure with attempt 1, the script frames a retry message to stdout and
// exits 75 so the skill can run the second dispatch.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';

import { dispatchRecipeAuthor, resolveModelId } from './verify/agent-dispatch.ts';
import {
  runRecipeAuthor,
  type PromptBundle,
  type DispatchFn,
} from './verify/recipe-author-core.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const VERIFY_OUTPUT_DIR = path.resolve(repoRoot, '.verify-output');

const HELP = `
Usage: node scripts/verify-pr-author.ts [--bundle <path>] [options]

Options:
  --bundle <path>         Path to a prompt-bundle.json (default: latest under .verify-output/)
  --dispatch-mode <mode>  'sdk' (default) or 'stdin'
  --retry-of <runId>      Only valid with --dispatch-mode stdin; signals attempt 2
  --help                  Show this help

Environment:
  ANTHROPIC_API_KEY              required for --dispatch-mode sdk (unless stub)
  ANTHROPIC_BASE_URL             optional override
  VERIFY_PR_AUTHOR_STUB_REPLY    absolute path to a fixture reply file; skips
                                 the Anthropic call. Used by unit tests.
  DEBUG=verify-pr-author         emit dispatch.log + dispatch-request.json
                                 (request body redacted, never contains api key)
`.trim();

interface Argv {
  bundle?: string;
  'dispatch-mode'?: string;
  'retry-of'?: string;
  help?: boolean;
}

function findLatestBundle(): string | null {
  if (!fs.existsSync(VERIFY_OUTPUT_DIR)) return null;
  const entries = fs
    .readdirSync(VERIFY_OUTPUT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();
  for (const name of entries) {
    const candidate = path.join(VERIFY_OUTPUT_DIR, name, 'prompt-bundle.json');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function readBundle(bundlePath: string): PromptBundle {
  const raw = fs.readFileSync(bundlePath, 'utf-8');
  const parsed = JSON.parse(raw) as PromptBundle;
  if (parsed.version !== 1) {
    throw new Error(
      `[verify-pr-author] unsupported prompt-bundle version: ${parsed.version}. Re-run verify-pr-generate.`
    );
  }
  return parsed;
}

function readStdinToString(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

const RETRY_FRAME_MAX_BYTES = 64 * 1024;

function frameRetry(runId: string, retryMessage: string): string {
  const body =
    `===VERIFY_PR_AUTHOR_RETRY_BEGIN===\n` +
    `attempt: 1\n` +
    `runId: ${runId}\n` +
    `retryMessage: |\n` +
    retryMessage
      .split('\n')
      .map((l) => `  ${l}`)
      .join('\n') +
    `\n===VERIFY_PR_AUTHOR_RETRY_END===\n`;
  if (Buffer.byteLength(body, 'utf-8') > RETRY_FRAME_MAX_BYTES) {
    const cap = RETRY_FRAME_MAX_BYTES - 200;
    const truncated = retryMessage.slice(0, cap);
    return (
      `===VERIFY_PR_AUTHOR_RETRY_BEGIN===\n` +
      `attempt: 1\n` +
      `runId: ${runId}\n` +
      `retryMessage: |\n` +
      truncated
        .split('\n')
        .map((l) => `  ${l}`)
        .join('\n') +
      `\n  [...truncated]\n` +
      `===VERIFY_PR_AUTHOR_RETRY_END===\n`
    );
  }
  return body;
}

async function main(rawArgv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: rawArgv,
    options: {
      bundle: { type: 'string' },
      'dispatch-mode': { type: 'string', default: 'sdk' },
      'retry-of': { type: 'string' },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });
  const flags = values as Argv;

  if (flags.help) {
    console.log(HELP);
    return 0;
  }

  const mode = flags['dispatch-mode'];
  if (mode !== 'sdk' && mode !== 'stdin') {
    console.error(`[verify-pr-author] --dispatch-mode must be 'sdk' or 'stdin', got: ${mode}`);
    return 1;
  }

  if (flags['retry-of'] && mode !== 'stdin') {
    console.error(`[verify-pr-author] --retry-of is only valid with --dispatch-mode stdin.`);
    return 1;
  }

  const bundlePath = flags.bundle ?? findLatestBundle();
  if (!bundlePath) {
    console.error(`[verify-pr-author] no prompt bundle found under ${VERIFY_OUTPUT_DIR}.`);
    console.error('[verify-pr-author] run `yarn verify-pr-generate --pr <number>` first.');
    return 1;
  }

  let bundle: PromptBundle;
  try {
    bundle = readBundle(bundlePath);
  } catch (err) {
    console.error(`[verify-pr-author] failed to read bundle: ${(err as Error).message}`);
    return 1;
  }

  const runDir = path.dirname(bundlePath);
  const attempt: 1 | 2 = flags['retry-of'] ? 2 : 1;

  let dispatch: DispatchFn;
  if (mode === 'sdk') {
    const modelId = resolveModelId(bundle.metadata.agentModel);
    dispatch = async ({ prompt, retryMessage }) => {
      const r = await dispatchRecipeAuthor({ prompt, retryMessage, model: modelId, runDir });
      return r.assistantText;
    };
  } else {
    let stdinReadOnce = false;
    dispatch = async () => {
      if (stdinReadOnce) {
        throw new Error(
          '[verify-pr-author] stdin already consumed. The skill must invoke this script once per attempt.'
        );
      }
      stdinReadOnce = true;
      return readStdinToString();
    };
  }

  let result;
  try {
    result = await runRecipeAuthor({ bundle, dispatch, runDir, attempt, mode });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[verify-pr-author] dispatch failed: ${msg}`);
    return 1;
  }

  switch (result.status) {
    case 'spec-written': {
      console.error(`[verify-pr-author] wrote ${result.specPath} (attempts=${result.attempts})`);
      console.log(`yarn verify-pr --recipe-spec ${path.relative(repoRoot, result.specPath)}`);
      return 0;
    }
    case 'retry-requested': {
      // Stdin mode attempt 1 only.
      process.stdout.write(frameRetry(result.runId ?? bundle.runId, result.retryMessage ?? ''));
      return 75;
    }
    case 'collision': {
      console.error(
        `[verify-pr-author] spec collision at ${result.specPath} (pass --force to overwrite)`
      );
      return 1;
    }
    default: {
      console.error(
        `[verify-pr-author] terminal failure: status=${result.status} attempts=${result.attempts}`
      );
      if (result.retryMessage) {
        console.error('[verify-pr-author] last retry-message:');
        console.error(result.retryMessage);
      }
      return 1;
    }
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[verify-pr-author] fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
