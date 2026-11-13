import { describe, expect, it } from 'vitest';

import {
  missingPrerequisites,
  planFiling,
  renderDry,
  renderFilingReport,
  type FilingStep,
} from './filing.ts';
import {
  asIssue,
  finding,
  issueOn,
  loaded,
  metadata,
  RUN_URL,
  single,
  VERSION,
} from './fixtures.ts';
import { groupFindings, toProposal, writtenOn, type Cluster, type IssueHit } from './proposals.ts';
import type { LoadedResult } from './results.ts';
import type { Engine, Finding, Os, Proposal } from './schema.ts';

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

  it('files nothing when the issue filed in the meantime has every sighting of the proposal', () => {
    const proposal = asIssue(proposalFor());
    const body = issueBody(planFiling(proposal, { repo: REPO, evidenceLinks: 'assets' }));

    expect(
      planFiling(proposal, { repo: REPO, evidenceLinks: 'assets', filedAs: 12, existing: [body] })
    ).toEqual([{ kind: 'skip', reason: 'already filed as #12' }]);
  });

  it('comments on an issue filed in the meantime that lacks a finding of the group', () => {
    const build = finding({ checkId: 'build.static', title: 'Build fails', errorText: 'ENOSPC' });
    const [buildGroup, hmrGroup] = groupFindings([
      loaded('linux', 'claude', [build]),
      loaded('windows', 'claude', [finding()]),
    ]);
    const alone = asIssue(toProposal(single(buildGroup), [], { runUrl: RUN_URL }));
    const both = asIssue(
      toProposal({ lead: hmrGroup!, members: [hmrGroup!, buildGroup!] }, [], { runUrl: RUN_URL })
    );

    const steps = planFiling(both, {
      repo: REPO,
      evidenceLinks: 'assets',
      filedAs: 12,
      existing: [issueBody(planFiling(alone, { repo: REPO, evidenceLinks: 'assets' }))],
    });

    expect(kinds(steps)).toEqual(['push-cycle', 'comment']);
    expect(steps.at(-1)).toMatchObject({
      kind: 'comment',
      issue: 12,
      body: expect.stringContaining(hmrGroup!.fingerprint),
    });
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
        existing: writtenOn(issue),
      })
    ).toEqual([{ kind: 'skip', reason: '#9 already has this sighting' }]);
  });

  describe('for a later run of the same finding', () => {
    const hit: IssueHit = { number: 9, labels: ['bug'], state: 'open' };
    const commentFor = (...runs: LoadedResult[]) => {
      const [group] = groupFindings(runs);
      return toProposal(single(group), [issueOn(group, hit)], { runUrl: RUN_URL });
    };
    const bodyOf = (steps: FilingStep[]) => {
      const comment = steps.at(-1);
      return comment?.kind === 'comment' ? comment.body : '';
    };
    const firstComment = bodyOf(
      planFiling(commentFor(loaded('linux', 'claude', [finding()])), {
        repo: REPO,
        evidenceLinks: 'assets',
        existing: [],
      })
    );
    const later = (os: Os, engine: Engine, change: (run: LoadedResult) => void = () => {}) => {
      const run = loaded(os, engine, [finding()], 'd'.repeat(40));
      change(run);
      return commentFor(run);
    };
    const stepsOn = (proposal: Proposal, existing: string[]) =>
      planFiling(proposal, { repo: REPO, evidenceLinks: 'assets', existing });

    it('skips it as a repeat when the issue has its version, repo, system and engine', () => {
      expect(stepsOn(later('linux', 'claude'), [firstComment])).toEqual([
        {
          kind: 'skip',
          reason: `repeat: #9 already has a sighting on every version, repo, system and engine it reports: ${VERSION} on storybookjs/mealdrop (linux, claude)`,
        },
      ]);
    });

    it.each<[string, () => Proposal]>([
      [
        'a new repo',
        () =>
          later('linux', 'claude', (run) => {
            run.cycle.repo = 'storybookjs/other';
          }),
      ],
      [
        'a new version',
        () =>
          later('linux', 'claude', (run) => {
            run.result.request.version = '11.0.0-beta.1';
          }),
      ],
      ['a new system', () => later('windows', 'claude')],
      ['a new engine', () => later('linux', 'codex')],
    ])('comments when the run is on %s', (_, proposal) => {
      expect(kinds(stepsOn(proposal(), [firstComment]))).toEqual(['push-cycle', 'comment']);
    });

    it('comments when only one of its runs is new to the issue', () => {
      const proposal = commentFor(
        loaded('linux', 'claude', [finding()], 'd'.repeat(40)),
        loaded('windows', 'claude', [finding()], 'e'.repeat(40))
      );

      expect(kinds(stepsOn(proposal, [firstComment]))).toEqual(['push-cycle', 'comment']);
    });

    it('skips a later run of any of the runs that one comment reported', () => {
      const twoSystems = bodyOf(
        stepsOn(
          commentFor(
            loaded('linux', 'claude', [finding()]),
            loaded('windows', 'claude', [finding()])
          ),
          []
        )
      );

      expect(kinds(stepsOn(later('windows', 'claude'), [twoSystems]))).toEqual(['skip']);
    });

    // As the harness wrote it before blocks had a sightings line, from an issue on GitHub.
    const oldBlock = (os: string) =>
      [
        'Seen again by the ecosystem QA agent on:',
        '',
        '<!-- sb-qa-metadata -->',
        '```yaml',
        'fingerprint: 5b34acfdc0f977e0',
        `storybook: ${VERSION}`,
        'repo: storybookjs/mealdrop',
        'sha: 8c128505ea4140fd53aa25543b0f0a3b200a9c38',
        'cycleRef: refs/qa/cycles/qa/sb-11.0.0-beta.0/linux-claude',
        `os: ${os}`,
        'engine: claude',
        'model: claude-haiku-5-5',
        'run: https://github.com/storybookjs/storybook/actions/runs/2',
        '```',
        '',
      ].join('\n');

    it('skips it as a repeat of a block written before blocks listed what they saw', () => {
      expect(kinds(stepsOn(later('linux', 'claude'), [oldBlock('linux')]))).toEqual(['skip']);
    });

    it('reads the repo, system and engine that such a block lists for its other members', () => {
      const block = oldBlock('linux, windows').replace(
        '<!-- sb-qa-metadata -->',
        [
          'Also seen as:',
          '',
          '- `build.static` on storybookjs/mealdrop (windows, claude): Build fails: ENOSPC',
          '',
          '<!-- sb-qa-metadata -->',
        ].join('\n')
      );

      expect(kinds(stepsOn(later('windows', 'claude'), [block]))).toEqual(['skip']);
      expect(kinds(stepsOn(later('windows', 'codex'), [block]))).toEqual(['push-cycle', 'comment']);
    });

    it('reads only the first run of such a block that lists several systems', () => {
      const block = oldBlock('linux, windows');

      expect(kinds(stepsOn(later('linux', 'claude'), [block]))).toEqual(['skip']);
      expect(kinds(stepsOn(later('windows', 'claude'), [block]))).toEqual([
        'push-cycle',
        'comment',
      ]);
    });
  });

  describe('for a group of two findings that is already filed', () => {
    const build = finding({ checkId: 'build.static', title: 'Build fails', errorText: 'ENOSPC' });
    const run = loaded('linux', 'claude', [finding(), build]);
    const [hmrGroup, buildGroup] = groupFindings([run]);
    const filed = asIssue(
      toProposal({ lead: hmrGroup!, members: [hmrGroup!, buildGroup!] }, [], { runUrl: RUN_URL })
    );
    const issue = {
      ...issueOn(hmrGroup, { number: 9, labels: ['bug'], state: 'open' }),
      body: issueBody(planFiling(filed, { repo: REPO, evidenceLinks: 'assets' })),
    };
    const stepsFor = (cluster: Cluster, existing = writtenOn(issue)) =>
      planFiling(toProposal(cluster, [issue], { runUrl: `${RUN_URL}0` }), {
        repo: REPO,
        evidenceLinks: 'assets',
        existing,
      });
    const skipped = [{ kind: 'skip', reason: '#9 already has this sighting' }];

    it('adds no comment when the same findings come back in another order', () => {
      expect(stepsFor({ lead: buildGroup!, members: [buildGroup!, hmrGroup!] })).toEqual(skipped);
    });

    it('adds no comment for one of the findings on its own', () => {
      expect(stepsFor(single(buildGroup))).toEqual(skipped);
    });

    const elsewhere: LoadedResult = {
      ...loaded('linux', 'claude', [build], 'e'.repeat(40)),
      resultPath: 'results/other/linux/claude/result.json',
    };
    elsewhere.cycle.repo = 'storybookjs/other';
    const [hmrAgain, buildTwice] = groupFindings([run, elsewhere]);
    const withNewRepo: Cluster = { lead: hmrAgain!, members: [hmrAgain!, buildTwice!] };
    const withoutKeys = issue.body.replace(/^sightings: .*\n/m, '');

    it('comments when a member is seen in another repo behind an unchanged lead', () => {
      expect(buildTwice!.occurrences).toHaveLength(2);
      expect(kinds(stepsFor(withNewRepo))).toEqual(['push-cycle', 'comment']);
    });

    it('recognises a sighting that was filed before sightings had keys', () => {
      expect(withoutKeys).not.toBe(issue.body);
      expect(
        stepsFor({ lead: buildGroup!, members: [buildGroup!, hmrGroup!] }, [withoutKeys])
      ).toEqual(skipped);
    });

    it('comments for a member in another repo also when the issue has no sighting keys', () => {
      expect(kinds(stepsFor(withNewRepo, [withoutKeys]))).toEqual(['push-cycle', 'comment']);
    });
  });

  it('says that a suppressed bug was fixed after the tested version', () => {
    const [group] = groupFindings([loaded('linux', 'claude', [finding()])]);
    const fixed = {
      ...issueOn(group, { number: 7, labels: ['bug'], state: 'closed' }),
      completedAt: '2026-11-05T10:00:00Z',
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
          body: metadata(hmr!.fingerprint, build!.fingerprint),
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

  it('names a comment it skips as a repeat, with the reason', () => {
    const hit: IssueHit = { number: 9, labels: ['bug'], state: 'open' };
    const first = proposalFor({}, [hit]);
    const filed = planFiling(first, { repo: REPO, evidenceLinks: 'assets', existing: [] }).at(-1);
    const later = proposalFor({}, [hit], 'd'.repeat(40));

    const summary = renderDry(later, REPO, {
      existing: [filed?.kind === 'comment' ? filed.body : ''],
    });

    expect(summary).toContain('<summary><b>comment</b>, skipped [SB 11 QA]:');
    expect(summary).toContain(
      `1. Skip: repeat: #9 already has a sighting on every version, repo, system and engine it reports: ${VERSION} on storybookjs/mealdrop (linux, claude).`
    );
    expect(summary).not.toContain('Seen again by the ecosystem QA agent on:');
  });

  it('adds nothing for a suppressed finding that stands alone', () => {
    const proposal = proposalFor({}, [{ number: 7, labels: ['qa:known'], state: 'open' }]);

    const summary = renderDry(proposal, REPO);

    expect(summary).toContain(`<code>${proposal.fingerprint}</code></summary>`);
    expect(summary).not.toContain('Silenced with it:');
  });
});
