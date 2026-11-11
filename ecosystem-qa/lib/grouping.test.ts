import { describe, expect, it } from 'vitest';

import { finding, loaded } from './fixtures.ts';
import { checkGrouping, clusterFindings, identityGrouping } from './grouping.ts';
import { groupFindings } from './proposals.ts';

const A = 'aaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbb';
const C = 'cccccccccccccccc';

describe('checkGrouping', () => {
  it('accepts a grouping that puts every fingerprint in exactly one group', () => {
    expect(
      checkGrouping(
        { groups: [{ members: [B, A], existingIssue: 7 }, { members: [C] }] },
        [A, B, C],
        [7]
      )
    ).toEqual([]);
  });

  it('names a fingerprint that is in no group', () => {
    expect(checkGrouping({ groups: [{ members: [A] }] }, [A, B], [])).toEqual([
      `${B} is in no group`,
    ]);
  });

  it('names a fingerprint listed twice, in one group or across groups', () => {
    expect(
      checkGrouping(
        { groups: [{ members: [A, A] }, { members: [B] }, { members: [B] }] },
        [A, B],
        []
      )
    ).toEqual([`${A} is listed 2 times`, `${B} is listed 2 times`]);
  });

  it('names a fingerprint that this collect did not produce', () => {
    expect(checkGrouping({ groups: [{ members: [A, C] }] }, [A], [])).toEqual([
      `${C} is not a finding of this collect`,
    ]);
  });

  it('names an existing issue that is not one of the listed QA issues', () => {
    expect(checkGrouping({ groups: [{ members: [A], existingIssue: 8 }] }, [A], [7])).toEqual([
      'group 1 names #8, which is not a listed QA issue',
    ]);
  });
});

describe('identityGrouping', () => {
  it('puts each fingerprint in a group of its own', () => {
    const grouping = identityGrouping([A, B]);

    expect(grouping).toEqual({ groups: [{ members: [A] }, { members: [B] }] });
    expect(checkGrouping(grouping, [A, B], [])).toEqual([]);
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
});
