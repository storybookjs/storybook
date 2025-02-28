import React from 'react';

import { Badge, Spaced } from 'storybook/internal/components';
import { STORY_CHANGED } from 'storybook/internal/core-events';
import { useStorybookApi } from 'storybook/internal/manager-api';
import { useAddonState, useChannel } from 'storybook/internal/manager-api';

import { ACTIONS_ADDON_ID, ACTIONS_CLEAR_ID, ACTIONS_EVENT_ID } from './constants';
import ActionLogger from './containers/ActionLogger';

export function Title() {
  const [{ count }, setCount] = useAddonState(ACTIONS_ADDON_ID, { count: 0 });

  useChannel({
    [ACTIONS_EVENT_ID]: () => {
      setCount((c) => ({ ...c, count: c.count + 1 }));
    },
    [STORY_CHANGED]: () => {
      setCount((c) => ({ ...c, count: 0 }));
    },
    [ACTIONS_CLEAR_ID]: () => {
      setCount((c) => ({ ...c, count: 0 }));
    },
  });

  const suffix = count === 0 ? '' : <Badge status="neutral">{count}</Badge>;

  return (
    <div>
      <Spaced col={1}>
        <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>Actions</span>
        {suffix}
      </Spaced>
    </div>
  );
}

export const ActionPanel = () => {
  const api = useStorybookApi();
  return <ActionLogger active api={api} />;
};
