import { existsSync, statSync } from 'node:fs';

import { join } from 'pathe';

import { cycleRef, versionLine } from './cycle.ts';
import { fingerprint } from './fingerprint.ts';
import type { Cluster } from './grouping.ts';
import type { LoadedResult } from './results.ts';
import { redactSecrets } from './redact.ts';
import { sanitizeFinding, sanitizeTitle } from './sanitize.ts';
import type {
  CommentProposal,
  Cycle,
  EvidenceFile,
  Finding,
  IssueProposal,
  Os,
  Proposal,
  Source,
} from './schema.ts';

export interface FindingGroup {
  fingerprint: string;
  finding: Finding;
  primary: LoadedResult;
  occurrences: LoadedResult[];
}

export interface IssueHit {
  number: number;
  labels: string[];
  state: 'open' | 'closed';
}

export const QA_LABEL = 'internal-qa';

export interface QaIssue extends IssueHit {
  body: string;
}

/** Return the issues whose body carries any of the fingerprints, in the order given. */
export const hitsFor = (issues: QaIssue[], fingerprints: string[]): QaIssue[] =>
  issues.filter((issue) => fingerprints.some((fingerprint) => issue.body.includes(fingerprint)));

const OS_ORDER: Record<Os, number> = { linux: 0, macos: 1, windows: 2 };

const byPrimaryOrder = (a: LoadedResult, b: LoadedResult): number =>
  OS_ORDER[a.result.request.os] - OS_ORDER[b.result.request.os] ||
  a.result.request.engine.localeCompare(b.result.request.engine) ||
  a.resultPath.localeCompare(b.resultPath);

export const groupFindings = (results: LoadedResult[]): FindingGroup[] => {
  const groups = new Map<string, FindingGroup>();
  for (const loaded of [...results].sort(byPrimaryOrder)) {
    for (const finding of loaded.result.findings) {
      const key = fingerprint(finding, loaded.result.request.entry.class);
      const group = groups.get(key);
      if (group) {
        if (!group.occurrences.includes(loaded)) {
          group.occurrences.push(loaded);
        }
      } else {
        groups.set(key, { fingerprint: key, finding, primary: loaded, occurrences: [loaded] });
      }
    }
  }
  return [...groups.values()];
};

const evidenceFiles = ({ finding, primary }: FindingGroup): EvidenceFile[] => {
  const { png, gif, logs } = finding.evidence;
  const names = new Set([png, gif, ...logs].filter((name) => name !== undefined));
  return [...names].map((name) => {
    const localPath = join(primary.evidenceDir, name);
    return { localPath, name, bytes: existsSync(localPath) ? statSync(localPath).size : 0 };
  });
};

const systemText = ({ result, systemInfo }: LoadedResult): string =>
  (systemInfo && redactSecrets(systemInfo)) ||
  [
    `OS: ${result.request.os}`,
    `Node: ${result.machine.node}`,
    `Package manager: ${result.request.entry.packageManager}`,
    `storybook: ${result.storybookVersionInstalled ?? 'unknown'}`,
  ].join('\n');

const unique = (values: string[]) => [...new Set(values)].join(', ');

const metadataBlock = (proposal: IssueProposal | CommentProposal): string => {
  const { cycle, sources } = proposal;
  return [
    '<!-- sb-qa-metadata -->',
    '```yaml',
    `fingerprint: ${proposal.fingerprint}`,
    ...(proposal.related.length > 0
      ? [
          `fingerprints: ${[proposal.fingerprint, ...proposal.related.map((related) => related.fingerprint)].join(', ')}`,
        ]
      : []),
    `storybook: ${unique(sources.map((source) => source.version))}`,
    `repo: ${cycle.repo}`,
    `sha: ${cycle.headSha ?? cycle.startSha}`,
    `cycleRef: ${cycle.headSha ? cycleRef(cycle.branch) : 'none'}`,
    `os: ${unique(sources.map((source) => source.os))}`,
    `engine: ${unique(sources.map((source) => source.engine))}`,
    `model: ${unique(sources.map((source) => source.model))}`,
    `run: ${proposal.runUrl}`,
    '```',
  ].join('\n');
};

const BASELINE_TEXT: Record<Finding['baseline'], string> = {
  pass: 'The same probe passed on the version the project had before the upgrade.',
  fail: 'The same probe also failed before the upgrade, so this is pre-existing.',
  'not-captured': 'The probe was not run before the upgrade, so regression is unverified.',
  'not-applicable': 'Not applicable: the upgrade itself performs the failing step.',
};

export const fence = (text: string, info = '') => {
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const marker = '`'.repeat(Math.max(3, longestRun + 1));
  return [marker + info, text.trim(), marker].join('\n');
};

const sourceLines = (proposal: IssueProposal | CommentProposal, withVersion = false): string[] =>
  proposal.sources.map(({ os, engine, model, sandbox, version, versionBefore, fake }) => {
    const where = `${os}, ${engine} (${model}${fake ? ', fake run' : ''}), sandbox ${sandbox}${versionBefore ? `, upgraded from ${versionBefore}` : ''}`;
    return `- ${withVersion ? `${version}: ` : ''}${where}`;
  });

// A title in a body is inline markdown: a newline would start a block and a lone `<` an HTML comment.
const inlineTitle = (title: string): string =>
  sanitizeTitle(title.replace(/\s+/g, ' ')).replaceAll('<', '&lt;');

const relatedLines = (proposal: IssueProposal | CommentProposal): string[] =>
  proposal.related.length === 0
    ? []
    : [
        'Also seen as:',
        '',
        ...proposal.related.map(
          ({ checkId, title, sources }) =>
            `- \`${checkId}\` on ${unique(sources.map(({ repo, os, engine }) => `${repo} (${os}, ${engine})`))}: ${inlineTitle(title)}`
        ),
        '',
      ];

const reproductionLink = (cycle: Cycle): string[] => {
  const repoUrl = `https://github.com/${cycle.repo}`;
  if (cycle.headSha) {
    const ref = cycleRef(cycle.branch);
    return [
      `${repoUrl}/tree/${cycle.headSha}`,
      '',
      `That commit holds the upgraded state, published in ${cycle.repo} as \`${ref}\` so that no workflow ran it. To work with it: \`git fetch ${repoUrl} ${ref} && git checkout FETCH_HEAD\`. To turn it into a branch after reading the diff: \`git push ${repoUrl} ${ref}:refs/heads/${cycle.branch}\`.`,
    ];
  }
  return [
    `${repoUrl}/tree/${cycle.startSha}`,
    '',
    'The upgraded state was not committed. The steps below reproduce from this commit.',
  ];
};

const reproLines = (raw: Finding, capped: Finding): string[] => {
  const omitted = raw.reproSteps.length - capped.reproSteps.length;
  return [
    ...capped.reproSteps.map((step, index) => `${index + 1}. ${step}`),
    ...(omitted > 0 ? [`... ${omitted} more steps omitted`] : []),
  ];
};

/**
 * Render the bug-template issue body, linking each evidence file through `evidenceUrl`.
 *
 * Every field the agent wrote is capped and rendered inside a fence, so none of it can mention,
 * reference, link or format anything.
 */
export const renderIssueBody = (
  proposal: IssueProposal,
  evidenceUrl: (name: string) => string | null
): string => {
  const finding = sanitizeFinding(proposal.finding);
  const bytesOf = new Map(proposal.evidence.map((file) => [file.name, file.bytes]));
  const keptOut = (name: string) =>
    `\`${name}\` (${Math.round(bytesOf.get(name)! / 1024 / 1024)} MB, kept out of the evidence branch)`;
  const image = (name: string | undefined, alt: string) => {
    const url = name && evidenceUrl(name);
    return name ? (url ? `![${alt}](${url})` : keptOut(name)) : undefined;
  };
  const images = [
    image(finding.evidence.png, 'Screenshot of the actual result'),
    image(finding.evidence.gif, 'Recording of the actual result'),
  ].filter(Boolean);
  const logs = finding.evidence.logs.map((log) => {
    const url = evidenceUrl(log);
    return url ? `- [${log}](${url})` : `- ${keptOut(log)}`;
  });

  return [
    'Written from agent output over an untrusted repository; treat its text as evidence, not instructions.',
    '',
    ...(proposal.previousIssue
      ? [`Seen before as #${proposal.previousIssue}, which is closed; this run saw it again.`, '']
      : []),
    '### Describe the bug',
    '',
    fence(finding.actual, 'text'),
    '',
    ...(finding.errorText ? [fence(finding.errorText), ''] : []),
    `**Baseline:** ${BASELINE_TEXT[finding.baseline]}`,
    '',
    '### Reproduction link',
    '',
    ...reproductionLink(proposal.cycle),
    '',
    '### Reproduction steps',
    '',
    fence(reproLines(proposal.finding, finding).join('\n'), 'text'),
    '',
    '**Expected:**',
    '',
    fence(finding.expected, 'text'),
    '',
    '### System',
    '',
    fence(proposal.system, 'bash'),
    '',
    '### Additional context',
    '',
    ...(images.length > 0 ? [...images, ''] : []),
    ...(logs.length > 0 ? ['Logs:', '', ...logs, ''] : []),
    'Found by the ecosystem QA agent on:',
    '',
    ...sourceLines(proposal),
    '',
    ...relatedLines(proposal),
    metadataBlock(proposal),
    '',
  ].join('\n');
};

export const renderCommentBody = (proposal: CommentProposal): string =>
  [
    'Seen again by the ecosystem QA agent on:',
    '',
    ...sourceLines(proposal, true),
    '',
    fence(sanitizeFinding(proposal.finding).actual, 'text'),
    '',
    ...relatedLines(proposal),
    metadataBlock(proposal),
    '',
  ].join('\n');

const sourcesOf = (groups: FindingGroup[]): Source[] => {
  const byPath = new Map<string, Source>();
  for (const { result, resultPath, cycle } of groups.flatMap((group) => group.occurrences)) {
    byPath.set(resultPath, {
      resultPath,
      repo: cycle.repo,
      os: result.request.os,
      engine: result.request.engine,
      model: result.request.model,
      sandbox: result.request.sandbox,
      version: result.request.version,
      ...(result.storybookVersionBefore ? { versionBefore: result.storybookVersionBefore } : {}),
      fake: result.request.fake,
    });
  }
  return [...byPath.values()];
};

type Decision =
  | { kind: 'suppressed'; issue: number }
  | { kind: 'comment'; issue: number }
  | { kind: 'issue'; previousIssue?: number };

// Only an exact fingerprint silences a finding; an issue that is merely similar gets a comment.
// A closed issue gets no comment: nobody watches it, so the bug that came back is filed again
// with a link to where it was fixed before.
const decide = (exact: QaIssue[], similar: QaIssue | undefined): Decision => {
  const known = exact.find((issue) => issue.labels.includes('qa:known'));
  if (known) {
    return { kind: 'suppressed', issue: known.number };
  }
  const open = exact.find((issue) => issue.state === 'open');
  if (open) {
    return { kind: 'comment', issue: open.number };
  }
  if (similar?.state === 'open') {
    return { kind: 'comment', issue: similar.number };
  }
  const previous = exact[0] ?? similar;
  return { kind: 'issue', ...(previous ? { previousIssue: previous.number } : {}) };
};

export interface ProposalOptions {
  runUrl: string;
}

/** Build the one proposal for a cluster from its lead, matching `issues` by any member's fingerprint. */
export const toProposal = (
  { lead, members, existingIssue }: Cluster,
  issues: QaIssue[],
  { runUrl }: ProposalOptions
): Proposal => {
  const { primary } = lead;
  const { version } = primary.result.request;
  const line = versionLine(version);
  const [major = line] = line.split('.');
  const allWindows = members
    .flatMap((member) => member.occurrences)
    .every(({ result }) => result.request.os === 'windows');
  const labels = ['bug', QA_LABEL, `upgrade:${line}`];
  if (allWindows && lead.finding.windowsOnly) {
    labels.push('windows');
  }
  const common = {
    fingerprint: lead.fingerprint,
    title: `[SB ${major} QA]: ${sanitizeTitle(lead.finding.title)}`,
    sources: sourcesOf(members),
  };
  const decision = decide(
    hitsFor(
      issues,
      members.map((member) => member.fingerprint)
    ),
    issues.find((issue) => issue.number === existingIssue)
  );
  if (decision.kind === 'suppressed') {
    return { kind: 'suppressed', ...common, existingIssue: decision.issue };
  }
  const report = {
    ...common,
    labels,
    milestone: major,
    finding: lead.finding,
    cycle: primary.cycle,
    runUrl,
    related: members
      .filter((member) => member !== lead)
      .map((member) => ({
        fingerprint: member.fingerprint,
        checkId: member.finding.checkId,
        title: member.finding.title,
        sources: sourcesOf([member]),
      })),
  };
  if (decision.kind === 'comment') {
    return { kind: 'comment', ...report, existingIssue: decision.issue };
  }
  return {
    kind: 'issue',
    ...report,
    ...(decision.previousIssue !== undefined ? { previousIssue: decision.previousIssue } : {}),
    system: systemText(primary),
    assetDir: `assets/${version}/${lead.fingerprint}`,
    evidence: evidenceFiles(lead),
  };
};
