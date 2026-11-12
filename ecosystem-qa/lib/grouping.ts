import type { FindingGroup } from './proposals.ts';
import type { Grouping } from './schema.ts';

/** Fingerprint groups that share one root cause; `members` starts with `lead` and keeps the file's order. */
export interface Cluster {
  lead: FindingGroup;
  members: FindingGroup[];
  existingIssue?: number;
  /** Why a person decided that nothing is filed for this cluster. */
  skip?: string;
}

const onOtherIssue = (
  { members, existingIssue }: Grouping['groups'][number],
  filed: ReadonlyMap<string, number>
): string | undefined => {
  const [first, ...rest] = members.flatMap((member) => {
    const issue = filed.get(member);
    return issue === undefined ? [] : [{ member, issue }];
  });
  if (!first) {
    return undefined;
  }
  const other = rest.find(({ issue }) => issue !== first.issue);
  if (other) {
    return `holds ${first.member}, which is already on #${first.issue}, and ${other.member}, which is already on #${other.issue}; split it so that each stays on its issue`;
  }
  return existingIssue !== undefined && existingIssue !== first.issue
    ? `names #${existingIssue}, but ${first.member} is already on #${first.issue}; name #${first.issue} or take ${first.member} out`
    : undefined;
};

/**
 * Return what is wrong with a grouping for this collect, or nothing when every finding is in exactly
 * one group and no group pulls a fingerprint away from the open issue it is already on.
 *
 * @param filed The open issue each already filed fingerprint is on.
 */
export const checkGrouping = (
  grouping: Grouping,
  fingerprints: string[],
  issueNumbers: number[],
  filed: ReadonlyMap<string, number>
): string[] => {
  const counts = new Map<string, number>();
  for (const member of grouping.groups.flatMap((group) => group.members)) {
    counts.set(member, (counts.get(member) ?? 0) + 1);
  }
  const known = new Set(fingerprints);
  return [
    ...fingerprints
      .filter((fingerprint) => !counts.has(fingerprint))
      .map((fingerprint) => `${fingerprint} is in no group`),
    ...[...counts]
      .filter(([fingerprint, count]) => known.has(fingerprint) && count > 1)
      .map(([fingerprint, count]) => `${fingerprint} is listed ${count} times`),
    ...[...counts.keys()]
      .filter((fingerprint) => !known.has(fingerprint))
      .map((fingerprint) => `${fingerprint} is not a finding of this collect`),
    ...grouping.groups.flatMap(({ existingIssue }, index) =>
      existingIssue !== undefined && !issueNumbers.includes(existingIssue)
        ? [`group ${index + 1} names #${existingIssue}, which is not a listed QA issue`]
        : []
    ),
    ...grouping.groups.flatMap((group, index) => {
      const problem = onOtherIssue(group, filed);
      return problem ? [`group ${index + 1} ${problem}`] : [];
    }),
  ];
};

/** Put each fingerprint in a group of its own, which proposes exactly what an ungrouped collect does. */
export const identityGrouping = (fingerprints: string[]): Grouping => ({
  groups: fingerprints.map((fingerprint) => ({ members: [fingerprint] })),
});

/** Turn a grouping that passed `checkGrouping` into clusters, in the grouping's order. */
export const clusterFindings = (groups: FindingGroup[], grouping: Grouping): Cluster[] => {
  const byFingerprint = new Map(groups.map((group) => [group.fingerprint, group]));
  return grouping.groups.map(({ members, existingIssue, skip }) => {
    const clustered = members.map((member) => byFingerprint.get(member)!);
    return {
      lead: clustered[0]!,
      members: clustered,
      ...(existingIssue !== undefined ? { existingIssue } : {}),
      ...(skip !== undefined ? { skip } : {}),
    };
  });
};
