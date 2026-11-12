import { cycleRef } from './cycle.ts';
import { fence, renderCommentBody, renderIssueBody } from './proposals.ts';
import type { Cycle, EvidenceFile, Proposal } from './schema.ts';

export const ASSETS_BRANCH = 'qa-assets';
// Well under GitHub's 100 MB push limit, and small enough that a release cycle's evidence does not
// turn the orphan branch into a download.
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export type FilingStep =
  | { kind: 'skip'; reason: string }
  | {
      kind: 'push-cycle';
      repo: string;
      branch: string;
      startSha: string;
      headSha: string;
      bundle: string;
    }
  | { kind: 'push-evidence'; assetDir: string; files: EvidenceFile[]; message: string }
  | { kind: 'create-issue'; title: string; body: string; milestone: string; labels: string[] }
  | { kind: 'comment'; issue: number; body: string };

export interface FilingOptions {
  repo: string;
  // `assets` links evidence on the qa-assets branch of `repo`; `local` links the downloaded files.
  evidenceLinks: 'assets' | 'local';
  filedAs?: number;
  // Bodies of the comments already on the issue a comment proposal targets.
  comments?: string[];
}

const METADATA_MARKER = '<!-- sb-qa-metadata -->';

// Return the ordered steps that file one proposal; a skip step is always the only step.
export const planFiling = (proposal: Proposal, options: FilingOptions): FilingStep[] => {
  if (proposal.kind === 'suppressed') {
    return [{ kind: 'skip', reason: `#${proposal.existingIssue} is labelled qa:known` }];
  }
  // The cycle ref is pushed for a comment too: its metadata names this run's head, and a "seen
  // again" on a new prerelease is when someone wants to fetch the upgraded state.
  const pushCycle = (cycle: Cycle) =>
    cycle.headSha && cycle.bundle
      ? [{ kind: 'push-cycle' as const, ...cycle, headSha: cycle.headSha, bundle: cycle.bundle }]
      : [];
  if (proposal.kind === 'comment') {
    const body = renderCommentBody(proposal);
    const metadata = body.slice(body.indexOf(METADATA_MARKER)).trim();
    if (options.comments?.some((comment) => comment.includes(metadata))) {
      return [{ kind: 'skip', reason: `#${proposal.existingIssue} already has this comment` }];
    }
    return [...pushCycle(proposal.cycle), { kind: 'comment', issue: proposal.existingIssue, body }];
  }
  if (options.filedAs !== undefined) {
    return [{ kind: 'skip', reason: `already filed as #${options.filedAs}` }];
  }
  const { cycle, evidence, assetDir } = proposal;
  // A file over the cap stays out of the push, which would otherwise fail and take the issue with
  // it; the issue names it with its size, and the run artifact still holds it.
  const kept = evidence.filter((file) => file.bytes <= MAX_EVIDENCE_BYTES);
  const localPaths = new Map(kept.map((file) => [file.name, file.localPath]));
  const evidenceUrl = (name: string) =>
    !localPaths.has(name)
      ? null
      : options.evidenceLinks === 'local'
        ? localPaths.get(name)!
        : `https://raw.githubusercontent.com/${options.repo}/${ASSETS_BRANCH}/${assetDir}/${name}`;
  return [
    ...pushCycle(cycle),
    ...(kept.length > 0
      ? [
          {
            kind: 'push-evidence' as const,
            assetDir,
            files: kept,
            message: `qa: evidence for ${proposal.fingerprint}`,
          },
        ]
      : []),
    {
      kind: 'create-issue',
      title: proposal.title,
      body: renderIssueBody(proposal, evidenceUrl),
      milestone: proposal.milestone,
      labels: proposal.labels,
    },
  ];
};

export const describeStep = (step: FilingStep, repo: string): string => {
  switch (step.kind) {
    case 'skip':
      return `Skip: ${step.reason}.`;
    case 'push-cycle':
      return `Push \`${step.bundle}\` head ${step.headSha} to ${step.repo} as \`${cycleRef(step.branch)}\`.`;
    case 'push-evidence':
      return `Push ${step.files.map((file) => `\`${file.name}\``).join(', ')} to \`${ASSETS_BRANCH}/${step.assetDir}/\` of ${repo}.`;
    case 'create-issue':
      return `Create an issue in ${repo}, milestone ${step.milestone}, labels ${step.labels.map((label) => `\`${label}\``).join(', ')}.`;
    case 'comment':
      return `Comment on ${repo}#${step.issue}.`;
  }
};

export const renderDry = (proposal: Proposal, repo: string): string => {
  const steps = planFiling(proposal, { repo, evidenceLinks: 'local' });
  const body = steps.flatMap((step) =>
    step.kind === 'create-issue' || step.kind === 'comment' ? [fence(step.body, 'markdown')] : []
  );
  return [
    `<details><summary><b>${proposal.kind}</b> ${proposal.title} <code>${proposal.fingerprint}</code></summary>`,
    '',
    `Sources: ${proposal.sources.map((source) => `${source.os}/${source.engine}${source.fake ? ' (fake)' : ''} (\`${source.resultPath}\`)`).join(', ')}`,
    '',
    ...steps.map((step, index) => `${index + 1}. ${describeStep(step, repo)}`),
    '',
    ...body.flatMap((block) => [block, '']),
    '</details>',
    '',
  ].join('\n');
};

export const missingPrerequisites = (
  proposals: Proposal[],
  existing: { openMilestones: string[]; labels: string[] }
): string[] => {
  const issues = proposals.filter((proposal) => proposal.kind === 'issue');
  const milestones = new Set(issues.map((issue) => issue.milestone));
  const labels = new Set(issues.flatMap((issue) => issue.labels));
  return [
    ...[...milestones]
      .filter((milestone) => !existing.openMilestones.includes(milestone))
      .map((milestone) => `milestone "${milestone}" does not exist or is closed`),
    ...[...labels]
      .filter((label) => !existing.labels.includes(label))
      .map((label) => `label "${label}" does not exist`),
  ];
};

export interface FilingOutcome {
  proposal: Proposal;
  state: 'done' | 'skipped' | 'failed';
  detail: string;
}

const cell = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ');

export const renderFilingReport = (outcomes: FilingOutcome[]): string => {
  const failed = outcomes.filter((outcome) => outcome.state === 'failed').length;
  return [
    '## Ecosystem QA filing',
    '',
    `${outcomes.length} proposals, ${failed} failed.`,
    '',
    '| Fingerprint | Kind | Title | Result |',
    '| --- | --- | --- | --- |',
    ...outcomes.map(
      ({ proposal, state, detail }) =>
        `| \`${proposal.fingerprint}\` | ${proposal.kind} | ${cell(proposal.title)} | ${state}: ${cell(detail)} |`
    ),
    '',
  ].join('\n');
};
