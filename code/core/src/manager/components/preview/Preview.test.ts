import { describe, expect, it } from 'vitest';

import { getPreviewSelectionKey, shouldSyncPreviewSelection } from './selection';

describe('shouldSyncPreviewSelection', () => {
  it('skips the initial local selection when nothing changed', () => {
    const selectionKey = getPreviewSelectionKey('button--primary');

    expect(
      shouldSyncPreviewSelection({
        currentSelectionKey: selectionKey,
        previousSelectionKey: selectionKey,
        hasInitializedSelection: false,
      })
    ).toBe(false);
  });

  it('syncs an initial composed selection even when the route key is unchanged', () => {
    const selectionKey = getPreviewSelectionKey('button--primary', 'external');

    expect(
      shouldSyncPreviewSelection({
        currentSelectionKey: selectionKey,
        previousSelectionKey: selectionKey,
        refId: 'external',
        hasInitializedSelection: false,
      })
    ).toBe(true);
  });

  it('syncs when the selected story changes', () => {
    expect(
      shouldSyncPreviewSelection({
        currentSelectionKey: getPreviewSelectionKey('button--secondary'),
        previousSelectionKey: getPreviewSelectionKey('button--primary'),
        hasInitializedSelection: true,
      })
    ).toBe(true);
  });
});
