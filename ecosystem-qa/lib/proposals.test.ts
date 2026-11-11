import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { asIssue, finding, loaded, RUN_URL, VERSION } from './fixtures.ts';
import {
  groupFindings,
  renderCommentBody,
  renderIssueBody,
  toProposal,
  type FindingGroup,
} from './proposals.ts';

const issueFor = (group: FindingGroup | undefined) => asIssue(toProposal(group!, [], RUN_URL));
const byName = (name: string) => `https://assets.example/${name}`;

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
      asIssue(toProposal(group, [], RUN_URL))
    );

    expect(proposals).toHaveLength(2);
    const hmr = proposals.find((proposal) => proposal.title.includes('sidebar'))!;
    expect(hmr.sources.map((source) => `${source.os}/${source.engine}`)).toEqual([
      'linux/claude',
      'windows/codex',
    ]);
    expect(hmr.labels).toEqual(['bug', 'internal-qa', 'upgrade:11.0']);
    expect(hmr.evidence).toEqual([
      { name: 'hmr.png', localPath: 'results/mealdrop/linux/claude/evidence/hmr.png', bytes: 0 },
      { name: 'hmr.gif', localPath: 'results/mealdrop/linux/claude/evidence/hmr.gif', bytes: 0 },
      { name: 'dev.log', localPath: 'results/mealdrop/linux/claude/evidence/dev.log', bytes: 0 },
    ]);
    const body = renderIssueBody(hmr, byName);
    expect(body).toContain(`https://github.com/storybookjs/mealdrop/tree/${'b'.repeat(40)}`);
    expect(body).toMatch(/os: linux, windows\nengine: claude, codex/);
  });

  it('labels a finding windows only when every run that saw it was on Windows', () => {
    const windowsOnly = finding({ windowsOnly: true });
    const [onWindows] = groupFindings([loaded('windows', 'claude', [windowsOnly])]);
    const [alsoOnLinux] = groupFindings([
      loaded('windows', 'claude', [windowsOnly]),
      loaded('linux', 'claude', [windowsOnly]),
    ]);

    expect(issueFor(onWindows).labels).toContain('windows');
    expect(issueFor(alsoOnLinux).labels).not.toContain('windows');
  });
});

describe('toProposal', () => {
  const [group] = groupFindings([loaded('linux', 'claude', [finding()])]);

  it('suppresses a finding whose fingerprint is on a qa:known issue', () => {
    const proposal = toProposal(
      group!,
      [{ number: 7, labels: ['bug', 'qa:known'], state: 'open' }],
      RUN_URL
    );

    expect(proposal).toMatchObject({ kind: 'suppressed', existingIssue: 7 });
  });

  it('turns any other hit into a comment on that issue', () => {
    const proposal = toProposal(group!, [{ number: 9, labels: ['bug'], state: 'open' }], RUN_URL);

    expect(proposal).toMatchObject({ kind: 'comment', existingIssue: 9 });
    expect(proposal.kind === 'comment' && renderCommentBody(proposal)).toContain(
      `fingerprint: ${group!.fingerprint}`
    );
  });

  it('falls back to the run record when the captured system info is empty', () => {
    const [empty] = groupFindings([{ ...loaded('linux', 'claude', [finding()]), systemInfo: '' }]);
    const proposal = toProposal(empty!, [], RUN_URL);

    expect(proposal.kind === 'issue' && proposal.system).toContain('OS: linux');
  });

  it('comments on the open issue when a closed one has the same fingerprint', () => {
    const proposal = toProposal(
      group!,
      [
        { number: 9, labels: ['bug'], state: 'closed' },
        { number: 12, labels: ['bug'], state: 'open' },
      ],
      RUN_URL
    );

    expect(proposal).toMatchObject({ kind: 'comment', existingIssue: 12 });
  });

  it('files a bug that came back as a new issue linked to the closed one', () => {
    const proposal = toProposal(group!, [{ number: 9, labels: ['bug'], state: 'closed' }], RUN_URL);

    expect(proposal).toMatchObject({ kind: 'issue', previousIssue: 9 });
    expect(proposal.kind === 'issue' && renderIssueBody(proposal, (name) => name)).toContain(
      'Seen before as #9, which is closed; this run saw it again.'
    );
  });

  it('keeps a qa:known suppression even when that issue is closed', () => {
    const proposal = toProposal(
      group!,
      [{ number: 7, labels: ['bug', 'qa:known'], state: 'closed' }],
      RUN_URL
    );

    expect(proposal).toMatchObject({ kind: 'suppressed', existingIssue: 7 });
  });

  it('neutralises the title and keeps the finding as the agent wrote it', () => {
    const [mention] = groupFindings([
      loaded('linux', 'claude', [finding({ title: 'Ask @someone' })]),
    ]);

    expect(issueFor(mention).title).toBe('[SB 11 QA]: Ask `@someone`');
    expect(issueFor(mention).finding.title).toBe('Ask @someone');
  });

  it('proposes an issue titled for the target major when nothing matches', () => {
    const proposal = issueFor(group);

    expect(proposal.title).toBe('[SB 11 QA]: New story export never reaches the sidebar');
    expect(proposal.milestone).toBe('11');
    expect(proposal.assetDir).toBe(`assets/${VERSION}/${group!.fingerprint}`);
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

    const body = renderIssueBody(issueFor(group), byName);

    expect([...body.matchAll(/^### (.+)$/gm)].map((match) => match[1])).toEqual(templateHeadings);
    expect(body.trimEnd()).toMatch(
      /<!-- sb-qa-metadata -->\n```yaml\nfingerprint: [0-9a-f]{16}\n[\s\S]*\nrun: https:\S+\n```$/
    );
  });

  it('links every evidence file through the given URL builder', () => {
    const [group] = groupFindings([loaded('linux', 'claude', [finding()])]);

    const body = renderIssueBody(issueFor(group), byName);

    expect(body).toContain('![Screenshot of the actual result](https://assets.example/hmr.png)');
    expect(body).toContain('- [dev.log](https://assets.example/dev.log)');
  });

  it('renders the agent prose inside text fences and says how many steps it left out', () => {
    const [group] = groupFindings([
      loaded('linux', 'claude', [
        finding({
          actual: 'Broken, ping @someone and see storybookjs/storybook#1 ```',
          expected: '[click](https://evil.example)',
          reproSteps: Array.from({ length: 14 }, (_, index) => `step ${index + 1}`),
        }),
      ]),
    ]);

    const body = renderIssueBody(issueFor(group), byName);

    expect(body).toContain(
      '````text\nBroken, ping @someone and see storybookjs/storybook#1 ```\n````'
    );
    expect(body).toContain('**Expected:**\n\n```text\n[click](https://evil.example)\n```');
    expect(body).toContain('11. step 11\n12. step 12\n... 2 more steps omitted\n```');
  });

  it('links the cycle branch head when the agent committed the upgrade', () => {
    const [group] = groupFindings([loaded('linux', 'claude', [finding()])]);

    const body = renderIssueBody(issueFor(group), byName);

    expect(body).toContain(`https://github.com/storybookjs/mealdrop/tree/${'b'.repeat(40)}`);
    expect(body).toContain(
      `published in storybookjs/mealdrop as \`refs/qa/sb-${VERSION}/linux-claude\` so that no workflow ran it`
    );
    expect(body).toContain(
      `git push https://github.com/storybookjs/mealdrop refs/qa/sb-${VERSION}/linux-claude:refs/heads/qa/sb-${VERSION}/linux-claude`
    );
    expect(body).toContain(`sha: ${'b'.repeat(40)}\ncycleRef: refs/qa/sb-${VERSION}/linux-claude`);
  });

  it('links the start commit and says so when the agent made no commits', () => {
    const [group] = groupFindings([loaded('linux', 'claude', [finding()], null)]);

    const body = renderIssueBody(issueFor(group), byName);

    expect(body).toContain(`https://github.com/storybookjs/mealdrop/tree/${'a'.repeat(40)}`);
    expect(body).toContain('The upgraded state was not committed.');
    expect(body).not.toContain('holds the upgraded state');
    expect(body).toContain(`sha: ${'a'.repeat(40)}\ncycleRef: none`);
  });

  it('lists each occurrence with its own version in a comment', () => {
    const [group] = groupFindings([
      loaded('linux', 'claude', [finding()]),
      loaded('windows', 'codex', [finding()]),
    ]);

    const proposal = toProposal(group!, [{ number: 9, labels: ['bug'], state: 'open' }], RUN_URL);
    const body = proposal.kind === 'comment' ? renderCommentBody(proposal) : '';

    expect(body).toContain(`- ${VERSION}: linux, claude (claude-sonnet-5-5), sandbox docker`);
    expect(body).toContain(`- ${VERSION}: windows, codex (gpt-5.4), sandbox none`);
  });
});
