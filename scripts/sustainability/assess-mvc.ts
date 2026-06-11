/**
 * MVC Assessment CLI.
 *
 * Usage: node scripts/sustainability/assess-mvc.ts <pr> [options]
 *
 * Assesses a Storybook PR against the six MVC (Minimum Viable Contribution)
 * criteria and either coaches the author toward MVC status or blocks the PR
 * until it qualifies. The CLI is the first automated entry point for
 * community PRs: it runs before verification, before completion, and before
 * a human maintainer looks at the PR.
 *
 * Flow:
 *   1. Parse args; the GitHub client is fetched lazily via `getGithubClient`
 *      from anywhere it's needed. A missing token bubbles up as a thrown
 *      error which the top-level `main().catch` decorates.
 *   2. Optionally short-circuit on skip rules (drafts, prior verdict labels,
 *      `mvc:skip`, maintainer-team authorship) when `--skip-internal-prs`.
 *   3. Fetch PR + linked issues into a single `PrContext`.
 *   4. Run the deterministic checks (Check 1: human-monitored; Check 3:
 *      duplicate). If either fails, the LLM phase is skipped (see early-
 *      abort handling in `runAssessment`).
 *   5. Run the four LLM-judged checks — Phase 1 returns `deferred` stubs.
 *   6. Compose the review body (Phase 1 stub) and compute label diff.
 *   7. Apply writes (only with `--no-dry-run`; Phase 1 elides writes).
 *   8. Print the summary table.
 */
import { Command, Option } from 'commander';
import pc from 'picocolors';

import { ORG } from '../utils/github/constants.ts';
import { fetchPr, normalizeStorybookPr } from '../utils/github/pr.ts';
import { resolveLinkedIssues } from '../utils/github/linked-issues.ts';
import { teamMembership } from '../utils/github/teams.ts';
import { getGithubClient } from '../utils/github/client.ts';
import { checkDuplicate } from './assess-mvc/checks/duplicate.ts';
import { checkHumanMonitored } from './assess-mvc/checks/human-monitored.ts';
import {
  ASSESS_MVC_SCOPES,
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
 * Runtime flags consumed by `runAssessment`. The GitHub client is no longer
 * passed here — it's a process-wide singleton accessed via `getGithubClient`.
 */
export interface RunOpts {
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
 * Run the six-check pipeline against an already-fetched `PrContext`. Side
 * effects (label writes, review submission) only fire when `opts.dryRun` is
 * false. Phase 1 stubs the LLM checks to `deferred` and elides all write
 * paths (Phase 3 wires them).
 */
export async function runAssessment(pr: PrContext, opts: RunOpts): Promise<RunResult> {
  const det: CheckResult[] = [];
  det.push(checkHumanMonitored(pr));
  det.push(await checkDuplicate(pr));

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

  // Phase 3 will wire writes here when !opts.dryRun.

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

  const coords = normalizeStorybookPr(arg);

  // Eager-validate the token so a missing GH_TOKEN throws here (decorated by
  // the top-level catch) instead of inside a check halfway through the run.
  getGithubClient(ASSESS_MVC_SCOPES);

  const partial = await fetchPr(coords);

  if (cliOpts.skipInternalPrs) {
    const decision = await evaluateSkip(partial, {
      isMaintainer: teamMembership(ORG, MAINTAINER_TEAM_SLUGS).isMaintainer,
    });
    if (decision.skip) {
      console.log(pc.dim(`Skipped: ${decision.reason}`));
      process.exit(0);
    }
  }

  const { issues, broken } = await resolveLinkedIssues({
    owner: coords.owner,
    repo: coords.repo,
    number: coords.number,
    body: partial.body,
  });
  const pr: PrContext = { ...partial, linkedIssues: issues, brokenLinkRefs: broken };

  const opts: RunOpts = {
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
  main().catch((err: unknown) => {
    const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error(pc.red(msg));
    process.exit(1);
  });
}
