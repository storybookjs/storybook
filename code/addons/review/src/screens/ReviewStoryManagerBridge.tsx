import React, { useContext, useEffect, useMemo, type FC, type ReactNode } from 'react';

import { SET_CURRENT_STORY } from 'storybook/internal/core-events';

import { ManagerContext } from 'storybook/manager-api';

interface ReviewStoryManagerBridgeProps {
  storyId: string;
  isPanelShown: boolean;
  togglePanel: (next?: boolean) => void;
  children: ReactNode;
}

/**
 * Overrides manager context for the review detail chrome so toolbar tools and
 * addon panels resolve the explicit review story without navigating away from
 * the review URL.
 */
export const ReviewStoryManagerBridge: FC<ReviewStoryManagerBridgeProps> = ({
  storyId,
  isPanelShown,
  togglePanel,
  children,
}) => {
  const parent = useContext(ManagerContext);

  useEffect(() => {
    const entry = parent.api.getData(storyId);
    if (entry?.id) {
      parent.api.emit(SET_CURRENT_STORY, {
        storyId: entry.id,
        viewMode: 'story',
      });
    }
  }, [parent.api, storyId]);

  const value = useMemo(() => {
    const entry = parent.api.getData(storyId);
    return {
      state: {
        ...parent.state,
        storyId,
        viewMode: 'story' as const,
        path: `/story/${storyId}`,
      },
      api: {
        ...parent.api,
        getCurrentStoryData: () => entry ?? parent.api.getData(storyId),
        getIsPanelShown: () => isPanelShown,
        togglePanel: (next?: boolean) => togglePanel(next),
      },
    };
  }, [isPanelShown, parent.api, parent.state, storyId, togglePanel]);

  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>;
};
