import { describe, expect, it } from 'vitest';

import {
  missingPrerequisites,
  planFiling,
  renderDry,
  renderFilingReport,
  reportedOn,
  type FilingStep,
} from './filing.ts';
import { asIssue, finding, issueOn, loaded, RUN_URL, single, VERSION } from './fixtures.ts';
import { groupFindings, toProposal, type IssueHit } from './proposals.ts';
import type { Finding } from './schema.ts';

const REPO = 'storybookjs/storybook';

const proposalFor = (
  findingOverrides: Partial<Finding> = {},
  hits: IssueHit[] = [],
  headSha?: string | null
) => {
  const [group] = groupFindings([loaded('linux', 'claude', [finding(findingOverrides)], headSha)]);
  return toProposal(
    single(group),
    hits.map((hit) => issueOn(group, hit)),
    { runUrl: RUN_URL }
  );
};

const kinds = (steps: FilingStep[]) => steps.map((step) => step.kind);
const issueBody = (steps: FilingStep[]) =>
  steps.flatMap((step) => (step.kind === 'create-issue' ? [step.body] : [])).join('');

describe('planFiling', () => {
  it('pushes the cycle branch, then the evidence, then creates the issue', () => {
    const proposal = asIssue(proposalFor());

    const steps = planFiling(proposal, { repo: REPO, evidenceLinks: 'assets' });

    expect(kinds(steps)).toEqual(['push-cycle', 'push-evidence', 'create-issue']);
    expect(steps[0]).toMatchObject({
      repo: 'storybookjs/mealdrop',
      branch: `qa/sb-${VERSION}/linux-claude`,
      headSha: 'b'.repeat(40),
      bundle: 'results/mealdrop/linux/claude/cycle.bundle',
    });
  });

  it('links evidence on the assets branch and keeps files with the same base name apart', () => {
    const proposal = asIssue(
      proposalFor({
        evidence: { png: 'hmr.png', logs: ['baseline/dev.log', 'upgraded/dev.log'] },
      })
    );
    const assets = `https://raw.githubusercontent.com/${REPO}/qa-assets/${proposal.assetDir}`;

    const steps = planFiling(proposal, { repo: REPO, evidenceLinks: 'assets' });

    expect(steps[1]).toMatchObject({
      kind: 'push-evidence',
      files: [
        { name: 'hmr.png', localPath: 'results/mealdrop/linux/claude/evidence/hmr.png', bytes: 0 },
        {
          name: 'baseline/dev.log',
          localPath: 'results/mealdrop/linux/claude/evidence/baseline/dev.log',
          bytes: 0,
        },
        {
          name: 'upgraded/dev.log',
          localPath: 'results/mealdrop/linux/claude/evidence/upgraded/dev.log',
          bytes: 0,
        },
      ],
    });
    expect(issueBody(steps)).toContain(`(${assets}/hmr.png)`);
    expect(issueBody(steps)).toContain(`- [baseline/dev.log](${assets}/baseline/dev.log)`);
    expect(issueBody(steps)).toContain(`- [upgraded/dev.log](${assets}/upgraded/dev.log)`);
  });

  it('keeps a file over the cap out of the push and says so in the issue', () => {
    const proposal = asIssue(
      proposalFor({ evidence: { png: 'hmr.png', logs: ['upgraded/dev.log'] } })
    );
    const big = {
      ...proposal,
      evidence: proposal.evidence.map((file) =>
        file.name === 'upgraded/dev.log' ? { ...file, bytes: 48 * 1024 * 1024 } : file
      ),
    };

    const steps = planFiling(big, { repo: REPO, evidenceLinks: 'assets' });

    expect(steps[1]).toMatchObject({ kind: 'push-evidence', files: [{ name: 'hmr.png' }] });
    expect(issueBody(steps)).toContain(
      '- `upgraded/dev.log` (48 MB, kept out of the evidence branch)'
    );
    expect(issueBody(steps)).not.toContain('upgraded/dev.log)');
  });

  it('links the downloaded files in a dry run', () => {
    const steps = planFiling(asIssue(proposalFor()), { repo: REPO, evidenceLinks: 'local' });

    expect(issueBody(steps)).toContain(
      '- [dev.log](results/mealdrop/linux/claude/evidence/dev.log)'
    );
  });

  it('skips the pushes it has nothing for', () => {
    const proposal = asIssue(proposalFor({ evidence: { logs: [] } }, [], null));

    expect(kinds(planFiling(proposal, { repo: REPO, evidenceLinks: 'assets' }))).toEqual([
      'create-issue',
    ]);
  });

  it('files nothing for a fingerprint that is already on an issue', () => {
    const steps = planFiling(asIssue(proposalFor()), {
      repo: REPO,
      evidenceLinks: 'assets',
      filedAs: 12,
    });

    expect(steps).toEqual([{ kind: 'skip', reason: 'already filed as #12' }]);
  });

  it('pushes the cycle ref, then comments once on the matching issue', () => {
    const proposal = proposalFor({}, [{ number: 9, labels: ['bug'], state: 'open' }]);
    const steps = planFiling(proposal, { repo: REPO, evidenceLinks: 'assets', existing: [] });
    const comment = steps.at(-1);

    const again = planFiling(proposal, {
      repo: REPO,
      evidenceLinks: 'assets',
      existing: ['unrelated', comment?.kind === 'comment' ? comment.body : ''],
    });

    expect(kinds(steps)).toEqual(['push-cycle', 'comment']);
    expect(comment).toMatchObject({ kind: 'comment', issue: 9 });
    expect(again).toEqual([{ kind: 'skip', reason: '#9 already has this sighting' }]);
  });

  it('does not report a sighting again when another run collects the same result', () => {
    const [group] = groupFindings([loaded('linux', 'claude', [finding()])]);
    const filed = asIssue(toProposal(single(group), [], { runUrl: RUN_URL }));
    const issue = {
      ...issueOn(group, { number: 9, labels: ['bug'], state: 'open' }),
      body: issueBody(planFiling(filed, { repo: REPO, evidenceLinks: 'assets' })),
    };
    const collectedAgain = toProposal(single(group), [issue], { runUrl: `${RUN_URL}0` });

    expect(
      planFiling(collectedAgain, {
        repo: REPO,
        evidenceLinks: 'assets',
        existing: reportedOn([issue], 9, []),
      })
    ).toEqual([{ kind: 'skip', reason: '#9 already has this sighting' }]);
  });

  it('takes what an issue already reports from its own body and then its comments', () => {
    const issues = [
      { number: 8, body: 'another issue' },
      { number: 9, body: 'the issue' },
    ];

    expect(reportedOn(issues, 9, ['first comment'])).toEqual(['the issue', 'first comment']);
  });

  it('reports the sighting of a later run of the same repo', () => {
    const hit: IssueHit = { number: 9, labels: ['bug'], state: 'open' };
    const first = planFiling(proposalFor({}, [hit]), {
      repo: REPO,
      evidenceLinks: 'assets',
      existing: [],
    }).at(-1);
    const later = proposalFor({}, [hit], 'd'.repeat(40));

    const steps = planFiling(later, {
      repo: REPO,
      evidenceLinks: 'assets',
      existing: [first?.kind === 'comment' ? first.body : ''],
    });

    expect(kinds(steps)).toEqual(['push-cycle', 'comment']);
  });

  it('says that a suppressed bug was fixed after the tested version', () => {
    const [group] = groupFindings([loaded('linux', 'claude', [finding()])]);
    const fixed = {
      ...issueOn(group, { number: 7, labels: ['bug'], state: 'closed' }),
      stateReason: 'completed',
      closedAt: '2026-11-05T10:00:00Z',
    };
    const proposal = toProposal(single(group), [fixed], {
      runUrl: RUN_URL,
      publishedAt: '2026-11-03T19:32:47Z',
    });

    expect(planFiling(proposal, { repo: REPO, evidenceLinks: 'assets' })).toEqual([
      { kind: 'skip', reason: `fixed in #7 after ${VERSION} was published` },
    ]);
  });

  it('files nothing for a qa:known issue', () => {
    const proposal = proposalFor({}, [{ number: 7, labels: ['qa:known'], state: 'open' }]);

    expect(planFiling(proposal, { repo: REPO, evidenceLinks: 'assets' })).toEqual([
      { kind: 'skip', reason: '#7 is labelled qa:known' },
    ]);
  });
});

describe('missingPrerequisites', () => {
  it('names the milestones and labels a new issue needs that the repository lacks', () => {
    const issue = proposalFor({ windowsOnly: true });
    const comment = proposalFor({ title: 'Other' }, [{ number: 9, labels: [], state: 'open' }]);

    expect(
      missingPrerequisites([issue, comment], {
        openMilestones: ['10'],
        labels: ['bug', 'internal-qa'],
      })
    ).toEqual([
      'milestone "11" does not exist or is closed',
      'label "upgrade:11.0" does not exist',
    ]);
    expect(
      missingPrerequisites([issue], {
        openMilestones: ['11'],
        labels: ['bug', 'internal-qa', 'upgrade:11.0'],
      })
    ).toEqual([]);
  });
});

describe('renderFilingReport', () => {
  it('lists every proposal with its result and counts the failures', () => {
    const filed = proposalFor();
    const failed = proposalFor({ title: 'a | b' });

    const report = renderFilingReport([
      {
        proposal: filed,
        state: 'done',
        detail: 'https://github.com/storybookjs/storybook/issues/1',
      },
      { proposal: failed, state: 'failed', detail: 'HTTP 502' },
    ]);

    expect(report).toContain('2 proposals, 1 failed.');
    expect(report).toContain(
      `| \`${failed.fingerprint}\` | issue | [SB 11 QA]: a \\| b | failed: HTTP 502 |`
    );
  });
});

describe('renderDry', () => {
  it('lists every finding that a suppressed group silences', () => {
    const [hmr, build] = groupFindings([
      loaded('linux', 'claude', [
        finding(),
        finding({ checkId: 'build.static', title: 'Build fails', errorText: 'ENOSPC' }),
      ]),
    ]);
    const proposal = toProposal(
      { lead: hmr!, members: [hmr!, build!] },
      [
        {
          ...issueOn(hmr, { number: 7, labels: ['qa:known'], state: 'open' }),
          body: `fingerprints: ${hmr!.fingerprint}, ${build!.fingerprint}`,
        },
      ],
      { runUrl: RUN_URL }
    );

    const summary = renderDry(proposal, REPO);

    expect(summary).toContain(`<code>${hmr!.fingerprint}</code> and 1 more</summary>`);
    expect(summary).toContain('Silenced with it:');
    expect(summary).toContain(
      '- `build.static` on storybookjs/mealdrop (linux, claude): Build fails'
    );
  });

  it('shows the reason and the members of a group a person skipped', () => {
    const [hmr, build] = groupFindings([
      loaded('linux', 'claude', [
        finding(),
        finding({ checkId: 'build.static', title: 'Build fails', errorText: 'ENOSPC' }),
      ]),
    ]);
    const proposal = toProposal({ lead: hmr!, members: [hmr!, build!], skip: 'by design' }, [], {
      runUrl: RUN_URL,
    });

    const summary = renderDry(proposal, REPO);

    expect(planFiling(proposal, { repo: REPO, evidenceLinks: 'assets' })).toEqual([
      { kind: 'skip', reason: 'skipped by hand: by design' },
    ]);
    expect(summary).toContain('Skip: skipped by hand: by design.');
    expect(summary).toContain(
      '- `build.static` on storybookjs/mealdrop (linux, claude): Build fails'
    );
  });

  it('adds nothing for a suppressed finding that stands alone', () => {
    const proposal = proposalFor({}, [{ number: 7, labels: ['qa:known'], state: 'open' }]);

    const summary = renderDry(proposal, REPO);

    expect(summary).toContain(`<code>${proposal.fingerprint}</code></summary>`);
    expect(summary).not.toContain('Silenced with it:');
  });
});
