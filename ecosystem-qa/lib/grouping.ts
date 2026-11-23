import { openIssueOf, type Cluster, type FindingGroup, type QaIssue } from './proposals.ts';
import type { Grouping } from './schema.ts';

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

// Return what is wrong with a grouping for this collect, or nothing when every finding is in exactly
// one group and no group pulls a fingerprint away from the open issue it is already on.
//
// `filed` is the open issue each already filed fingerprint is on.
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

// Put each fingerprint in a group of its own, which proposes exactly what an ungrouped collect does.
export const identityGrouping = (fingerprints: string[]): Grouping => ({
  groups: fingerprints.map((fingerprint) => ({ members: [fingerprint] })),
});

// Turn a grouping into clusters, in the grouping's order, or return what `checkGrouping` finds wrong
// with it for these findings and issues.
export const clusterFindings = (
  groups: FindingGroup[],
  grouping: Grouping,
  issues: QaIssue[]
): { clusters: Cluster[] } | { problems: string[] } => {
  const fingerprints = groups.map((group) => group.fingerprint);
  const problems = checkGrouping(
    grouping,
    fingerprints,
    issues.map((issue) => issue.number),
    openIssueOf(issues, fingerprints)
  );
  if (problems.length > 0) {
    return { problems };
  }
  const byFingerprint = new Map(groups.map((group) => [group.fingerprint, group]));
  return {
    clusters: grouping.groups.flatMap(({ members, existingIssue, skip }) => {
      const clustered = members.flatMap((member) => byFingerprint.get(member) ?? []);
      const [lead] = clustered;
      return lead
        ? [
            {
              lead,
              members: clustered,
              ...(existingIssue !== undefined ? { existingIssue } : {}),
              ...(skip !== undefined ? { skip } : {}),
            },
          ]
        : [];
    }),
  };
};
