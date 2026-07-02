import { z } from 'zod';

import { getIssueOrPrComments, type IssueOrPrComment } from '../../../utils/github/comments.ts';
import { getPrReviews, type PrReview } from '../../../utils/github/reviews.ts';
import { listMaintainerLogins } from '../../../utils/github/teams.ts';
import { getLlmClient } from '../../../utils/llm/client.ts';
import type { CheckResult, Issue, PrContext } from '../types.ts';

const FEATURE_FITS = ['augments-api', 'popular-tech', 'quality-of-life', 'none'] as const;

const Schema = z.object({
  matchesIssue: z.boolean(),
  category: z.enum(['bug', 'feature', 'maintenance', 'docs', 'dependencies', 'other']),
  reasoning: z.string(),
  featureFit: z.enum(FEATURE_FITS).optional(),
});

/**
 * PURPOSE: A contribution must solve a tracked problem. A PR without a
 * linked open issue is either solving something we don't yet agree is a
 * problem (which is a discussion, not a contribution) or — more often — is a
 * drive-by attempt that the author can't articulate the value of. Either way,
 * the right next step isn't a code review.
 *
 * TYPE: Deterministic precomputes + LLM.
 *
 * PRECOMPUTES:
 * - Linked issues and their status
 * - PR issue-comments and PR reviews (with maintainer flags on each entry)
 * - Comments on every open linked issue (with maintainer flags on each entry)
 *
 * OUTCOME:
 * The LLM verifies:
 * - At least one linked issue exists and is open
 * - The PR substantively addresses the linked issue (LLM judgement)
 *
 * Then, when the LLM categorises the PR as a feature, we also require it to fit
 * one of three buckets — improves an existing API for addon/framework authors,
 * adds support for popular frameworks/tech, or is a quality-of-life improvement.
 *
 * Feature PRs that don't fit these buckets must have explicit evidence of
 * maintainer approval in the issue. This can take the form of a `rfc:accepted`
 * label or maintainer comment on the issue or PR, or PR review approval —
 * which the LLM can now spot directly because we surface every comment /
 * review with a `[maintainer]` marker on maintainer-authored entries.
 */
export async function checkRealProblem(pr: PrContext): Promise<CheckResult> {
  if (pr.linkedIssues.length === 0) {
    return {
      id: 'real-problem',
      status: 'fail',
      reasoning: 'No linked issue.',
      guidance:
        'Link an existing open issue this PR addresses. Without a linked issue, we cannot verify the change solves an actual problem our users experience.',
    };
  }
  const openIssues = pr.linkedIssues.filter((i) => i.state === 'open');
  if (openIssues.length === 0) {
    return {
      id: 'real-problem',
      status: 'fail',
      reasoning: 'All linked issues are closed.',
      guidance:
        'The linked issue is closed. If the problem regressed, please reopen it (or open a fresh one) and link that.',
    };
  }

  const [maintainers, prComments, prReviews, ...issueCommentLists] = await Promise.all([
    listMaintainerLogins(),
    getIssueOrPrComments({ owner: pr.owner, repo: pr.repo, number: pr.number }),
    getPrReviews({ owner: pr.owner, repo: pr.repo, number: pr.number }),
    ...openIssues.map((i) =>
      getIssueOrPrComments({ owner: i.owner, repo: i.repo, number: i.number })
    ),
  ]);

  const prompt = buildPrompt({
    pr,
    openIssues,
    prComments,
    prReviews,
    issueCommentsByIssue: issueCommentLists,
    maintainers,
  });
  const judgment = await getLlmClient().judge(prompt, Schema);

  if (!judgment.matchesIssue) {
    return {
      id: 'real-problem',
      status: 'fail',
      reasoning: `LLM judged the PR does not substantively address the linked issue: ${judgment.reasoning}`,
      guidance:
        'Re-read the linked issue and either revise the PR to address its core ask or link the correct issue.',
    };
  }

  if (judgment.category === 'feature' && (judgment.featureFit ?? 'none') === 'none') {
    return {
      id: 'real-problem',
      status: 'fail',
      reasoning:
        'LLM judged the PR is a feature for which maintainer approval/support is necessary, but evidence of a maintainer decision was not found.',
      guidance:
        'Your PR adds a feature for Storybook. Feature requests must must accepted by maintainers prior to implementation, in most cases. Consider shipping this in the addon ecosystem, or talk to maintainers on Discord or on the linked issue to get approval before continuing.',
    };
  }

  const hasUnresolved = pr.unresolved.length > 0;
  return {
    id: 'real-problem',
    status: hasUnresolved ? 'warn' : 'pass',
    reasoning: hasUnresolved
      ? `Matches linked issue (${judgment.category}): ${judgment.reasoning} (warn: unresolved refs ${pr.unresolved.join(', ')})`
      : `Matches linked issue (${judgment.category}): ${judgment.reasoning}`,
  };
}

function formatAuthor(login: string | null, maintainers: Set<string>): string {
  if (!login) return '(unknown)';
  return maintainers.has(login) ? `[maintainer] ${login}` : login;
}

function formatComments(comments: readonly IssueOrPrComment[], maintainers: Set<string>): string {
  if (comments.length === 0) return '(no comments)';
  return comments
    .map((c) => {
      const author = c.isBot
        ? `[bot] ${c.authorLogin ?? ''}`
        : formatAuthor(c.authorLogin, maintainers);
      return `- ${c.createdAt} — ${author}:\n${indent(c.body || '(empty)')}`;
    })
    .join('\n');
}

function formatReviews(reviews: readonly PrReview[], maintainers: Set<string>): string {
  if (reviews.length === 0) return '(no reviews)';
  return reviews
    .map((r) => {
      const author = r.isBot
        ? `[bot] ${r.authorLogin ?? ''}`
        : formatAuthor(r.authorLogin, maintainers);
      return `- ${r.submittedAt ?? '(unknown time)'} — ${author} [${r.state}]:\n${indent(r.body || '(empty)')}`;
    })
    .join('\n');
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function buildPrompt(input: {
  pr: Pick<PrContext, 'title' | 'body' | 'labels' | 'owner' | 'repo' | 'number'>;
  openIssues: Issue[];
  prComments: readonly IssueOrPrComment[];
  prReviews: readonly PrReview[];
  issueCommentsByIssue: readonly IssueOrPrComment[][];
  maintainers: Set<string>;
}): string {
  const issueSections = input.openIssues.map((issue, idx) => {
    const comments = input.issueCommentsByIssue[idx] ?? [];
    return [
      `### Issue ${issue.owner}/${issue.repo}#${issue.number} — ${issue.title}`,
      `Labels: ${issue.labels.join(', ')}`,
      `Author: ${formatAuthor(issue.author, input.maintainers)}`,
      '',
      issue.body || '(empty body)',
      '',
      `Issue comments (${comments.length}):`,
      formatComments(comments, input.maintainers),
    ].join('\n');
  });

  return [
    '## Goal',
    'You are reviewing a PR to ensure it solves a real user problem, or implements a feature desired by maintainers/users.',
    '',
    'Use PR labels, linked issue labels, PR titles, and the discussion (comments + reviews) to determine the PR category.',
    'Decide if the PR substantively addresses the linked issue.',
    'If the PR is a feature, verify if the linked issue or PR carries evidence of explicit maintainer approval. In some cases, maintainer approval is not required, e.g.',
    '- when the PR improves an API needed for framework/addon authors and power users without breaking change or excess complexity',
    '- when the PR adds support for frameworks/libraries that are widely requested/popular',
    '- when the PR is a reasonably small quality-of-life improvement for users',
    '',
    'Entries prefixed with `[maintainer]` are authored by Storybook core-team maintainers — their approval / rejection / concerns carry weight for the feature-approval decision. `[bot]` entries are automated (CI, dependabot, etc.) and should be ignored for approval reasoning.',
    '',
    '## PR',
    `Title: ${input.pr.title}`,
    `Labels: ${input.pr.labels.join(', ')}`,
    'Body:',
    input.pr.body,
    '',
    `### PR issue-comments (${input.prComments.length}):`,
    formatComments(input.prComments, input.maintainers),
    '',
    `### PR reviews (${input.prReviews.length}):`,
    formatReviews(input.prReviews, input.maintainers),
    '',
    '## Linked issues',
    issueSections.join('\n\n'),
    '',
    '## Output',
    'Decide and return as JSON:',
    '- matchesIssue: does the PR substantively address the linked issue? (not tangential, not different problem)',
    '- category: one of bug | feature | maintenance | docs | dependencies | other',
    '- featureFit (only if category=feature): augments-api | popular-tech | quality-of-life | none',
    '- reasoning: one short sentence (≤ 200 chars)',
  ].join('\n');
}
