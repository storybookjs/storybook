import React, { useState } from 'react';

import { Badge } from 'storybook/internal/components';
import { STORY_CHANGED } from 'storybook/internal/core-events';

import { useChannel, useStorybookApi } from 'storybook/manager-api';

import { CLEAR_ID, EVENT_ID, PANEL_ID } from '../constants.ts';

export function Title() {
  const api = useStorybookApi();
  const selectedPanel = api.getSelectedPanel();
  // Local state: nothing else reads the count, and a write to the shared addon state would
  // re-render the whole manager on every action.
  const [count, setCount] = useState(0);

  useChannel({
    [EVENT_ID]: () => {
      setCount((c) => c + 1);
    },
    [STORY_CHANGED]: () => {
      setCount(0);
    },
    [CLEAR_ID]: () => {
      setCount(0);
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
