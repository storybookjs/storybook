import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { asIssue, finding, issueOn, loaded, RUN_URL, single, VERSION } from './fixtures.ts';
import {
  groupFindings,
  hitsFor,
  openHit,
  renderCommentBody,
  renderIssueBody,
  toProposal,
  type Cluster,
  type FindingGroup,
  type IssueHit,
  type QaIssue,
} from './proposals.ts';

const OPTIONS = { runUrl: RUN_URL };
const issueFor = (group: FindingGroup | undefined) =>
  asIssue(toProposal(single(group), [], OPTIONS));
const byName = (name: string) => `https://assets.example/${name}`;

describe('hitsFor', () => {
  const issue = (number: number, body: string): QaIssue => ({
    number,
    title: `Issue ${number}`,
    body,
    labels: ['internal-qa'],
    state: 'open',
  });

  it('returns only the issues whose body carries the fingerprint', () => {
    const issues = [
      issue(1, 'fingerprint: 0123456789abcdef'),
      issue(2, 'fingerprint: fedcba9876543210'),
      issue(3, 'seen again: 0123456789abcdef'),
    ];

    expect(hitsFor(issues, ['0123456789abcdef']).map((hit) => hit.number)).toEqual([1, 3]);
  });
});

describe('openHit', () => {
  const hit = (number: number, state: IssueHit['state']): IssueHit => ({
    number,
    labels: ['internal-qa'],
    state,
  });

  it('does not count a closed issue as filed', () => {
    expect(openHit([hit(7, 'closed')])).toBeUndefined();
  });

  it('returns the open issue when a closed one exists too', () => {
    expect(openHit([hit(7, 'closed'), hit(12, 'open')])?.number).toBe(12);
  });
});

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
      asIssue(toProposal(single(group), [], OPTIONS))
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
      single(group),
      [issueOn(group, { number: 7, labels: ['bug', 'qa:known'], state: 'open' })],
      OPTIONS
    );

    expect(proposal).toMatchObject({ kind: 'suppressed', existingIssue: 7 });
  });

  it('turns any other hit into a comment on that issue', () => {
    const proposal = toProposal(
      single(group),
      [issueOn(group, { number: 9, labels: ['bug'], state: 'open' })],
      OPTIONS
    );

    expect(proposal).toMatchObject({ kind: 'comment', existingIssue: 9 });
    expect(proposal.kind === 'comment' && renderCommentBody(proposal)).toContain(
      `fingerprint: ${group!.fingerprint}`
    );
  });

  it('falls back to the run record when the captured system info is empty', () => {
    const [empty] = groupFindings([{ ...loaded('linux', 'claude', [finding()]), systemInfo: '' }]);
    const proposal = toProposal(single(empty), [], OPTIONS);

    expect(proposal.kind === 'issue' && proposal.system).toContain('OS: linux');
  });

  it('comments on the open issue when a closed one has the same fingerprint', () => {
    const proposal = toProposal(
      single(group),
      [
        issueOn(group, { number: 9, labels: ['bug'], state: 'closed' }),
        issueOn(group, { number: 12, labels: ['bug'], state: 'open' }),
      ],
      OPTIONS
    );

    expect(proposal).toMatchObject({ kind: 'comment', existingIssue: 12 });
  });

  it('files a bug that came back as a new issue linked to the closed one', () => {
    const proposal = toProposal(
      single(group),
      [issueOn(group, { number: 9, labels: ['bug'], state: 'closed' })],
      OPTIONS
    );

    expect(proposal).toMatchObject({ kind: 'issue', previousIssue: 9 });
    expect(proposal.kind === 'issue' && renderIssueBody(proposal, (name) => name)).toContain(
      'Seen before as #9, which is closed; this run saw it again.'
    );
  });

  it('keeps a qa:known suppression even when that issue is closed', () => {
    const proposal = toProposal(
      single(group),
      [issueOn(group, { number: 7, labels: ['bug', 'qa:known'], state: 'closed' })],
      OPTIONS
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

describe('toProposal for a cluster', () => {
  const [hmr, build] = groupFindings([
    loaded('linux', 'claude', [finding()]),
    loaded('windows', 'codex', [
      finding({
        checkId: 'build.static',
        title: 'Build fails @someone\n### Injected <!-- x',
        errorText: 'ENOSPC',
      }),
    ]),
  ]);
  const cluster = (existingIssue?: number): Cluster => ({
    lead: hmr!,
    members: [hmr!, build!],
    ...(existingIssue !== undefined ? { existingIssue } : {}),
  });
  const similar = (number: number, labels: string[], state: 'open' | 'closed') =>
    issueOn(undefined, { number, labels, state });

  it('suppresses the cluster when a non-lead member is on a qa:known issue', () => {
    const proposal = toProposal(
      cluster(),
      [issueOn(build, { number: 7, labels: ['qa:known'], state: 'closed' })],
      OPTIONS
    );

    expect(proposal).toMatchObject({ kind: 'suppressed', existingIssue: 7 });
  });

  it('files nothing for a cluster a person skipped, even with a member on an open issue', () => {
    const proposal = toProposal(
      { ...cluster(), skip: 'off by default for this framework' },
      [issueOn(build, { number: 7, labels: ['bug'], state: 'open' })],
      OPTIONS
    );

    expect(proposal).toMatchObject({
      kind: 'skipped',
      reason: 'off by default for this framework',
    });
    expect(proposal.related).toHaveLength(1);
  });

  it('names the members a suppressed cluster silences along with its lead', () => {
    const proposal = toProposal(
      cluster(),
      [issueOn(hmr, { number: 7, labels: ['qa:known'], state: 'open' })],
      OPTIONS
    );

    expect(proposal.kind).toBe('suppressed');
    expect(proposal.related.map(({ fingerprint, checkId }) => ({ fingerprint, checkId }))).toEqual([
      { fingerprint: build!.fingerprint, checkId: 'build.static' },
    ]);
  });

  it('comments on an open exact hit before an open similar issue', () => {
    const proposal = toProposal(
      cluster(20),
      [similar(20, ['bug'], 'open'), issueOn(build, { number: 9, labels: ['bug'], state: 'open' })],
      OPTIONS
    );

    expect(proposal).toMatchObject({ kind: 'comment', existingIssue: 9 });
  });

  it('comments on a similar qa:known issue instead of suppressing the cluster', () => {
    const proposal = toProposal(cluster(20), [similar(20, ['bug', 'qa:known'], 'open')], OPTIONS);

    expect(proposal).toMatchObject({ kind: 'comment', existingIssue: 20 });
  });

  it('files a new issue linked to a closed similar issue', () => {
    const proposal = toProposal(cluster(20), [similar(20, ['bug'], 'closed')], OPTIONS);

    expect(proposal).toMatchObject({ kind: 'issue', previousIssue: 20 });
  });

  it('takes the finding from the lead and the sources from every member', () => {
    const proposal = asIssue(toProposal(cluster(), [], OPTIONS));

    expect(proposal.fingerprint).toBe(hmr!.fingerprint);
    expect(proposal.title).toBe('[SB 11 QA]: New story export never reaches the sidebar');
    expect(proposal.sources.map((source) => `${source.os}/${source.engine}`)).toEqual([
      'linux/claude',
      'windows/codex',
    ]);
    expect(proposal.related).toEqual([
      {
        fingerprint: build!.fingerprint,
        checkId: 'build.static',
        title: 'Build fails @someone\n### Injected <!-- x',
        sources: [expect.objectContaining({ os: 'windows', engine: 'codex' })],
      },
    ]);
  });

  it('lists the other members inline with a neutralised title in the issue and the comment', () => {
    const line =
      'Also seen as:\n\n- `build.static` on storybookjs/mealdrop (windows, codex): Build fails `@someone` ### Injected &lt;!-- x\n';
    const comment = toProposal(
      cluster(),
      [issueOn(hmr, { number: 9, labels: ['bug'], state: 'open' })],
      OPTIONS
    );

    expect(renderIssueBody(asIssue(toProposal(cluster(), [], OPTIONS)), byName)).toContain(
      `windows, codex (gpt-5.4), sandbox none\n\n${line}`
    );
    expect(comment.kind === 'comment' && renderCommentBody(comment)).toContain(line);
  });

  it('names every member fingerprint in the metadata so a later sweep finds the issue by any', () => {
    const body = renderIssueBody(asIssue(toProposal(cluster(), [], OPTIONS)), byName);

    expect(body).toContain(
      `fingerprint: ${hmr!.fingerprint}\nfingerprints: ${hmr!.fingerprint}, ${build!.fingerprint}\n`
    );
  });

  it('renders a single-member cluster without related findings or a fingerprint list', () => {
    const body = renderIssueBody(issueFor(hmr), byName);

    expect(body).not.toContain('Also seen as');
    expect(body).not.toContain('fingerprints:');
  });
});

describe('toProposal with the publish date of the tested version', () => {
  const [group] = groupFindings([loaded('linux', 'claude', [finding()])]);
  const PUBLISHED = '2026-11-03T19:32:47Z';
  const closed = (number: number, stateReason: string, closedAt: string) => ({
    ...issueOn(group, { number, labels: ['bug'], state: 'closed' }),
    stateReason,
    closedAt,
  });

  it('suppresses a bug whose issue was closed as completed after the version was published', () => {
    const proposal = toProposal(single(group), [closed(9, 'completed', '2026-11-05T10:00:00Z')], {
      ...OPTIONS,
      publishedAt: PUBLISHED,
    });

    expect(proposal).toMatchObject({ kind: 'suppressed', existingIssue: 9, reason: 'fixed-later' });
  });

  it('files a bug again that came back after a fix the version already had', () => {
    const proposal = toProposal(single(group), [closed(9, 'completed', '2026-11-01T10:00:00Z')], {
      ...OPTIONS,
      publishedAt: PUBLISHED,
    });

    expect(proposal).toMatchObject({ kind: 'issue', previousIssue: 9 });
  });

  it('files a bug again whose issue was closed as not planned', () => {
    const proposal = toProposal(single(group), [closed(9, 'not_planned', '2026-11-05T10:00:00Z')], {
      ...OPTIONS,
      publishedAt: PUBLISHED,
    });

    expect(proposal).toMatchObject({ kind: 'issue', previousIssue: 9 });
  });

  it('files a bug again when the publish date is unknown', () => {
    const proposal = toProposal(
      single(group),
      [closed(9, 'completed', '2026-11-05T10:00:00Z')],
      OPTIONS
    );

    expect(proposal).toMatchObject({ kind: 'issue', previousIssue: 9 });
  });

  it('suppresses a later fix before commenting on an open similar issue', () => {
    const proposal = toProposal(
      { ...single(group), existingIssue: 20 },
      [
        issueOn(undefined, { number: 20, labels: ['bug'], state: 'open' }),
        closed(9, 'completed', '2026-11-05T10:00:00Z'),
      ],
      { ...OPTIONS, publishedAt: PUBLISHED }
    );

    expect(proposal).toMatchObject({ kind: 'suppressed', existingIssue: 9, reason: 'fixed-later' });
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

  it('names the version a source started on, and omits it when the run recorded none', () => {
    const base = loaded('linux', 'claude', [finding()]);
    const withBefore = {
      ...base,
      result: { ...base.result, storybookVersionBefore: '10.6.0' },
    };

    const [started] = groupFindings([withBefore]);
    const [unknown] = groupFindings([base]);

    expect(renderIssueBody(issueFor(started), byName)).toContain(
      'sandbox docker, upgraded from 10.6.0'
    );
    expect(renderIssueBody(issueFor(unknown), byName)).not.toContain('upgraded from');
  });

  it('lists each occurrence with its own version in a comment', () => {
    const [group] = groupFindings([
      loaded('linux', 'claude', [finding()]),
      loaded('windows', 'codex', [finding()]),
    ]);

    const proposal = toProposal(
      single(group),
      [issueOn(group, { number: 9, labels: ['bug'], state: 'open' })],
      OPTIONS
    );
    const body = proposal.kind === 'comment' ? renderCommentBody(proposal) : '';

    expect(body).toContain(`- ${VERSION}: linux, claude (claude-sonnet-5-5), sandbox docker`);
    expect(body).toContain(`- ${VERSION}: windows, codex (gpt-5.4), sandbox none`);
  });
});
