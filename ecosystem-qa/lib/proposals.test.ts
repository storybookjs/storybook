import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { groupFindings, renderIssueBody, toProposal, type LoadedResult } from './proposals.ts';
import type { Engine, Finding, Os, RunResultFile } from './types.ts';

const RUN_URL = 'https://github.com/storybookjs/storybook/actions/runs/1';

const finding = (overrides: Partial<Finding> = {}): Finding => ({
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

const loaded = (
  os: Os,
  engine: Engine,
  findings: Finding[],
  headSha: string | null = os === 'linux' ? 'b'.repeat(40) : 'c'.repeat(40)
): LoadedResult => {
  const result: RunResultFile = {
    request: {
      entry: {
        id: 'mealdrop',
        repo: 'storybookjs/mealdrop',
        ref: 'main',
        class: 'owned',
        packageManager: 'yarn',
        storybookDir: '.',
        windows: true,
      },
      version: '11.0.0-beta.0',
      engine,
      model: engine === 'claude' ? 'claude-sonnet-5-5' : 'gpt-5.4',
      effort: 'medium',
      sandbox: os === 'windows' ? 'none' : 'docker',
      os,
      cycleBranch: 'qa/sb-11.0',
    },
    storybookVersionInstalled: '11.0.0-beta.0',
    startSha: 'a'.repeat(40),
    cycleBranch: 'qa/sb-11.0',
    headSha,
    checks: [],
    findings,
    usage: { inputTokens: 1, outputTokens: 1, usd: 0, model: 'm' },
    timing: { startedAt: '', finishedAt: '', wallSeconds: 1 },
    machine: { os, node: 'v22.22.3' },
    paths: { runLog: 'run.log', evidenceDir: 'evidence' },
    status: 'ok',
  };
  return { resultPath: `results/mealdrop/${os}/${engine}/result.json`, result };
};

describe('groupFindings', () => {
  it('merges the same failure from different os and engine runs into one proposal', () => {
    const windowsCodex = loaded('windows', 'codex', [
      finding({
        errorText: 'Error: watcher closed at C:\\a\\mealdrop\\node_modules\\x\\watch.js:12:7',
      }),
    ]);
    const linuxClaude = loaded('linux', 'claude', [
      finding(),
      finding({ checkId: 'build.static', title: 'Build fails', errorText: 'ENOSPC' }),
    ]);

    const proposals = groupFindings([windowsCodex, linuxClaude]).map((group) =>
      toProposal(group, [], RUN_URL)
    );

    expect(proposals).toHaveLength(2);
    const hmr = proposals.find((proposal) => proposal.title.includes('sidebar'));
    expect(hmr?.sources.map((source) => `${source.os}/${source.engine}`)).toEqual([
      'linux/claude',
      'windows/codex',
    ]);
    expect(hmr?.labels).toEqual(['bug', 'internal-qa', 'upgrade:11.0']);
    expect(hmr?.evidenceFiles).toEqual([
      'results/mealdrop/linux/claude/evidence/hmr.png',
      'results/mealdrop/linux/claude/evidence/hmr.gif',
      'results/mealdrop/linux/claude/evidence/dev.log',
    ]);
    expect(hmr?.body).toContain(`https://github.com/storybookjs/mealdrop/tree/${'b'.repeat(40)}`);
    expect(hmr?.body).toMatch(/os: linux, windows\nengine: claude, codex/);
  });

  it('labels a finding windows only when every run that saw it was on Windows', () => {
    const windowsOnly = finding({ windowsOnly: true });
    const [onWindows] = groupFindings([loaded('windows', 'claude', [windowsOnly])]);
    const [alsoOnLinux] = groupFindings([
      loaded('windows', 'claude', [windowsOnly]),
      loaded('linux', 'claude', [windowsOnly]),
    ]);

    expect(toProposal(onWindows!, [], RUN_URL).labels).toContain('windows');
    expect(toProposal(alsoOnLinux!, [], RUN_URL).labels).not.toContain('windows');
  });
});

describe('toProposal', () => {
  const [group] = groupFindings([loaded('linux', 'claude', [finding()])]);

  it('suppresses a finding whose fingerprint is on a qa:known issue', () => {
    const proposal = toProposal(group!, [{ number: 7, labels: ['bug', 'qa:known'] }], RUN_URL);

    expect(proposal).toMatchObject({ kind: 'suppressed', existingIssue: 7, evidenceFiles: [] });
  });

  it('turns any other hit into a comment on that issue', () => {
    const proposal = toProposal(group!, [{ number: 9, labels: ['bug'] }], RUN_URL);

    expect(proposal).toMatchObject({ kind: 'comment', existingIssue: 9 });
    expect(proposal.body).toContain(`fingerprint: ${group!.fingerprint}`);
  });

  it('proposes an issue titled for the target major when nothing matches', () => {
    const proposal = toProposal(group!, [], RUN_URL);

    expect(proposal.kind).toBe('issue');
    expect(proposal.title).toBe('[SB 11 QA]: New story export never reaches the sidebar');
    expect(proposal.milestone).toBe('11');
  });
});

describe('renderIssueBody', () => {
  it('uses the bug report template headings in order and ends with the metadata block', () => {
    const template = readFileSync(
      new URL('../../.github/ISSUE_TEMPLATE/bug_report.yml', import.meta.url),
      'utf8'
    );
    const templateHeadings = [...template.matchAll(/^\s+label: (.+)$/gm)].map((match) => match[1]);
    const [group] = groupFindings([loaded('linux', 'claude', [finding()])]);

    const body = renderIssueBody(group!, RUN_URL);

    expect([...body.matchAll(/^### (.+)$/gm)].map((match) => match[1])).toEqual(templateHeadings);
    expect(body.trimEnd()).toMatch(
      /<!-- sb-qa-metadata -->\n```yaml\nfingerprint: [0-9a-f]{16}\n[\s\S]*\nrun: https:\S+\n```$/
    );
  });

  it('links the cycle branch head when the agent committed the upgrade', () => {
    const [group] = groupFindings([loaded('linux', 'claude', [finding()])]);

    const body = renderIssueBody(group!, RUN_URL);

    expect(body).toContain(`https://github.com/storybookjs/mealdrop/tree/${'b'.repeat(40)}`);
    expect(body).toContain('Branch `qa/sb-11.0` in storybookjs/mealdrop holds the upgraded state.');
    expect(body).toContain(`sha: ${'b'.repeat(40)}\ncycleBranch: qa/sb-11.0`);
  });

  it('links the start commit and says so when the agent made no commits', () => {
    const [group] = groupFindings([loaded('linux', 'claude', [finding()], null)]);

    const body = renderIssueBody(group!, RUN_URL);

    expect(body).toContain(`https://github.com/storybookjs/mealdrop/tree/${'a'.repeat(40)}`);
    expect(body).toContain('The upgraded state was not committed.');
    expect(body).not.toContain('holds the upgraded state');
    expect(body).toContain(`sha: ${'a'.repeat(40)}\ncycleBranch: none`);
  });

  it('lists each occurrence with its own version in a comment', () => {
    const [group] = groupFindings([
      loaded('linux', 'claude', [finding()]),
      loaded('windows', 'codex', [finding()]),
    ]);

    const proposal = toProposal(group!, [{ number: 9, labels: ['bug'] }], RUN_URL);

    expect(proposal.body).toContain(
      '- 11.0.0-beta.0: linux, claude (claude-sonnet-5-5), sandbox docker'
    );
    expect(proposal.body).toContain('- 11.0.0-beta.0: windows, codex (gpt-5.4), sandbox none');
  });
});
