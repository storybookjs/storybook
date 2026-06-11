/**
 * MVC Assessment CLI.
 *
 * Usage: node scripts/sustainability/assess-mvc.ts <pr> [options]
 *
 * Assesses a Storybook PR against the six MVC (Minimum Viable Contribution)
 * criteria and either coaches the author toward MVC status or blocks the PR
 * until it qualifies. The CLI is the first automated entry point for
 * community PRs: it runs before verification, before completion, and before a
 * human maintainer looks at the PR.
 *
 * Flow:
 *   1. Parse args, resolve GitHub token, create octokit clients.
 *   2. Optionally short-circuit on skip rules (drafts, prior verdict labels,
 *      `mvc:skip`, maintainer-team authorship) when `--skip-internal-prs`.
 *   3. Fetch PR + linked issues into a single `PrContext`.
 *   4. Run the deterministic checks (Check 1: human-monitored; Check 3:
 *      duplicate). If either fails, the LLM phase is skipped — see the
 *      "early-abort" handling in `runAssessment`.
 *   5. Run the four LLM-judged checks (real problem, cost/benefit, explains-
 *      how-to-test, provides-context) — Phase 1 returns `deferred` placeholders.
 *   6. Compose the review body (Phase 1 stub) and compute label diff.
 *   7. Apply writes (only with `--no-dry-run`; Phase 1 elides writes entirely).
 *   8. Print the summary table to stdout.
 *
 * See `docs/superpowers/specs/2026-06-10-mvc-assessment-script-design.md` and
 * `docs/superpowers/plans/2026-06-11-mvc-assessment-script.md`.
 */
import { Command, Option } from 'commander';
import pc from 'picocolors';

import {
  createGithubClient,
  requireToken,
  type GithubClient,
} from '../utils/github/client.ts';
import { ORG } from '../utils/github/constants.ts';
import { resolveLinkedIssues } from '../utils/github/linked-issues.ts';
import { fetchPr, parsePrArg } from '../utils/github/pr.ts';
import { teamMembership } from '../utils/github/teams.ts';
import { checkDuplicate } from './assess-mvc/checks/duplicate.ts';
import { checkHumanMonitored } from './assess-mvc/checks/human-monitored.ts';
import {
  MAINTAINER_TEAM_SLUGS,
  MANAGED_LABELS,
  MARKER,
  VERDICT_LABELS,
} from './assess-mvc/config.ts';
import { renderSummary } from './assess-mvc/output.ts';
import { evaluateSkip } from './assess-mvc/skip-rules.ts';
import type { CheckId, CheckResult, PrContext } from './assess-mvc/types.ts';
import { computeVerdict, isEarlyAbort } from './assess-mvc/verdict.ts';

export type Model = 'sonnet-4.6' | 'opus-4.6' | 'haiku-4.5';
export type Effort = 'low' | 'medium' | 'high' | 'max';

/**
 * Runtime capabilities + flags every check function consumes. `client` is the
 * GitHub API client; `llm` will be added when Phase 2 lands. Other fields are
 * pure CLI flags.
 */
export interface RunOpts {
  client: GithubClient;
  dryRun: boolean;
  dismissPrevious: boolean;
  model: Model;
  effort: Effort;
  verbose: boolean;
}

export interface PrSummary {
  number: number;
  title: string;
  author: string;
  url: string;
}

export interface RunResult {
  verdict: 'pass' | 'fail';
  results: CheckResult[];
  earlyAbort: boolean;
  reviewBody: string;
  labelsToAdd: string[];
  labelsToRemove: string[];
  prSummary: PrSummary;
}

const LLM_IDS: CheckId[] = ['real-problem', 'cost-benefit', 'explains-test', 'provides-context'];

/**
 * Run the six-check pipeline against an already-fetched PrContext.
 *
 * Pure-ish: side effects (label writes, review submission) only fire when
 * `opts.dryRun` is false. Phase 1 stubs the LLM checks to `deferred` and elides
 * all write paths (Phase 3 wires them).
 */
export async function runAssessment(pr: PrContext, opts: RunOpts): Promise<RunResult> {
  const det: CheckResult[] = [];
  det.push(checkHumanMonitored(pr));
  det.push(await checkDuplicate(pr, { client: opts.client }));

  const earlyAbort = isEarlyAbort(det);

  const llm: CheckResult[] = earlyAbort
    ? LLM_IDS.map((id) => ({
        id,
        status: 'deferred' as const,
        evidence: 'Skipped due to early-abort.',
      }))
    : LLM_IDS.map((id) => ({
        id,
        status: 'deferred' as const,
        evidence: 'LLM phase not yet wired (Phase 2).',
      }));

  const results: CheckResult[] = [...det, ...llm];
  const verdict = computeVerdict(results);
  const reviewBody = composeStubReview(results, earlyAbort);
  const { labelsToAdd, labelsToRemove } = diffLabels(pr.labels, verdict);

  // Phase 3 will wire writes through `opts.client` here when !opts.dryRun.

  return {
    verdict,
    results,
    earlyAbort,
    reviewBody,
    labelsToAdd,
    labelsToRemove,
    prSummary: { number: pr.number, title: pr.title, author: pr.author, url: pr.url },
  };
}

function composeStubReview(results: CheckResult[], earlyAbort: boolean): string {
  const lines = [
    MARKER,
    '## MVC Assessment',
    earlyAbort ? '> Early-abort: deterministic checks gated the LLM phase.' : '',
    '',
    ...results.map((r) => `- **${r.id}** — ${r.status.toUpperCase()}: ${r.evidence}`),
  ].filter(Boolean);
  return lines.join('\n');
}

function diffLabels(
  current: string[],
  verdict: 'pass' | 'fail'
): { labelsToAdd: string[]; labelsToRemove: string[] } {
  const target = verdict === 'pass' ? VERDICT_LABELS.pass : VERDICT_LABELS.fail;
  const labelsToAdd = current.includes(target) ? [] : [target];
  const labelsToRemove = current.filter(
    (l) => (MANAGED_LABELS as readonly string[]).includes(l) && l !== target
  );
  return { labelsToAdd, labelsToRemove };
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('assess-mvc')
    .description('Assess a Storybook PR against the six MVC criteria.')
    .argument('<pr>', 'PR number or GitHub URL')
    .option('--dry-run', 'Print what would happen; never modify GitHub (default).', true)
    .option('--no-dry-run', 'Apply changes (labels + review).')
    .option('--dismiss-previous', 'Dismiss prior bot reviews before posting.', false)
    .option('--no-dismiss-previous', 'Do not dismiss prior bot reviews (default).')
    .option(
      '--skip-internal-prs',
      'Skip ineligible PRs (drafts, maintainer-authored, already labeled).',
      false
    )
    .option('--no-skip-internal-prs', 'Always assess, even ineligible PRs (default).')
    .addOption(
      new Option('--model <name>', 'Claude model')
        .choices(['sonnet-4.6', 'opus-4.6', 'haiku-4.5'])
        .default('sonnet-4.6')
    )
    .addOption(
      new Option('--effort <level>', 'Reasoning effort')
        .choices(['low', 'medium', 'high', 'max'])
        .default('medium')
    )
    .option('-v, --verbose', 'Print LLM input/output for debugging.', false);

  program.parse();
  const arg = program.args[0];
  const cliOpts = program.opts<{
    dryRun: boolean;
    dismissPrevious: boolean;
    skipInternalPrs: boolean;
    model: Model;
    effort: Effort;
    verbose: boolean;
  }>();

  let coords;
  try {
    coords = parsePrArg(arg);
  } catch (err: any) {
    console.error(pc.red(err.message));
    process.exit(1);
  }

  let token;
  try {
    token = requireToken();
  } catch (err: any) {
    console.error(pc.red(err.message));
    process.exit(1);
  }

  const client = createGithubClient(token);

  const partial = await fetchPr(client, coords);

  if (cliOpts.skipInternalPrs) {
    const decision = await evaluateSkip(partial, {
      isMaintainer: teamMembership(client, ORG, MAINTAINER_TEAM_SLUGS).isMaintainer,
    });
    if (decision.skip) {
      console.log(pc.dim(`Skipped: ${decision.reason}`));
      process.exit(0);
    }
  }

  const { issues, broken } = await resolveLinkedIssues(client, {
    owner: coords.owner,
    repo: coords.repo,
    number: coords.number,
    body: partial.body,
  });
  const pr: PrContext = { ...partial, linkedIssues: issues, brokenLinkRefs: broken };

  const opts: RunOpts = {
    client,
    dryRun: cliOpts.dryRun,
    dismissPrevious: cliOpts.dismissPrevious,
    model: cliOpts.model,
    effort: cliOpts.effort,
    verbose: cliOpts.verbose,
  };

  const result = await runAssessment(pr, opts);

  const humanResult = result.results.find((r) => r.id === 'human');
  if (humanResult?.status === 'deferred') {
    console.log(pc.dim(`Deferred: ${humanResult.evidence}`));
    process.exit(0);
  }

  console.log(
    renderSummary({
      pr: result.prSummary,
      verdict: result.verdict,
      results: result.results,
      reviewBody: result.reviewBody,
      labelsToAdd: result.labelsToAdd,
      labelsToRemove: result.labelsToRemove,
      dryRun: cliOpts.dryRun,
    })
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(pc.red(err.stack ?? err.message));
    process.exit(2);
  });
}
