import { fence, renderCommentBody, renderIssueBody } from './proposals.ts';
import type { EvidenceFile, Proposal } from './types.ts';

export const ASSETS_BRANCH = 'qa-assets';

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
  /** `assets` links evidence on the qa-assets branch of `repo`; `local` links the downloaded files. */
  evidenceLinks: 'assets' | 'local';
  /** The issue that already carries this fingerprint, if any. */
  filedAs?: number;
  /** Bodies of the comments already on the issue a comment proposal targets. */
  comments?: string[];
}

export const assetUrl = (repo: string, assetDir: string, name: string) =>
  `https://raw.githubusercontent.com/${repo}/${ASSETS_BRANCH}/${assetDir}/${name}`;

const METADATA_MARKER = '<!-- sb-qa-metadata -->';

/** Return the ordered steps that file one proposal; a skip step is always the only step. */
export const planFiling = (proposal: Proposal, options: FilingOptions): FilingStep[] => {
  if (proposal.kind === 'suppressed') {
    return [{ kind: 'skip', reason: `#${proposal.existingIssue} is labelled qa:known` }];
  }
  if (proposal.kind === 'comment') {
    const body = renderCommentBody(proposal);
    const metadata = body.slice(body.indexOf(METADATA_MARKER)).trim();
    if (options.comments?.some((comment) => comment.includes(metadata))) {
      return [{ kind: 'skip', reason: `#${proposal.existingIssue} already has this comment` }];
    }
    return [{ kind: 'comment', issue: proposal.existingIssue, body }];
  }
  if (options.filedAs !== undefined) {
    return [{ kind: 'skip', reason: `already filed as #${options.filedAs}` }];
  }
  const { cycle, evidence, assetDir } = proposal;
  const localPaths = new Map(evidence.map((file) => [file.name, file.localPath]));
  const evidenceUrl = (name: string) =>
    options.evidenceLinks === 'local'
      ? (localPaths.get(name) ?? name)
      : assetUrl(options.repo, assetDir, name);
  return [
    ...(cycle.headSha && cycle.bundle
      ? [{ kind: 'push-cycle' as const, ...cycle, headSha: cycle.headSha, bundle: cycle.bundle }]
      : []),
    ...(evidence.length > 0
      ? [
          {
            kind: 'push-evidence' as const,
            assetDir,
            files: evidence,
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
      return `Push \`${step.bundle}\` head ${step.headSha} to ${step.repo} as \`${step.branch}\`.`;
    case 'push-evidence':
      return `Push ${step.files.map((file) => `\`${file.name}\``).join(', ')} to \`${ASSETS_BRANCH}/${step.assetDir}/\` of ${repo}.`;
    case 'create-issue':
      return `Create an issue in ${repo}, milestone ${step.milestone}, labels ${step.labels.map((label) => `\`${label}\``).join(', ')}.`;
    case 'comment':
      return `Comment on ${repo}#${step.issue}.`;
  }
};

/** Render what filing one proposal would do, with evidence linked to the local files. */
export const renderDry = (proposal: Proposal, repo: string): string => {
  const steps = planFiling(proposal, { repo, evidenceLinks: 'local' });
  const body = steps.flatMap((step) =>
    step.kind === 'create-issue' || step.kind === 'comment' ? [fence(step.body, 'markdown')] : []
  );
  return [
    `<details><summary><b>${proposal.kind}</b> ${proposal.title} <code>${proposal.fingerprint}</code></summary>`,
    '',
    `Sources: ${proposal.sources.map((source) => `${source.os}/${source.engine} (\`${source.resultPath}\`)`).join(', ')}`,
    '',
    ...steps.map((step, index) => `${index + 1}. ${describeStep(step, repo)}`),
    '',
    ...body.flatMap((block) => [block, '']),
    '</details>',
    '',
  ].join('\n');
};
