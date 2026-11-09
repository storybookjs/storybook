import { describe, expect, it } from 'vitest';

import { planFiling, type FilingStep } from './filing.ts';
import { asIssue, finding, loaded, RUN_URL, VERSION } from './fixtures.ts';
import { groupFindings, toProposal, type IssueHit } from './proposals.ts';
import type { Finding } from './types.ts';

const REPO = 'storybookjs/storybook';

const proposalFor = (
  findingOverrides: Partial<Finding> = {},
  hits: IssueHit[] = [],
  headSha?: string | null
) => {
  const [group] = groupFindings([loaded('linux', 'claude', [finding(findingOverrides)], headSha)]);
  return toProposal(group!, hits, RUN_URL);
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
        { name: 'hmr.png', localPath: 'results/mealdrop/linux/claude/evidence/hmr.png' },
        {
          name: 'baseline/dev.log',
          localPath: 'results/mealdrop/linux/claude/evidence/baseline/dev.log',
        },
        {
          name: 'upgraded/dev.log',
          localPath: 'results/mealdrop/linux/claude/evidence/upgraded/dev.log',
        },
      ],
    });
    expect(issueBody(steps)).toContain(`(${assets}/hmr.png)`);
    expect(issueBody(steps)).toContain(`- [baseline/dev.log](${assets}/baseline/dev.log)`);
    expect(issueBody(steps)).toContain(`- [upgraded/dev.log](${assets}/upgraded/dev.log)`);
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

  it('comments once on the matching issue', () => {
    const proposal = proposalFor({}, [{ number: 9, labels: ['bug'] }]);
    const [comment] = planFiling(proposal, { repo: REPO, evidenceLinks: 'assets', comments: [] });

    const again = planFiling(proposal, {
      repo: REPO,
      evidenceLinks: 'assets',
      comments: ['unrelated', comment?.kind === 'comment' ? comment.body : ''],
    });

    expect(comment).toMatchObject({ kind: 'comment', issue: 9 });
    expect(again).toEqual([{ kind: 'skip', reason: '#9 already has this comment' }]);
  });

  it('files nothing for a qa:known issue', () => {
    const proposal = proposalFor({}, [{ number: 7, labels: ['qa:known'] }]);

    expect(planFiling(proposal, { repo: REPO, evidenceLinks: 'assets' })).toEqual([
      { kind: 'skip', reason: '#7 is labelled qa:known' },
    ]);
  });
});
