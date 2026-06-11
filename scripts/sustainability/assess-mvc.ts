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
 *   1. Parse args; the GitHub and LLM clients are fetched lazily.
 *   2. Evaluate skip rules. `--force` bypasses them entirely; `--reassess`
 *      re-runs on PRs that already have a verdict label.
 *   3. Fetch PR + linked issues into a single `PrContext`.
 *   4. Run the deterministic phase (Checks 1 + 3). If either fails, the LLM
 *      phase is skipped and the review body lists the not-performed checks.
 *   5. Run the four LLM-judged checks in parallel.
 *   6. Synthesize the final review body (one more LLM call).
 *   7. Apply writes when `--no-dry-run`: dismiss prior bot reviews (when
 *      `--dismiss-previous`), remove stale managed labels, add the verdict
 *      label, submit the review.
 *   8. Print the verdict.
 */
import * as p from '@clack/prompts';
import { Command, Option } from 'commander';
import pc from 'picocolors';

import { getGithubClient } from '../utils/github/client.ts';
import { addLabels, removeLabels } from '../utils/github/labels.ts';
import { resolveLinkedIssues } from '../utils/github/linked-issues.ts';
import { fetchPr, normalizeStorybookPr } from '../utils/github/pr.ts';
import { dismissPriorReviews, submitReview, type ReviewEvent } from '../utils/github/reviews.ts';
import { configureLlmClient, type Effort, type Model } from '../utils/llm/client.ts';
import {
  ASSESS_MVC_SCOPES,
  MANAGED_LABELS,
  MARKER,
  VERDICT_LABELS,
} from './assess-mvc/config.ts';
import { checkCostBenefit } from './assess-mvc/cost-benefit/check.ts';
import { computeAddedDependencies } from './assess-mvc/cost-benefit/utils/dependencies.ts';
import { computeDiffMetrics } from './assess-mvc/cost-benefit/utils/diff-metrics.ts';
import { checkDuplicate } from './assess-mvc/duplicate/check.ts';
import { checkExplainsHowToTest } from './assess-mvc/explains-test/check.ts';
import { checkHumanMonitored } from './assess-mvc/human-monitored/check.ts';
import { checkProvidesContext } from './assess-mvc/provides-context/check.ts';
import { checkRealProblem } from './assess-mvc/real-problem/check.ts';
import { evaluateSkip } from './assess-mvc/skip-rules.ts';
import { synthesizeReview } from './assess-mvc/synthesize.ts';
import type { CheckId, CheckResult, PrContext } from './assess-mvc/types.ts';
import { computeVerdict, isEarlyAbort } from './assess-mvc/verdict.ts';

export interface DeterministicPhaseResult {
  results: CheckResult[];
  earlyAbort: boolean;
}

export interface RunResult {
  verdict: 'pass' | 'fail';
  results: CheckResult[];
  earlyAbort: boolean;
  reviewBody: string;
  labelsToAdd: string[];
  labelsToRemove: string[];
}

const LLM_CHECK_IDS = [
  'real-problem',
  'cost-benefit',
  'explains-test',
  'provides-context',
] as const;

const CHECK_LABELS: Record<CheckId, string> = {
  human: 'Human-monitored',
  'real-problem': 'Real problem',
  duplicate: 'Not duplicate',
  'cost-benefit': 'Cost/benefit',
  'explains-test': 'Explains how to test',
  'provides-context': 'Provides context',
};

/**
 * Run the deterministic phase: Check 1 (human-monitored) and Check 3
 * (duplicate). If either FAILs, `earlyAbort` is true and the caller should
 * stub the LLM checks as deferred.
 */
export async function runDeterministicPhase(pr: PrContext): Promise<DeterministicPhaseResult> {
  const results: CheckResult[] = [];
  results.push(checkHumanMonitored(pr));
  results.push(await checkDuplicate(pr));
  return { results, earlyAbort: isEarlyAbort(results) };
}

/**
 * Run the LLM phase: Checks 2, 4, 5, 6 in parallel. When `earlyAbort` is
 * true, returns a deferred-status stub for each check without spending
 * tokens.
 */
export async function runLlmPhase(pr: PrContext, earlyAbort: boolean): Promise<CheckResult[]> {
  if (earlyAbort) {
    return LLM_CHECK_IDS.map((id) => ({
      id,
      status: 'deferred' as const,
      evidence: 'Skipped due to early-abort.',
    }));
  }
  return Promise.all([
    checkRealProblem(pr),
    checkCostBenefit(pr),
    checkExplainsHowToTest(pr),
    checkProvidesContext(pr),
  ]);
}

/**
 * Run the six-check pipeline against an already-fetched `PrContext` and
 * compose the review body. This function is pure: it never writes to GitHub.
 * The CLI (`main`) decides whether to apply the resulting labels and review
 * based on `--no-dry-run`.
 */
export async function runAssessment(pr: PrContext): Promise<RunResult> {
  const det = await runDeterministicPhase(pr);
  const llmResults = await runLlmPhase(pr, det.earlyAbort);
  const results: CheckResult[] = [...det.results, ...llmResults];
  const verdict = computeVerdict(results);
  const reviewBody = await synthesizeReview({ results, earlyAbort: det.earlyAbort });
  const { labelsToAdd, labelsToRemove } = diffLabels(pr.labels, verdict);
  return {
    verdict,
    results,
    earlyAbort: det.earlyAbort,
    reviewBody,
    labelsToAdd,
    labelsToRemove,
  };
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

function summariseStatuses(results: CheckResult[]): string {
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return Object.entries(counts)
    .map(([status, n]) => `${n} ${status}`)
    .join(', ');
}

function logCheckResult(result: CheckResult): void {
  const label = CHECK_LABELS[result.id];
  const line = `${pc.bold(label)} · ${result.evidence}`;
  switch (result.status) {
    case 'pass':
      p.log.success(line);
      break;
    case 'fail':
      p.log.error(line);
      break;
    case 'warn':
      p.log.warn(line);
      break;
    case 'deferred':
      p.log.step(pc.dim(line));
      break;
  }
}

async function applyWrites(
  pr: PrContext,
  result: RunResult,
  flags: { dismissPrevious: boolean }
): Promise<void> {
  const event: ReviewEvent = result.verdict === 'fail' ? 'REQUEST_CHANGES' : 'COMMENT';

  if (flags.dismissPrevious) {
    const s = p.spinner();
    s.start('Dismissing prior bot reviews');
    await dismissPriorReviews(pr, MARKER);
    s.stop('Prior bot reviews dismissed');
  }

  if (result.labelsToRemove.length > 0) {
    const s = p.spinner();
    s.start(`Removing labels: ${result.labelsToRemove.join(', ')}`);
    await removeLabels(pr, result.labelsToRemove);
    s.stop(`Removed: ${pc.red(result.labelsToRemove.join(', '))}`);
  }

  if (result.labelsToAdd.length > 0) {
    const s = p.spinner();
    s.start(`Adding labels: ${result.labelsToAdd.join(', ')}`);
    await addLabels(pr, result.labelsToAdd);
    s.stop(`Added: ${pc.green(result.labelsToAdd.join(', '))}`);
  }

  const reviewSpinner = p.spinner();
  reviewSpinner.start(`Submitting ${event} review`);
  await submitReview(pr, { event, body: result.reviewBody });
  reviewSpinner.stop(`Review submitted as ${pc.bold(event)}`);
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('assess-mvc')
    .description('Assess a Storybook PR against the six MVC criteria.')
    .argument('<pr>', 'PR number or GitHub URL')
    // TODO: remove --no-dry-run and make --dry-run false by default
    .option('--dry-run', 'Print what would happen; never modify GitHub.', true)
    .option('--no-dry-run', 'Apply changes (labels + review).')
    .option('--dismiss-previous', 'Dismiss prior bot reviews before posting.', false)
    .option('--force', 'Assess ineligible PRs (drafts, maintainer-made, `mvc:skip`).', false)
    .option('--reassess', 'Reassess PRs with a `mvc:failed` or `mvc:success` label.', false)
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
    force: boolean;
    reassess: boolean;
    model: Model;
    effort: Effort;
    verbose: boolean;
  }>();

  const prId = normalizeStorybookPr(arg);

  p.intro(pc.bgCyan(pc.black(` MVC Assessment — #${prId.number} `)));

  const credSpinner = p.spinner();
  credSpinner.start('Validating credentials');
  getGithubClient(ASSESS_MVC_SCOPES);
  configureLlmClient({
    model: cliOpts.model,
    effort: cliOpts.effort,
    verbose: cliOpts.verbose,
  });
  credSpinner.stop(`Credentials OK · model ${cliOpts.model} · effort ${cliOpts.effort}`);

  const fetchSpinner = p.spinner();
  fetchSpinner.start('Fetching PR');
  const partial = await fetchPr(prId);
  fetchSpinner.stop(`Fetched: ${pc.bold(partial.title)} by @${partial.author}`);

  p.log.info(`URL: ${partial.url}`);
  const statusTag = partial.isDraft ? pc.yellow('draft') : pc.green('open');
  p.log.info(
    `${statusTag} · ${partial.files.length} file(s) · head ${pc.dim(partial.headSha.slice(0, 8))}`
  );
  p.log.info(
    `Labels: ${partial.labels.length > 0 ? partial.labels.join(', ') : pc.dim('(none)')}`
  );
  const diffMetrics = computeDiffMetrics(partial.files);
  p.log.info(
    `Diff: ${pc.bold(`+${diffMetrics.added}/-${diffMetrics.removed}`)} (net ${diffMetrics.net} LOC)`
  );
  const addedDeps = computeAddedDependencies(partial.files);
  if (addedDeps.length > 0) {
    const preview = addedDeps.slice(0, 5).join(', ');
    const extra = addedDeps.length > 5 ? `, +${addedDeps.length - 5} more` : '';
    p.log.info(`New deps (${addedDeps.length}): ${preview}${extra}`);
  }

  const skipSpinner = p.spinner();
  skipSpinner.start('Evaluating skip rules');
  const decision = await evaluateSkip(partial, {
    force: cliOpts.force,
    reassess: cliOpts.reassess,
  });
  if (decision.skip) {
    skipSpinner.stop(`Skipped: ${decision.reason}`);
    p.outro(pc.dim('No assessment performed.'));
    process.exit(0);
  }
  const flagNote = cliOpts.force
    ? ' (--force; skip rules bypassed)'
    : cliOpts.reassess
      ? ' (--reassess; prior verdict ignored)'
      : '';
  skipSpinner.stop(`Eligible for assessment${flagNote}`);

  const issuesSpinner = p.spinner();
  issuesSpinner.start('Resolving linked issues');
  const { issues, broken } = await resolveLinkedIssues({
    ...prId,
    body: partial.body,
  });
  const brokenSuffix = broken.length > 0 ? `, ${broken.length} broken ref(s)` : '';
  issuesSpinner.stop(`Resolved ${issues.length} issue(s)${brokenSuffix}`);
  for (const issue of issues) {
    const src = issue.sources?.join('+') ?? 'unknown';
    const ref = pc.cyan(`${issue.owner}/${issue.repo}#${issue.number}`);
    const stateTag = issue.state === 'open' ? pc.green(issue.state) : pc.dim(issue.state);
    p.log.info(`${ref} ${pc.dim(`[${src}]`)} · ${stateTag} · ${issue.title}`);
  }
  for (const ref of broken) {
    p.log.warn(`Broken ref: ${ref}`);
  }
  const pr: PrContext = { ...partial, linkedIssues: issues, brokenLinkRefs: broken };

  const detSpinner = p.spinner();
  detSpinner.start('Deterministic checks (1 human-monitored, 3 duplicate)');
  const det = await runDeterministicPhase(pr);
  detSpinner.stop(`Deterministic: ${summariseStatuses(det.results)}`);
  for (const r of det.results) logCheckResult(r);

  const humanResult = det.results.find((r) => r.id === 'human');
  if (humanResult?.status === 'deferred') {
    p.outro(pc.dim(`Deferred: ${humanResult.evidence}`));
    process.exit(0);
  }

  const llmSpinner = p.spinner();
  llmSpinner.start(
    det.earlyAbort
      ? 'LLM phase skipped (early-abort on deterministic FAIL)'
      : 'LLM checks (2 real-problem, 4 cost/benefit, 5 explains-test, 6 provides-context)'
  );
  const llmResults = await runLlmPhase(pr, det.earlyAbort);
  llmSpinner.stop(`LLM: ${summariseStatuses(llmResults)}`);
  if (!det.earlyAbort) {
    for (const r of llmResults) logCheckResult(r);
  }

  const synthSpinner = p.spinner();
  synthSpinner.start('Composing review body');
  const results: CheckResult[] = [...det.results, ...llmResults];
  const verdict = computeVerdict(results);
  const reviewBody = await synthesizeReview({ results, earlyAbort: det.earlyAbort });
  const { labelsToAdd, labelsToRemove } = diffLabels(pr.labels, verdict);
  synthSpinner.stop('Review body composed');

  const runResult: RunResult = {
    verdict,
    results,
    earlyAbort: det.earlyAbort,
    reviewBody,
    labelsToAdd,
    labelsToRemove,
  };

  if (cliOpts.dryRun) {
    if (labelsToRemove.length > 0) {
      p.log.info(`Labels to remove: ${pc.red(labelsToRemove.join(', '))}`);
    }
    if (labelsToAdd.length > 0) {
      p.log.info(`Labels to add: ${pc.green(labelsToAdd.join(', '))}`);
    }
    p.note(reviewBody, 'Review body (dry-run)');
  } else {
    await applyWrites(pr, runResult, { dismissPrevious: cliOpts.dismissPrevious });
    p.note(reviewBody, 'Review body (submitted)');
  }

  const verdictLine =
    verdict === 'pass'
      ? pc.green('Verdict: PASS')
      : pc.red(`Verdict: FAIL${det.earlyAbort ? ' (early-abort)' : ''}`);
  p.outro(verdictLine);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error(pc.red(msg));
    process.exit(1);
  });
}
