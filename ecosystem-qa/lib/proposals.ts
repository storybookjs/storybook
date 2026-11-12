import { existsSync, statSync } from 'node:fs';

import { join } from 'pathe';

import { cycleRef, versionLine } from './cycle.ts';
import { fingerprint } from './fingerprint.ts';
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
  proposal.sources.map(({ os, engine, model, sandbox, version, fake }) => {
    const where = `${os}, ${engine} (${model}${fake ? ', fake run' : ''}), sandbox ${sandbox}`;
    return `- ${withVersion ? `${version}: ` : ''}${where}`;
  });

const reproductionLink = (cycle: Cycle): string[] => {
  const repoUrl = `https://github.com/${cycle.repo}`;
  if (cycle.headSha) {
    const ref = cycleRef(cycle.branch);
    return [
      `${repoUrl}/tree/${cycle.headSha}`,
      '',
      `That commit holds the upgraded state, published in ${cycle.repo} as \`${ref}\` so that no workflow ran it. To work with it: \`git fetch ${repoUrl} ${ref} && git checkout FETCH_HEAD\`. To turn it into a branch after reading the diff: \`git push ${repoUrl} ${cycle.headSha}:refs/heads/${cycle.branch}\`.`,
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
    metadataBlock(proposal),
    '',
  ].join('\n');

export const toProposal = (group: FindingGroup, hits: IssueHit[], runUrl: string): Proposal => {
  const { primary } = group;
  const { version } = primary.result.request;
  const line = versionLine(version);
  const [major = line] = line.split('.');
  const allWindows = group.occurrences.every(({ result }) => result.request.os === 'windows');
  const labels = ['bug', 'internal-qa', `upgrade:${line}`];
  if (allWindows && group.finding.windowsOnly) {
    labels.push('windows');
  }
  const common = {
    fingerprint: group.fingerprint,
    title: `[SB ${major} QA]: ${sanitizeTitle(group.finding.title)}`,
    sources: group.occurrences.map(({ result, resultPath, cycle }) => ({
      resultPath,
      repo: cycle.repo,
      os: result.request.os,
      engine: result.request.engine,
      model: result.request.model,
      sandbox: result.request.sandbox,
      version: result.request.version,
      fake: result.request.fake,
    })),
  };
  const known = hits.find((hit) => hit.labels.includes('qa:known'));
  if (known) {
    return { kind: 'suppressed', ...common, existingIssue: known.number };
  }
  const report = {
    ...common,
    labels,
    milestone: major,
    finding: group.finding,
    cycle: primary.cycle,
    runUrl,
  };
  // A closed issue gets no comment: nobody watches it, so the bug that came back is filed again
  // with a link to where it was fixed before.
  const open = hits.find((hit) => hit.state === 'open');
  if (open) {
    return { kind: 'comment', ...report, existingIssue: open.number };
  }
  const [closed] = hits;
  return {
    kind: 'issue',
    ...report,
    ...(closed ? { previousIssue: closed.number } : {}),
    system: systemText(primary),
    assetDir: `assets/${version}/${group.fingerprint}`,
    evidence: evidenceFiles(group),
  };
};
