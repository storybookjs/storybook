/**
 * MVC Assessment CLI.
 *
 * Usage: node scripts/sustainability/assess-mvc.ts <pr> [options]
 * See `docs/superpowers/specs/2026-06-10-mvc-assessment-script-design.md` for the full design.
 */
import { Command, Option } from 'commander';
import pc from 'picocolors';

import { checkDuplicate, githubDuplicateLookup } from './assess-mvc/checks/duplicate.ts';
import { checkHumanMonitored } from './assess-mvc/checks/human-monitored.ts';
import { MANAGED_LABELS, MARKER, VERDICT_LABELS } from './assess-mvc/config.ts';
import { createGithubClient, requireToken, type GithubClient } from './assess-mvc/github/client.ts';
import { resolveLinkedIssues } from './assess-mvc/github/linked-issues.ts';
import { fetchPr, parsePrArg } from './assess-mvc/github/pr.ts';
import { githubTeamMembership } from './assess-mvc/github/teams.ts';
import { renderSummary } from './assess-mvc/output.ts';
import { evaluateSkip } from './assess-mvc/skip-rules.ts';
import type { CheckId, CheckResult, PrContext } from './assess-mvc/types.ts';
import { computeVerdict, isEarlyAbort } from './assess-mvc/verdict.ts';

export type Model = 'sonnet-4.6' | 'opus-4.6' | 'haiku-4.5';
export type Effort = 'low' | 'medium' | 'high' | 'max';

export interface Flags {
  dryRun: boolean;
  dismissPrevious: boolean;
  skipInternalPrs: boolean;
  model: Model;
  effort: Effort;
  verbose: boolean;
}

export interface AssessDeps {
  fetchPrContext(coords: { owner: string; repo: string; number: number }): Promise<PrContext>;
  duplicateLookup: (issue: { owner: string; repo: string; number: number }) => Promise<{
    crossRefs: any[];
    timeline: any[];
  }>;
  isMaintainer(login: string): Promise<boolean>;
  llmJudge(id: CheckId, ctx: PrContext): Promise<CheckResult>;
  synthesizeReview(input: {
    pr: PrContext;
    results: CheckResult[];
    earlyAbort: boolean;
  }): Promise<string>;
  writes: {
    addLabels(labels: string[]): Promise<void>;
    removeLabels(labels: string[]): Promise<void>;
    submitReview(input: { event: 'COMMENT' | 'REQUEST_CHANGES'; body: string }): Promise<void>;
    dismissPriorReviews(): Promise<void>;
  };
}

export interface RunInput {
  coords: { owner: string; repo: string; number: number };
  flags: Flags;
  deps: AssessDeps;
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

export async function runAssessment(input: RunInput): Promise<RunResult> {
  const ctx = await input.deps.fetchPrContext(input.coords);

  const det: CheckResult[] = [];
  det.push(checkHumanMonitored(ctx.labels));
  det.push(await checkDuplicate(ctx.number, ctx.linkedIssues, input.deps.duplicateLookup));

  const earlyAbort = isEarlyAbort(det);

  const llm: CheckResult[] = earlyAbort
    ? LLM_IDS.map((id) => ({
        id,
        status: 'deferred' as const,
        evidence: 'Skipped due to early-abort.',
      }))
    : await Promise.all(LLM_IDS.map((id) => input.deps.llmJudge(id, ctx)));

  const results: CheckResult[] = [...det, ...llm];
  const verdict = computeVerdict(results);
  const reviewBody = await input.deps.synthesizeReview({ pr: ctx, results, earlyAbort });
  const { labelsToAdd, labelsToRemove } = diffLabels(ctx.labels, verdict);

  if (!input.flags.dryRun) {
    if (input.flags.dismissPrevious) await input.deps.writes.dismissPriorReviews();
    if (labelsToRemove.length > 0) await input.deps.writes.removeLabels(labelsToRemove);
    if (labelsToAdd.length > 0) await input.deps.writes.addLabels(labelsToAdd);
    await input.deps.writes.submitReview({
      event: verdict === 'fail' ? 'REQUEST_CHANGES' : 'COMMENT',
      body: reviewBody,
    });
  }

  return {
    verdict,
    results,
    earlyAbort,
    reviewBody,
    labelsToAdd,
    labelsToRemove,
    prSummary: { number: ctx.number, title: ctx.title, author: ctx.author, url: ctx.url },
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

function buildDeps(client: GithubClient): AssessDeps {
  return {
    async fetchPrContext(coords) {
      const partial = await fetchPr(client, coords);
      const { issues, broken } = await resolveLinkedIssues(client, {
        owner: coords.owner,
        repo: coords.repo,
        number: coords.number,
        body: partial.body,
      });
      return { ...partial, linkedIssues: issues, brokenLinkRefs: broken };
    },
    duplicateLookup: githubDuplicateLookup(client),
    isMaintainer: githubTeamMembership(client).isMaintainer,
    async llmJudge(id) {
      return { id, status: 'deferred', evidence: 'LLM phase not yet wired (Phase 2).' };
    },
    async synthesizeReview({ results, earlyAbort }) {
      const lines = [
        MARKER,
        '## MVC Assessment',
        earlyAbort ? '> Early-abort: deterministic checks gated the LLM phase.' : '',
        '',
        ...results.map((r) => `- **${r.id}** — ${r.status.toUpperCase()}: ${r.evidence}`),
      ].filter(Boolean);
      return lines.join('\n');
    },
    writes: {
      async addLabels() {},
      async removeLabels() {},
      async submitReview() {},
      async dismissPriorReviews() {},
    },
  };
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
  const opts = program.opts<{
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
  const flags: Flags = {
    dryRun: opts.dryRun,
    dismissPrevious: opts.dismissPrevious,
    skipInternalPrs: opts.skipInternalPrs,
    model: opts.model,
    effort: opts.effort,
    verbose: opts.verbose,
  };

  const deps = buildDeps(client);

  if (flags.skipInternalPrs) {
    const partial = await fetchPr(client, coords);
    const decision = await evaluateSkip(partial, {
      isMaintainer: githubTeamMembership(client).isMaintainer,
    });
    if (decision.skip) {
      console.log(pc.dim(`Skipped: ${decision.reason}`));
      process.exit(0);
    }
  }

  const result = await runAssessment({ coords, flags, deps });

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
      dryRun: flags.dryRun,
    })
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(pc.red(err.stack ?? err.message));
    process.exit(2);
  });
}
