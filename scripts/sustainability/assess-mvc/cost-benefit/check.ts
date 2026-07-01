import { z } from 'zod';

import { getIssueOrPrComments, getUniqueParticipants } from '../../../utils/github/comments.ts';
import { getMostSevereLabel } from '../../../utils/github/labels.ts';
import { listMaintainerLogins } from '../../../utils/github/teams.ts';
import { getLlmClient } from '../../../utils/llm/client.ts';
import type { CheckResult, PrContext } from '../types.ts';
import { computeDependencyDiff, type DependencyDiff } from './utils/dependencies.ts';
import { computeDiffMetrics } from './utils/diff-metrics.ts';

const Schema = z.object({
  verdict: z.enum(['pass', 'warn', 'fail']),
  reasoning: z.string(),
});

/**
 * PURPOSE: Every PR adds maintenance surface (review, runtime cost, future
 * breakage). A PR that costs 500 LOC for an edge-case issue is a poor trade;
 * the same 500 LOC for a S1 bug touching most users is obvious. This check
 * pre-assesses the cost/benefit trade-off to flag potentially unmaintainable
 * code early.
 *
 * TYPE: Deterministic precomputes + LLM.
 *
 * PRECOMPUTES:
 * - Diff size (net LOC, files changed)
 * - Dependency change diff
 * - Linked-issue severity label and reaction count as benefit signals
 * - External-participant count aggregated across every linked issue AND the
 *   PR's own issue-comments — commenters who are NOT the issue/PR author,
 *   NOT a maintainer, and NOT a bot. Measures how many independent users
 *   engaged with this work.
 *
 * OUTCOME: The LLM weighs cost against benefit with a bias toward leniency
 * — FAIL only on clear mismatch, WARN under uncertainty, PASS otherwise.
 */
export async function checkCostBenefit(pr: PrContext): Promise<CheckResult> {
  const diffMetrics = computeDiffMetrics(pr.files);
  const deps = computeDependencyDiff(pr.files);

  const firstIssue = pr.linkedIssues.find((i) => i.state === 'open');
  const severity = firstIssue ? getMostSevereLabel(firstIssue) : getMostSevereLabel(pr);
  const reactions = firstIssue?.reactions;

  const externalParticipantCount = await countExternalParticipants(pr);

  const prompt = buildPrompt({
    body: pr.body,
    diffMetrics,
    deps,
    severity,
    reactions,
    externalParticipantCount,
    hasLinkedIssue: Boolean(firstIssue),
  });
  const j = await getLlmClient().judge(prompt, Schema);

  return {
    id: 'cost-benefit',
    status: j.verdict,
    evidence: `${j.verdict.toUpperCase()}: ${j.reasoning}`,
    guidance:
      j.verdict === 'fail'
        ? 'Consider splitting the PR, narrowing to the core issue, or shipping your proposed change in an addon outside the monorepo.'
        : undefined,
  };
}

/**
 * Union of external participants across every linked issue and the PR's own
 * issue-comments (not review comments — those are almost entirely
 * maintainer triage noise). "External" excludes maintainers and bots
 * globally, and each item's OWN author locally: the PR author is filtered
 * from PR comments, and each linked issue's author is filtered from that
 * issue's comments. An issue author who comments on a different linked
 * issue (or on the PR) still counts — they're an independent voice on the
 * bug outside their own thread.
 */
async function countExternalParticipants(pr: PrContext): Promise<number> {
  const issues = [pr, ...pr.linkedIssues];

  const [maintainers, ...commentSets] = await Promise.all([
    listMaintainerLogins(),
    ...issues.map(async (item) => ({
      author: item.author,
      comments: await getIssueOrPrComments(item),
    })),
  ]);

  const external = new Set<string>();
  for (const set of commentSets) {
    for (const login of getUniqueParticipants(set.comments, [...maintainers, set.author])) {
      external.add(login);
    }
  }
  return external.size;
}

function describeDeps(deps: DependencyDiff): string {
  const parts: string[] = [];
  if (deps.added.length > 0) {
    parts.push(`added: ${deps.added.join(', ')}`);
  }
  if (deps.removed.length > 0) {
    parts.push(`removed: ${deps.removed.join(', ')}`);
  }
  if (parts.length === 0) {
    return '(no dependency changes)';
  }
  const sign = deps.delta > 0 ? '+' : '';
  parts.push(`net delta: ${sign}${deps.delta}`);
  return parts.join(' · ');
}

function buildPrompt(input: {
  body: string;
  diffMetrics: ReturnType<typeof computeDiffMetrics>;
  deps: DependencyDiff;
  severity: string | null;
  reactions?: {
    total_count: number;
    '+1': number;
    '-1': number;
    laugh: number;
    confused: number;
    heart: number;
    hooray: number;
    eyes: number;
    rocket: number;
  };
  externalParticipantCount: number;
  hasLinkedIssue: boolean;
}): string {
  return [
    'You are reviewing a Storybook pull request to judge if it is a viable external contribution. You will decide how much benefit the PR provides relative to its maintenance cost.',
    'FAIL requires CLEAR evidence of mismatch. Default to WARN under uncertainty. Default to PASS for small changes.',
    'Fixes for high severity issues can incur more maintenance cost. Fixes to edge-case problems that affect few users warrant a stricter maintenance ceiling.',
    '',
    'Small code changes are not automatically self-evident: a feature flag flip or one-line tweak in a central file can have major impact and still be a poor trade-off for maintainers.',
    '',
    "Removal of public APIs that weren't already deprecated has a high maintenance cost as it will cause breaking changes.",
    '',
    'IMPORTANT framing for dependency changes:',
    '  - A net-positive dep delta is a maintenance COST (more surface to audit, update, secure).',
    '  - A net-negative dep delta is often a BENEFIT — a PR that drops legacy or vulnerable',
    '    transitive deps is doing maintenance work for us, not adding cost.',
    '  - When the PR body explicitly justifies dep changes (e.g., "removes dependency X because of',
    '    CVE-Y", "consolidates on shared util Z"), give the author credit and weight that as a',
    '    benefit signal regardless of diff size.',
    '',
    `Diff: +${input.diffMetrics.added}/-${input.diffMetrics.removed} (net ${input.diffMetrics.net}) across ${input.diffMetrics.filesChanged} files.`,
    `Dependencies: ${describeDeps(input.deps)}`,
    '',
    `Linked-issue severity: ${input.severity ?? '(none)'}`,
    `Reactions: +${input.reactions?.['+1'] ?? 0} -${input.reactions?.['-1'] ?? 0} laugh=${input.reactions?.laugh ?? 0} confused=${input.reactions?.confused ?? 0} heart=${input.reactions?.heart ?? 0} hooray=${input.reactions?.hooray ?? 0} eyes=${input.reactions?.eyes ?? 0} rocket=${input.reactions?.rocket ?? 0} total=${input.reactions?.total_count ?? 0}`,
    `External participants (unique commenters across every linked issue and this PR, excluding the PR/issue authors, maintainers, and bots): ${input.externalParticipantCount}. Treat a high count as strong popularity evidence — multiple independent users engaged with this work is a clear benefit signal.`,
    '',
    'PR body (look for change rationale, security mentions, refactor explanations):',
    input.body || '(empty)',
    '',
    'Return JSON: { verdict: "pass"|"warn"|"fail", reasoning: "one short sentence" }',
  ].join('\n');
}
