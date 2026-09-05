import React from 'react';

import { Badge } from 'storybook/internal/components';
import { STORY_CHANGED } from 'storybook/internal/core-events';

import { useChannel, useStorybookApi } from 'storybook/manager-api';

import { CLEAR_ID, EVENT_ID, PANEL_ID } from '../constants.ts';
import { actionsStore, useActionsState } from './store.ts';

export function Title() {
  const api = useStorybookApi();
  const selectedPanel = api.getSelectedPanel();
  const { count } = useActionsState();
  const setCount = actionsStore.set;

  useChannel({
    [EVENT_ID]: () => {
      setCount((c) => ({ ...c, count: c.count + 1 }));
    },
    [STORY_CHANGED]: () => {
      setCount((c) => ({ ...c, count: 0 }));
    },
    [CLEAR_ID]: () => {
      setCount((c) => ({ ...c, count: 0 }));
    },
  });

  const suffix =
    count === 0 ? null : (
      <Badge compact status={selectedPanel === PANEL_ID ? 'active' : 'neutral'}>
        {count}
      </Badge>
    );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>Actions</span>
      {suffix}
    </div>
  );
}
