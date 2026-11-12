import { describe, expect, it } from 'vitest';

import { finding, loaded } from './fixtures.ts';
import { checkGrouping, clusterFindings, identityGrouping } from './grouping.ts';
import { groupFindings } from './proposals.ts';

const A = 'aaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbb';
const C = 'cccccccccccccccc';
const NOT_FILED = new Map<string, number>();

describe('checkGrouping', () => {
  it('accepts a grouping that puts every fingerprint in exactly one group', () => {
    expect(
      checkGrouping(
        { groups: [{ members: [B, A], existingIssue: 7 }, { members: [C] }] },
        [A, B, C],
        [7],
        NOT_FILED
      )
    ).toEqual([]);
  });

  it('names a fingerprint that is in no group', () => {
    expect(checkGrouping({ groups: [{ members: [A] }] }, [A, B], [], NOT_FILED)).toEqual([
      `${B} is in no group`,
    ]);
  });

  it('names a fingerprint listed twice, in one group or across groups', () => {
    expect(
      checkGrouping(
        { groups: [{ members: [A, A] }, { members: [B] }, { members: [B] }] },
        [A, B],
        [],
        NOT_FILED
      )
    ).toEqual([`${A} is listed 2 times`, `${B} is listed 2 times`]);
  });

  it('names a fingerprint that this collect did not produce', () => {
    expect(checkGrouping({ groups: [{ members: [A, C] }] }, [A], [], NOT_FILED)).toEqual([
      `${C} is not a finding of this collect`,
    ]);
  });

  it('names an existing issue that is not one of the listed QA issues', () => {
    expect(
      checkGrouping({ groups: [{ members: [A], existingIssue: 8 }] }, [A], [7], NOT_FILED)
    ).toEqual(['group 1 names #8, which is not a listed QA issue']);
  });

  it('names a group whose members are already on different open issues', () => {
    expect(
      checkGrouping(
        { groups: [{ members: [C, A, B] }] },
        [A, B, C],
        [7, 8],
        new Map([
          [A, 7],
          [B, 8],
        ])
      )
    ).toEqual([
      `group 1 holds ${A}, which is already on #7, and ${B}, which is already on #8; split it so that each stays on its issue`,
    ]);
  });

  it('names a group that names another issue than the one a member is already on', () => {
    expect(
      checkGrouping(
        { groups: [{ members: [B, A], existingIssue: 8 }] },
        [A, B],
        [7, 8],
        new Map([[A, 7]])
      )
    ).toEqual([`group 1 names #8, but ${A} is already on #7; name #7 or take ${A} out`]);
  });

  it('accepts a group that stays on the issue its members are already on', () => {
    const filed = new Map([
      [A, 7],
      [B, 7],
    ]);

    expect(
      checkGrouping({ groups: [{ members: [C, A, B], existingIssue: 7 }] }, [A, B, C], [7], filed)
    ).toEqual([]);
    expect(checkGrouping({ groups: [{ members: [C, A, B] }] }, [A, B, C], [7], filed)).toEqual([]);
  });
});

describe('identityGrouping', () => {
  it('puts each fingerprint in a group of its own', () => {
    const grouping = identityGrouping([A, B]);

    expect(grouping).toEqual({ groups: [{ members: [A] }, { members: [B] }] });
    expect(checkGrouping(grouping, [A, B], [], NOT_FILED)).toEqual([]);
  });
});

describe('clusterFindings', () => {
  it('leads each cluster with its first member and keeps the order of the file', () => {
    const groups = groupFindings([
      loaded('linux', 'claude', [
        finding(),
        finding({ checkId: 'build.static', title: 'Build fails', errorText: 'ENOSPC' }),
        finding({ checkId: 'test.vitest-cli', title: 'Vitest fails', errorText: 'EBADF' }),
      ]),
    ]);
    const [hmr, build, vitest] = groups.map((group) => group.fingerprint);

    const clusters = clusterFindings(groups, {
      groups: [{ members: [vitest!] }, { members: [build!, hmr!], existingIssue: 7 }],
    });

    expect(
      clusters.map(({ lead, members, existingIssue }) => ({
        lead: lead.finding.title,
        members: members.map((member) => member.finding.title),
        existingIssue,
      }))
    ).toEqual([
      { lead: 'Vitest fails', members: ['Vitest fails'], existingIssue: undefined },
      {
        lead: 'Build fails',
        members: ['Build fails', 'New story export never reaches the sidebar'],
        existingIssue: 7,
      },
    ]);
  });

  it('carries the reason of a skipped group to its cluster', () => {
    const groups = groupFindings([loaded('linux', 'claude', [finding()])]);

    const [cluster] = clusterFindings(groups, {
      groups: [{ members: [groups[0]!.fingerprint], skip: 'by design' }],
    });

    expect(cluster!.skip).toBe('by design');
  });
});
