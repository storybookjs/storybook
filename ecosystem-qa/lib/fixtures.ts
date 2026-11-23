import { cycleBranchName } from './cycle.ts';
import type { Cluster, FindingGroup, IssueHit, QaIssue } from './proposals.ts';
import type { LoadedResult } from './results.ts';
import type {
  CatalogEntry,
  Engine,
  Finding,
  IssueProposal,
  Os,
  Proposal,
  RunResultFile,
} from './schema.ts';

export const VERSION = '11.0.0-beta.0';
export const RUN_URL = 'https://github.com/storybookjs/storybook/actions/runs/1';

export const ENTRY: CatalogEntry = {
  id: 'mealdrop',
  repo: 'storybookjs/mealdrop',
  ref: 'main',
  class: 'owned',
  packageManager: 'yarn',
  storybookDir: '.',
  windows: true,
};

export const finding = (overrides: Partial<Finding> = {}): Finding => ({
  checkId: 'core.hmr.stories-file',
  title: 'New story export never reaches the sidebar',
  baseline: 'pass',
  expected: 'The new story appears in index.json',
  actual: 'index.json keeps the old entries until restart',
  errorText: 'Error: watcher closed at /home/agent/workspace/node_modules/x/watch.js:10:2',
  reproSteps: ['yarn storybook --port 6006', 'Add `export const New = {}` to Button.stories.tsx'],
  evidence: { png: 'hmr.png', gif: 'hmr.gif', logs: ['dev.log'] },
  windowsOnly: false,
  ...overrides,
});

export const loaded = (
  os: Os,
  engine: Engine,
  findings: Finding[],
  headSha: string | null = os === 'linux' ? 'b'.repeat(40) : 'c'.repeat(40)
): LoadedResult => {
  const dir = `results/mealdrop/${os}/${engine}`;
  const result: RunResultFile = {
    request: {
      entry: ENTRY,
      version: VERSION,
      engine,
      model: engine === 'claude' ? 'claude-sonnet-5-5' : 'gpt-5.4',
      effort: 'medium',
      tier: 'must',
      sandbox: os === 'windows' ? 'none' : 'docker',
      os,
      fake: false,
    },
    storybookVersionInstalled: VERSION,
    startSha: 'a'.repeat(40),
    headSha,
    checks: [],
    findings,
    usage: { inputTokens: 1, outputTokens: 1, usd: 0, model: 'm', priceSource: 'agent' },
    timing: { startedAt: '', finishedAt: '', wallSeconds: 1 },
    machine: { node: 'v22.22.3' },
    paths: { runLog: 'run.log', evidenceDir: 'evidence' },
    status: 'ok',
  };
  return {
    resultPath: `${dir}/result.json`,
    result,
    evidenceDir: `${dir}/evidence`,
    cycle: {
      repo: 'storybookjs/mealdrop',
      branch: cycleBranchName(VERSION, os, engine),
      startSha: 'a'.repeat(40),
      headSha,
      bundle: headSha ? `${dir}/cycle.bundle` : null,
    },
  };
};

export const asIssue = (proposal: Proposal): IssueProposal => {
  if (proposal.kind !== 'issue') {
    throw new Error(`expected an issue proposal, got ${proposal.kind}`);
  }
  return proposal;
};

export const single = (lead: FindingGroup | undefined): Cluster => ({
  lead: lead!,
  members: [lead!],
});

// The metadata block the harness ends an issue body or a comment with, for these fingerprints.
export const metadata = (...fingerprints: string[]): string =>
  [
    '<!-- sb-qa-metadata -->',
    '```yaml',
    `fingerprint: ${fingerprints[0]}`,
    ...(fingerprints.length > 1 ? [`fingerprints: ${fingerprints.join(', ')}`] : []),
    '```',
  ].join('\n');

// A listed QA issue whose body carries the group's fingerprint, or another one without a group.
export const issueOn = (group: FindingGroup | undefined, hit: IssueHit): QaIssue => ({
  ...hit,
  title: `Issue ${hit.number}`,
  body: metadata(group?.fingerprint ?? '0000000000000000'),
  comments: [],
});
