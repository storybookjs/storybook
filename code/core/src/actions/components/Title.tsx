import React from 'react';

import { Badge } from 'storybook/internal/components';
import { STORY_CHANGED } from 'storybook/internal/core-events';

import { useChannel, useStorybookApi } from 'storybook/manager-api';

import { CLEAR_ID, EVENT_ID, PANEL_ID } from '../constants.ts';
import { countStore, useActionCount } from './countStore.ts';

export function Title() {
  const api = useStorybookApi();
  const selectedPanel = api.getSelectedPanel();
  const count = useActionCount();

  useChannel({
    [EVENT_ID]: () => {
      countStore.setState(countStore.getState() + 1);
    },
    [STORY_CHANGED]: () => {
      countStore.setState(0);
    },
    [CLEAR_ID]: () => {
      countStore.setState(0);
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
