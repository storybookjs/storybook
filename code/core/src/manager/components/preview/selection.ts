export const getPreviewSelectionKey = (storyId: string, refId?: string) =>
  `${refId ?? '__local__'}:${storyId}`;

export const shouldSyncPreviewSelection = ({
  currentSelectionKey,
  previousSelectionKey,
  refId,
  hasInitializedSelection,
}: {
  currentSelectionKey: string;
  previousSelectionKey: string;
  refId?: string;
  hasInitializedSelection: boolean;
}) => currentSelectionKey !== previousSelectionKey || Boolean(refId && !hasInitializedSelection);
