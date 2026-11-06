import { dirname, join } from 'pathe';

import { fingerprint } from './fingerprint.ts';
import type { Finding, Os, Proposal, RunResultFile } from './types.ts';

export interface LoadedResult {
  resultPath: string;
  result: RunResultFile;
  systemInfo?: string;
}

export interface FindingGroup {
  fingerprint: string;
  finding: Finding;
  primary: LoadedResult;
  occurrences: LoadedResult[];
}

export interface IssueHit {
  number: number;
  labels: string[];
}

const OS_ORDER: Record<Os, number> = { linux: 0, macos: 1, windows: 2 };

const byPrimaryOrder = (a: LoadedResult, b: LoadedResult): number =>
  OS_ORDER[a.result.request.os] - OS_ORDER[b.result.request.os] ||
  a.result.request.engine.localeCompare(b.result.request.engine) ||
  a.resultPath.localeCompare(b.resultPath);

// The first run in os, engine, path order supplies the finding text and the evidence.
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

const versionParts = (version: string) => {
  const [major = '0', minor = '0'] = version.split('.');
  return { major, minor };
};

const evidencePath = (loaded: LoadedResult, file: string) =>
  join(dirname(loaded.resultPath), loaded.result.paths.evidenceDir, file);

const evidenceFiles = (group: FindingGroup): string[] => {
  const { png, gif, logs } = group.finding.evidence;
  return [png, gif, ...logs]
    .filter((file): file is string => file !== undefined)
    .map((file) => evidencePath(group.primary, file));
};

const unique = (values: string[]) => [...new Set(values)].join(', ');

const metadataBlock = (group: FindingGroup, runUrl: string): string => {
  const { result } = group.primary;
  const all = group.occurrences.map((occurrence) => occurrence.result.request);
  return [
    '<!-- sb-qa-metadata -->',
    '```yaml',
    `fingerprint: ${group.fingerprint}`,
    `storybook: ${unique(all.map((request) => request.version))}`,
    `repo: ${result.request.entry.repo}`,
    `sha: ${result.headSha ?? result.startSha}`,
    `os: ${unique(all.map((request) => request.os))}`,
    `engine: ${unique(all.map((request) => request.engine))}`,
    `model: ${unique(all.map((request) => request.model))}`,
    `run: ${runUrl}`,
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

const sourceLines = (group: FindingGroup): string[] =>
  group.occurrences.map(
    ({ result }) =>
      `- ${result.request.os}, ${result.request.engine} (${result.request.model}), sandbox ${result.request.sandbox}`
  );

export const renderIssueBody = (group: FindingGroup, runUrl: string): string => {
  const { finding, primary } = group;
  const { result } = primary;
  const sha = result.headSha ?? result.startSha;
  const repoUrl = `https://github.com/${result.request.entry.repo}`;
  const images = [
    finding.evidence.png && `![${finding.title}](${evidencePath(primary, finding.evidence.png)})`,
    finding.evidence.gif &&
      `![${finding.title}, recording](${evidencePath(primary, finding.evidence.gif)})`,
  ].filter(Boolean);
  const logs = finding.evidence.logs.map((log) => `- [${log}](${evidencePath(primary, log)})`);
  const system =
    primary.systemInfo ??
    [
      `OS: ${result.machine.os}`,
      `Node: ${result.machine.node}`,
      `Package manager: ${result.request.entry.packageManager}`,
      `storybook: ${result.storybookVersionInstalled ?? 'unknown'}`,
    ].join('\n');

  return [
    '### Describe the bug',
    '',
    finding.actual,
    '',
    ...(finding.errorText ? [fence(finding.errorText), ''] : []),
    `**Baseline:** ${BASELINE_TEXT[finding.baseline]}`,
    '',
    '### Reproduction link',
    '',
    `${repoUrl}/tree/${sha}`,
    '',
    `Branch \`${result.cycleBranch}\` in ${result.request.entry.repo} holds the upgraded state.`,
    '',
    '### Reproduction steps',
    '',
    ...finding.reproSteps.map((step, index) => `${index + 1}. ${step}`),
    '',
    `**Expected:** ${finding.expected}`,
    '',
    '### System',
    '',
    fence(system, 'bash'),
    '',
    '### Additional context',
    '',
    ...(images.length > 0 ? [...images, ''] : []),
    ...(logs.length > 0 ? ['Logs:', '', ...logs, ''] : []),
    'Found by the ecosystem QA agent on:',
    '',
    ...sourceLines(group),
    '',
    metadataBlock(group, runUrl),
    '',
  ].join('\n');
};

const renderCommentBody = (group: FindingGroup, runUrl: string): string =>
  [
    `Seen again by the ecosystem QA agent on ${group.primary.result.request.version}:`,
    '',
    ...sourceLines(group),
    '',
    group.finding.actual,
    '',
    metadataBlock(group, runUrl),
    '',
  ].join('\n');

export const toProposal = (group: FindingGroup, hits: IssueHit[], runUrl: string): Proposal => {
  const { result } = group.primary;
  const { major, minor } = versionParts(result.request.version);
  const allWindows = group.occurrences.every(({ result: run }) => run.request.os === 'windows');
  const labels = ['bug', 'internal-qa', `upgrade:${major}.${minor}`];
  if (allWindows && group.finding.windowsOnly) {
    labels.push('windows');
  }
  const known = hits.find((hit) => hit.labels.includes('qa:known'));
  const existing = known ?? hits[0];
  const kind = known ? 'suppressed' : existing ? 'comment' : 'issue';
  const body =
    kind === 'issue'
      ? renderIssueBody(group, runUrl)
      : kind === 'comment'
        ? renderCommentBody(group, runUrl)
        : '';
  return {
    kind,
    fingerprint: group.fingerprint,
    ...(existing ? { existingIssue: existing.number } : {}),
    title: `[SB ${major} QA]: ${group.finding.title}`,
    body,
    labels,
    milestone: major,
    evidenceFiles: kind === 'issue' ? evidenceFiles(group) : [],
    sources: group.occurrences.map(({ result: run, resultPath }) => ({
      repo: run.request.entry.repo,
      os: run.request.os,
      engine: run.request.engine,
      resultPath,
    })),
  };
};
