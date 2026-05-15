// CI helper: reads verify-result.json, merges optional unit-test signal,
// derives regressionReason from playwright-report.json when missing, and
// writes the (possibly mutated) result back to the same path.
//
// Replaces the inline `Read verdict` bash step in
// `.github/workflows/verify-pr.yml`.
//
// Invocation:
//   node ./scripts/verify/ci/derive-verdict.ts \
//     --result <path-to-verify-result.json> \
//     [--report <path-to-playwright-report.json>] \
//     [--summary-out <path-to-step-summary>]
//
// Reads `GITHUB_STEP_SUMMARY` from env when `--summary-out` is omitted.
// Prints `verdict=<value>` lines to stdout for capture into
// `$GITHUB_OUTPUT`.

import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { ANSI_RE, verifyResultSignature } from '../core.ts';

interface VerifyResultShape {
  verdict?: string;
  regressionReason?: string;
  template?: string;
  unitTests?: {
    ran?: boolean;
    passed?: boolean | null;
    summary?: string;
    files?: string[];
    details?: string;
  };
  [k: string]: unknown;
}

interface Args {
  result: string;
  report?: string;
  summaryOut?: string;
}

function parseCliArgs(argv: string[]): Args {
  const { values } = parseArgs({
    args: argv,
    options: {
      result: { type: 'string' },
      report: { type: 'string' },
      'summary-out': { type: 'string' },
    },
    strict: true,
  });
  if (!values.result) {
    throw new Error('usage: derive-verdict --result <path> [--report <path>] [--summary-out <path>]');
  }
  return {
    result: values.result,
    report: values.report,
    summaryOut: values['summary-out'],
  };
}

function readJsonOrNull(p: string): any {
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function pickFailedTitles(report: any, limit = 3): string[] {
  const titles: string[] = [];
  const walk = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.errors) && node.errors.length > 0 && typeof node.title === 'string') {
      titles.push(node.title);
    }
    if (Array.isArray(node.suites)) node.suites.forEach(walk);
    if (Array.isArray(node.specs)) node.specs.forEach(walk);
    if (Array.isArray(node.tests)) node.tests.forEach(walk);
    if (Array.isArray(node.results)) node.results.forEach(walk);
  };
  walk(report);
  return Array.from(new Set(titles.filter((t) => t && t.length > 0))).slice(0, limit);
}

function pickFirstError(report: any): string {
  const stack: any[] = [report];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node.errors) && node.errors.length > 0) {
      const err = node.errors[0] ?? {};
      const msg = err.message ?? err.stack ?? '';
      if (typeof msg === 'string' && msg.length > 0) return msg;
    }
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) stack.push(...v);
      else if (v && typeof v === 'object') stack.push(v);
    }
  }
  return '';
}

export interface DeriveOutcome {
  verdict: string;
  changed: boolean;
  regressionReason?: string;
  template?: string;
}

export function deriveVerdict(
  result: VerifyResultShape | null,
  report: any | null
): { result: VerifyResultShape | null; outcome: DeriveOutcome } {
  if (!result) {
    return { result, outcome: { verdict: 'missing', changed: false } };
  }
  let changed = false;
  let verdict = String(result.verdict ?? '');

  // Fill in a regressionReason when Playwright failed but verify-pr
  // didn't populate one. Compile-failure stubs already set their own.
  if (verdict === 'regression' && !result.regressionReason && report) {
    const titles = pickFailedTitles(report);
    const errRaw = pickFirstError(report);
    const errClean = errRaw.replace(ANSI_RE, '').replace(/\n/g, ' ').slice(0, 400);
    const titleStr = titles.length > 0 ? titles.join('; ') : '?';
    if (errClean.length > 0 || titles.length > 0) {
      result.regressionReason = `Playwright assertion failed in: ${titleStr} — ${errClean}`;
      changed = true;
    }
  }

  // Compose final verdict from AND of Playwright + unit tests. Playwright
  // regression is authoritative. Playwright-verified + unit-tests-failed
  // downgrades to regression with a derived reason.
  const unitRan = result.unitTests?.ran === true;
  const unitPassed = result.unitTests?.passed === true;
  if (verdict === 'verified' && unitRan && !unitPassed && result.unitTests?.passed === false) {
    result.verdict = 'regression';
    result.regressionReason =
      result.regressionReason ?? 'PR-added unit tests failed (see unitTests.details)';
    verdict = 'regression';
    changed = true;
  }

  return {
    result,
    outcome: {
      verdict,
      changed,
      regressionReason: result.regressionReason,
      template: typeof result.template === 'string' ? result.template : undefined,
    },
  };
}

function writeSummaryLine(line: string, summaryOut: string | undefined): void {
  const target = summaryOut ?? process.env.GITHUB_STEP_SUMMARY;
  if (!target) return;
  try {
    appendFileSync(target, line + '\n', 'utf-8');
  } catch {
    /* ignore — summary is best-effort */
  }
}

function main(args: Args): void {
  const resultPath = resolve(args.result);
  const result = readJsonOrNull(resultPath) as VerifyResultShape | null;
  if (!result) {
    console.log('verdict=missing');
    return;
  }

  // C1 fix: HMAC verification gate. The orchestrator (verify-pr.ts) signs
  // a stable subset of verify-result.json fields with VERIFY_PROVENANCE_SECRET
  // and emits the signature to `<result>.sig`. If a PR-added recipe forges
  // verify-result.json from inside srt (`{"verdict":"verified"}`) without
  // knowing the secret, the .sig will be missing or stale and the
  // signature check fails here. We downgrade `verified` to `forgery-detected`.
  //
  // Tolerance: when verdict is already regression / skipped / missing the
  // unsigned path is accepted — those verdicts cannot grant the
  // `verified-by-harness` label, so there's no value-add to a forged
  // regression. (Future: tighten if we add more privileged side-effects.)
  const secret = process.env.VERIFY_PROVENANCE_SECRET;
  if (secret && String(result.verdict) === 'verified') {
    const sigPath = resultPath + '.sig';
    let signatureOk = false;
    if (existsSync(sigPath)) {
      try {
        const sig = readFileSync(sigPath, 'utf-8').trim();
        signatureOk = verifyResultSignature(result as Record<string, unknown>, sig, secret);
      } catch {
        signatureOk = false;
      }
    }
    if (!signatureOk) {
      result.verdict = 'regression';
      result.regressionReason =
        'forgery-detected: verify-result.json HMAC signature missing or invalid. ' +
        'The orchestrator either never wrote a signature or the file was modified ' +
        'after signing. Treating verdict as regression to prevent privileged ' +
        'side-effects (verified-by-harness label).';
      try {
        writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n', 'utf-8');
      } catch {
        /* best-effort persist */
      }
      console.error('[derive-verdict] HMAC mismatch — downgrading verdict to regression');
    }
  }

  const report = args.report && existsSync(args.report) ? readJsonOrNull(resolve(args.report)) : null;
  const { result: mutated, outcome } = deriveVerdict(result, report);
  if (outcome.changed && mutated) {
    writeFileSync(resultPath, JSON.stringify(mutated, null, 2) + '\n', 'utf-8');
  }
  console.log(`verdict=${outcome.verdict}`);
  writeSummaryLine(`verdict: ${outcome.verdict}`, args.summaryOut);
  writeSummaryLine(
    `target=${outcome.template ?? 'n/a'} regressionReason=${outcome.regressionReason ?? 'n/a'}`,
    args.summaryOut
  );
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    main(parseCliArgs(process.argv.slice(2)));
  } catch (err: any) {
    console.error('[derive-verdict] error:', err?.message ?? err);
    process.exit(1);
  }
}
