// CI helper: renders the PR-comment body for the Verify Harness.
//
// Extracted from the inline `actions/github-script` block previously embedded
// in `.github/workflows/verify-pr.yml` so the rendering logic is testable in
// isolation and the workflow stays slim.
//
// Invocation:
//   node ./scripts/verify/ci/render-pr-comment.ts \
//     --result <path-to-verify-result.json> \
//     --run-url <github-actions-run-url> \
//     [--urls-path <path-to-screenshot-urls.json>] \
//     [--output <path-to-write-body-to>]
//
// When --output is omitted the body is written to stdout. The caller's
// shell can pipe stdout to `gh pr comment --body-file -` or capture into
// a file and pass the path to `gh pr comment --body-file <path>`.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

interface Args {
  result: string;
  runUrl: string;
  urlsPath?: string;
  output?: string;
}

interface ScreenshotItem {
  rel: string;
  url: string;
}

interface VerdictShape {
  verdict?: string;
  template?: string;
  regressionReason?: string;
  regressionDetails?: string;
  evidenceVerdict?: string;
  evidenceReasoning?: string;
  evidenceModel?: string;
  evidenceRetry?: boolean;
  unitTests?: {
    ran?: boolean;
    passed?: boolean | null;
    summary?: string;
    files?: string[];
    details?: string;
  };
  recipeSpecPath?: string;
}

// Strip the provenance header block comment + import lines from an authored
// recipe so the PR comment shows only the meaningful validation logic (the
// `test(...)` body). Caps length and redacts token-shaped substrings — the
// recipe is PR-authored (untrusted) text.
function extractRecipeBody(specPath: string | undefined): string {
  if (!specPath || !existsSync(specPath)) return '';
  let src: string;
  try {
    src = readFileSync(specPath, 'utf-8');
  } catch {
    return '';
  }
  // Drop the leading /* … */ provenance header (only the first block).
  src = src.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
  const kept = src
    .split('\n')
    .filter((l) => !/^\s*import\s/.test(l) && !/^\s*\/\/\s/.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // Cap at ~2 KB so a pathological spec can't blow up the comment.
  return redact(kept).slice(0, 2000);
}

// UC4: redact token-shaped substrings before rendering. Pattern catches:
//   - prefixed API keys (Anthropic / OpenAI / GitHub PAT / AWS access key)
//   - Authorization-style "Bearer …" / "token …" / "key …" echoes
// applied to user-controlled fields (regressionReason, regressionDetails,
// vitest details) before they reach GitHub's markdown renderer.
const SECRET_RE =
  /(token|key|password|secret|bearer)[a-zA-Z0-9_-]+|sk-(ant|live|test)[a-zA-Z0-9_-]{20,}|gh[pousr]_[a-zA-Z0-9]{36,}|AKIA[A-Z0-9]{16}/gi;

function redact(text: string | undefined | null): string {
  if (text == null) return '';
  return String(text).replace(SECRET_RE, '[REDACTED]');
}

function parseCliArgs(argv: string[]): Args {
  const { values } = parseArgs({
    args: argv,
    options: {
      result: { type: 'string' },
      'run-url': { type: 'string' },
      'urls-path': { type: 'string' },
      output: { type: 'string' },
    },
    strict: true,
  });
  if (!values['run-url']) {
    throw new Error(
      'usage: render-pr-comment [--result <path>] --run-url <url> [--urls-path <path>] [--output <path>]'
    );
  }
  // --result intentionally optional: when the workflow short-circuits before
  // Verify PR runs (e.g. Generate bundle fails), steps.verify.outputs.result-path
  // is empty. main() renders the "No verdict produced" fallback in that case.
  return {
    result: values.result ?? '',
    runUrl: values['run-url'],
    urlsPath: values['urls-path'],
    output: values.output,
  };
}

function readScreenshotUrls(path?: string): ScreenshotItem[] {
  if (!path || !existsSync(path)) return [];
  try {
    const raw = readFileSync(path, 'utf-8').trim();
    if (!raw || raw === '[]') return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (it): it is ScreenshotItem =>
        it && typeof it === 'object' && typeof it.rel === 'string' && typeof it.url === 'string'
    );
  } catch {
    return [];
  }
}

function renderScreenshots(items: ScreenshotItem[]): string {
  if (items.length === 0) return '';
  const blocks = items.map((it) => `### \`${it.rel}\`\n\n![${it.rel}](${it.url})\n`);
  return `\n\n## Screenshots\n\n${blocks.join('\n')}`;
}

export function renderBody(
  verdict: VerdictShape | null,
  runUrl: string,
  screenshots: ScreenshotItem[],
  recipeBody = ''
): string {
  if (!verdict) {
    return `## Verify Harness\n\nNo verdict produced — the workflow failed before the harness ran (likely recipe-author dispatch, deny-regex, or lint). See [run log](${runUrl}) for details.`;
  }

  const retrySuffix = verdict.evidenceRetry ? ' (after 1 retry)' : '';
  const evidenceLine = verdict.evidenceVerdict
    ? `\n\nEvidence${retrySuffix} (vision-check, \`${verdict.evidenceModel ?? 'claude-haiku-4-5'}\`): \`${verdict.evidenceVerdict}\`${
        verdict.evidenceReasoning
          ? `\n\n<details><summary>Vision reasoning</summary>\n\n${verdict.evidenceReasoning}\n\n</details>`
          : ''
      }`
    : '';

  const detailsBlock = verdict.regressionDetails
    ? `\n\n<details><summary>Compile output (last 4KB)</summary>\n\n\`\`\`\n${redact(verdict.regressionDetails).slice(0, 4000)}\n\`\`\`\n\n</details>`
    : '';

  let unitTestsLine = '';
  if (verdict.unitTests && verdict.unitTests.ran) {
    const status = verdict.unitTests.passed ? '✅ passed' : '❌ failed';
    const filesList = (verdict.unitTests.files ?? []).map((f) => `\`${f}\``).join(', ');
    unitTestsLine = `\n\nPR-added unit tests: ${status} — ${verdict.unitTests.summary || ''}${filesList ? `\n\nFiles: ${filesList}` : ''}`;
    if (!verdict.unitTests.passed && verdict.unitTests.details) {
      unitTestsLine += `\n\n<details><summary>vitest output (last 4KB)</summary>\n\n\`\`\`\n${redact(verdict.unitTests.details).slice(0, 4000)}\n\`\`\`\n\n</details>`;
    }
  }

  const reasonLine = verdict.regressionReason
    ? `\n\nReason: \`${redact(verdict.regressionReason)}\``
    : '';

  const recipeBlock = recipeBody
    ? `\n\n<details><summary>How Playwright validated this</summary>\n\n\`\`\`ts\n${recipeBody}\n\`\`\`\n\n</details>`
    : '';

  return `## Verify Harness\n\nVerdict: \`${verdict.verdict}\` (target \`${verdict.template}\`)${reasonLine}${detailsBlock}${evidenceLine}${unitTestsLine}${recipeBlock}\n\nReplay: \`npx playwright show-trace\` on the trace.zip listed under "Artifacts" on the [run summary page](${runUrl}).${renderScreenshots(screenshots)}`;
}

function main(args: Args): void {
  let verdict: VerdictShape | null = null;
  if (args.result) {
    const resultPath = resolve(args.result);
    if (existsSync(resultPath)) {
      try {
        verdict = JSON.parse(readFileSync(resultPath, 'utf-8')) as VerdictShape;
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        const body = `## Verify Harness\n\nError reading verdict: \`${msg}\`. See [run log](${args.runUrl}).`;
        emit(body, args.output);
        return;
      }
    }
  }
  const screenshots = readScreenshotUrls(args.urlsPath);
  const recipeBody = extractRecipeBody(verdict?.recipeSpecPath);
  const body = renderBody(verdict, args.runUrl, screenshots, recipeBody);
  emit(body, args.output);
}

function emit(body: string, output?: string): void {
  if (output) {
    writeFileSync(resolve(output), body, 'utf-8');
  } else {
    process.stdout.write(body);
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
    console.error('[render-pr-comment] error:', err?.message ?? err);
    process.exit(1);
  }
}
