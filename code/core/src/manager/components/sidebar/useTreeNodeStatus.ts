import type { TreeEntry } from '../../../utils/tree.ts';

export function getTreeNodeStatus(item: TreeEntry): unknown {
  const { changeStatus: localChange, testStatus: localTest } = getChangeDetectionStatus(
    statuses || {}
  );
  const groupDual = groupDualStatus?.[item.id] || {
    change: 'status-value:unknown' as StatusValue,
    test: 'status-value:unknown' as StatusValue,
  };
  const branchChange = getMostCriticalStatusValue([localChange, groupDual.change]);
  const branchTest = getMostCriticalStatusValue([localTest, groupDual.test]);

  const shouldShowBranchChangeIcon =
    branchChange !== 'status-value:unknown' &&
    branchChange !== 'status-value:affected' &&
    (branchChange !== 'status-value:modified' || isModifiedFilterActive);
  const branchChangeIcon = shouldShowBranchChangeIcon ? getStatus(theme, branchChange).icon : null;
  const branchTestIcon = getStatus(theme, branchTest).icon;

  const overallStatus = getMostCriticalStatusValue([branchChange, branchTest]);
  const color = overallStatus ? getStatus(theme, overallStatus).textColor : null;

  const itemStatus = getMostCriticalStatusValue(Object.values(statuses || {}).map((s) => s.value));
  const { icon: statusIcon, textColor: statusTextColor } = getStatus(theme, itemStatus);

  const showBranchStatus =
    itemStatus === 'status-value:error' || itemStatus === 'status-value:warning';

  return {
    statusIcon,
    statusTextColor,
    branchChangeIcon,
    branchTestIcon,
    color,
    showBranchStatus,
  };
}
