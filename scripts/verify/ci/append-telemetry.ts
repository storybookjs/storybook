// CI helper: aggregates per-dispatch token usage across every Claude call
// in a verify run and POSTs a single telemetry row to the configured
// webhook. NO USD math — emits raw token counts + model only. The sink
// (Google Apps Script) computes cost in a derived column so price-table
// drift never blocks the workflow.
//
// Replaces the inline 175-line bash + jq block in
// `.github/workflows/verify-pr.yml`. Uses curl with `--config <tempfile>`
// so the webhook URL and bearer token stay off argv / process listings.
//
// Invocation:
//   node ./scripts/verify/ci/append-telemetry.ts \
//     --result <path-to-verify-result.json> \
//     --pr <pr-number> \
//     --run-id <github-run-id> \
//     --dispatch-dir <dir-to-scan>... \
//     [--curl-cfg <tempfile-path>]
//
// Reads `TELEMETRY_AGENTIC_VERIFICATION_WEBHOOK_URL` and
// `TELEMETRY_AGENTIC_VERIFICATION_WEBHOOK_TOKEN` (or `TELEMETRY_URL` and
// `TELEMETRY_TOKEN` for legacy parity) from env.

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

interface Args {
  result: string;
  pr: string;
  runId: string;
  dispatchDirs: string[];
  curlCfg?: string;
}

function parseCliArgs(argv: string[]): Args {
  const { values } = parseArgs({
    args: argv,
    options: {
      result: { type: 'string' },
      pr: { type: 'string' },
      'run-id': { type: 'string' },
      'dispatch-dir': { type: 'string', multiple: true },
      'curl-cfg': { type: 'string' },
    },
    strict: true,
  });
  const dispatchDirs = (values['dispatch-dir'] as string[] | undefined) ?? [];
  if (!values.result || !values.pr || !values['run-id'] || dispatchDirs.length === 0) {
    throw new Error(
      'usage: append-telemetry --result <path> --pr <num> --run-id <id> --dispatch-dir <dir> [--dispatch-dir <dir>...]'
    );
  }
  return {
    result: values.result,
    pr: values.pr,
    runId: values['run-id'],
    dispatchDirs,
    curlCfg: values['curl-cfg'],
  };
}

function walkFiles(root: string, filter: (name: string) => boolean): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: any[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && filter(e.name)) out.push(full);
    }
  };
  walk(root);
  return out;
}

function num(x: any): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

interface DispatchSummary {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
  cacheReadTokens: number;
}

export function summarizeDispatch(payload: any): DispatchSummary {
  const usage = payload?.usage ?? {};
  const cacheCreationLegacy = num(usage.cache_creation_input_tokens);
  const sdkCw5 = num(usage.cache_creation?.ephemeral_5m_input_tokens);
  const cacheCreation1h = num(usage.cache_creation?.ephemeral_1h_input_tokens);
  // SDK exposes a breakdown under .cache_creation when extended cache is
  // enabled; otherwise the total lands in .cache_creation_input_tokens and
  // we charge it at the 5m rate (the SDK default TTL).
  const cacheCreation5m = sdkCw5 + cacheCreation1h > 0 ? sdkCw5 : cacheCreationLegacy;
  return {
    model: typeof payload?.model === 'string' ? payload.model : '',
    inputTokens: num(usage.input_tokens),
    outputTokens: num(usage.output_tokens),
    cacheWrite5mTokens: cacheCreation5m,
    cacheWrite1hTokens: cacheCreation1h,
    cacheReadTokens: num(usage.cache_read_input_tokens),
  };
}

// Anthropic public list prices in USD per 1M tokens, current as of
// 2026-05-13. Mirrors the legacy bash/jq table in commit 3a52c415352.
//   i   = input tokens
//   o   = output tokens
//   cr  = cache reads
//   cw5 = 5-minute cache writes (SDK default)
//   cw1 = 1-hour cache writes (extended cache)
// Apps Script does NOT compute USD downstream — `cost_usd` ships in the
// payload, and the sheet just writes the column.
const PRICES_USD_PER_1M: Record<
  string,
  { i: number; o: number; cr: number; cw5: number; cw1: number }
> = {
  'claude-opus-4-7': { i: 5.0, o: 25.0, cr: 0.5, cw5: 6.25, cw1: 10.0 },
  'claude-opus-4-6': { i: 5.0, o: 25.0, cr: 0.5, cw5: 6.25, cw1: 10.0 },
  'claude-opus-4-5': { i: 5.0, o: 25.0, cr: 0.5, cw5: 6.25, cw1: 10.0 },
  'claude-opus-4-1': { i: 15.0, o: 75.0, cr: 1.5, cw5: 18.75, cw1: 30.0 },
  'claude-opus-4': { i: 15.0, o: 75.0, cr: 1.5, cw5: 18.75, cw1: 30.0 },
  'claude-sonnet-4-6': { i: 3.0, o: 15.0, cr: 0.3, cw5: 3.75, cw1: 6.0 },
  'claude-sonnet-4-5': { i: 3.0, o: 15.0, cr: 0.3, cw5: 3.75, cw1: 6.0 },
  'claude-sonnet-4': { i: 3.0, o: 15.0, cr: 0.3, cw5: 3.75, cw1: 6.0 },
  'claude-haiku-4-5': { i: 1.0, o: 5.0, cr: 0.1, cw5: 1.25, cw1: 2.0 },
  'claude-haiku-3-5': { i: 0.8, o: 4.0, cr: 0.08, cw5: 1.0, cw1: 1.6 },
  'claude-haiku-3': { i: 0.25, o: 1.25, cr: 0.03, cw5: 0.3, cw1: 0.5 },
};

// Strip trailing -YYYYMMDD date suffix Anthropic ships alongside the
// rolling alias (e.g. claude-haiku-4-5-20251001 → claude-haiku-4-5).
function modelKey(model: string): string {
  return model.replace(/-\d{8}$/, '');
}

function dispatchCostUsd(d: DispatchSummary): number {
  let p = PRICES_USD_PER_1M[modelKey(d.model)];
  if (p === undefined) {
    // Telemetry is an explicitly non-blocking side-channel, so we do NOT
    // throw here (unlike the authoritative budget/ledger path in
    // agent-dispatch.ts). But a $0 charge for an unknown model is silent
    // price-table drift — make it loud so it surfaces in workflow logs.
    console.warn(
      `[telemetry] unknown model ${d.model || '(empty)'} — cost recorded as 0`
    );
    p = { i: 0, o: 0, cr: 0, cw5: 0, cw1: 0 };
  }
  return (
    (d.inputTokens * p.i +
      d.outputTokens * p.o +
      d.cacheReadTokens * p.cr +
      d.cacheWrite5mTokens * p.cw5 +
      d.cacheWrite1hTokens * p.cw1) /
    1_000_000
  );
}

// Posts the telemetry payload through `curl --config <tempfile>` (URL only)
// with the body piped via stdin. The bearer token rides INSIDE the JSON body
// as `token`, never on argv and never on the filesystem. The receiver (Apps
// Script at `TELEMETRY_AGENTIC_VERIFICATION_WEBHOOK_URL`) reads the token
// from `JSON.parse(e.postData.contents).token` — Apps Script doPost does not
// expose request headers, so Authorization-header auth fails with
// `{"ok":false,"error":"unauthorized"}` (see SECURITY.md).
function curlPost(url: string, body: string, curlCfgPath: string): string {
  writeFileSync(curlCfgPath, `url = "${url}"\n`, 'utf-8');
  chmodSync(curlCfgPath, 0o600);
  try {
    const res = spawnSync(
      'curl',
      [
        '-sS',
        '-fL',
        '--max-time',
        '30',
        '--config',
        curlCfgPath,
        '-H',
        'Content-Type: application/json',
        '--data-binary',
        '@-',
      ],
      { encoding: 'utf-8', input: body }
    );
    if (res.status !== 0) {
      throw new Error(`curl exited ${res.status}: ${res.stderr || res.stdout}`);
    }
    return (res.stdout ?? '').trim();
  } finally {
    try {
      // shred → unlink fallback. Best-effort.
      const shred = spawnSync('shred', ['-u', curlCfgPath], { encoding: 'utf-8' });
      if (shred.status !== 0 && existsSync(curlCfgPath)) unlinkSync(curlCfgPath);
    } catch {
      try {
        if (existsSync(curlCfgPath)) unlinkSync(curlCfgPath);
      } catch {
        /* ignore */
      }
    }
  }
}

function main(args: Args): void {
  const telemetryUrl =
    process.env.TELEMETRY_AGENTIC_VERIFICATION_WEBHOOK_URL ?? process.env.TELEMETRY_URL ?? '';
  const telemetryToken =
    process.env.TELEMETRY_AGENTIC_VERIFICATION_WEBHOOK_TOKEN ?? process.env.TELEMETRY_TOKEN ?? '';
  if (!telemetryUrl || !telemetryToken) {
    console.log('telemetry webhook not configured — skipping');
    return;
  }

  const resultPath = resolve(args.result);
  if (!existsSync(resultPath)) {
    console.log('no verify-result.json — skipping telemetry');
    return;
  }

  let result: any;
  try {
    result = JSON.parse(readFileSync(resultPath, 'utf-8'));
  } catch (err: any) {
    console.error('[append-telemetry] invalid verify-result.json:', err?.message ?? err);
    return;
  }

  // Scan all dispatch-response.json / evidence-check-response.json under the
  // provided dispatch dirs.
  const dispatches: DispatchSummary[] = [];
  for (const dir of args.dispatchDirs) {
    const resolved = resolve(dir);
    if (!existsSync(resolved)) continue;
    const files = walkFiles(
      resolved,
      (name) => name === 'dispatch-response.json' || name === 'evidence-check-response.json'
    );
    files.sort();
    for (const f of files) {
      try {
        const payload = JSON.parse(readFileSync(f, 'utf-8'));
        dispatches.push(summarizeDispatch(payload));
      } catch {
        /* ignore malformed dispatch file */
      }
    }
  }

  const totals = dispatches.reduce(
    (acc, d) => ({
      input_tokens: acc.input_tokens + d.inputTokens,
      output_tokens: acc.output_tokens + d.outputTokens,
      cache_read_tokens: acc.cache_read_tokens + d.cacheReadTokens,
      cache_write_tokens: acc.cache_write_tokens + d.cacheWrite5mTokens + d.cacheWrite1hTokens,
      cost_usd: acc.cost_usd + dispatchCostUsd(d),
      dispatch_count: acc.dispatch_count + 1,
    }),
    {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0,
      dispatch_count: 0,
    }
  );

  const payload = {
    token: telemetryToken,
    run_id: args.runId,
    pr_number: args.pr,
    verdict: String(result.verdict ?? ''),
    target: String(result.template ?? 'n/a'),
    evidence_verdict: String(result.evidenceVerdict ?? 'n/a'),
    evidence_retry: String(result.evidenceRetry ?? false),
    unit_tests_ran: String(result.unitTests?.ran ?? false),
    unit_tests_passed: String(result.unitTests?.passed ?? 'n/a'),
    duration_ms: String(result.durations?.totalMs ?? 0),
    input_tokens: String(totals.input_tokens),
    output_tokens: String(totals.output_tokens),
    cache_read_tokens: String(totals.cache_read_tokens),
    cache_write_tokens: String(totals.cache_write_tokens),
    cost_usd: (Math.round(totals.cost_usd * 1_000_000) / 1_000_000).toFixed(6),
    dispatch_count: String(totals.dispatch_count),
    dispatches: dispatches.map((d) => ({
      model: d.model,
      inputTokens: d.inputTokens,
      outputTokens: d.outputTokens,
      cacheWrite5mTokens: d.cacheWrite5mTokens,
      cacheWrite1hTokens: d.cacheWrite1hTokens,
      cacheReadTokens: d.cacheReadTokens,
    })),
    timestamp: String(result.createdAt ?? new Date().toISOString()),
  };

  // Redact token before logging the payload. The token rides in the JSON body
  // (Apps Script doPost cannot read Authorization headers), but it must never
  // appear in workflow logs.
  const { token: _redacted, ...loggable } = payload;
  console.log('telemetry payload:', JSON.stringify(loggable));

  const cfgDir = args.curlCfg
    ? resolve(args.curlCfg).split(sep).slice(0, -1).join(sep)
    : mkdtempSync(join(tmpdir(), 'verify-telemetry-'));
  const cfgPath = args.curlCfg ? resolve(args.curlCfg) : join(cfgDir, 'curl-cfg');

  // Telemetry is a non-authoritative side-channel: a sink hiccup (non-JSON
  // response, `ok !== true`, transport failure) must NOT gate the verify
  // verdict. On any DELIVERY failure we warn loudly and return so the
  // process exits 0. exit(1) is reserved exclusively for genuine misuse
  // (bad argv / missing required args) handled at the isMain entrypoint.
  let response: string;
  try {
    response = curlPost(telemetryUrl, JSON.stringify(payload), cfgPath);
  } catch (err: any) {
    console.warn(
      '[append-telemetry] telemetry delivery failed (non-blocking):',
      err?.message ?? err
    );
    return;
  }
  console.log('telemetry response:', response);
  let parsed: any;
  try {
    parsed = JSON.parse(response);
  } catch {
    console.warn('[append-telemetry] non-JSON response (non-blocking):', response);
    return;
  }
  if (parsed?.ok !== true) {
    console.warn('[append-telemetry] telemetry rejected (non-blocking):', response);
    return;
  }
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    main(parseCliArgs(process.argv.slice(2)));
  } catch (err: any) {
    console.error('[append-telemetry] error:', err?.message ?? err);
    process.exit(1);
  }
}
