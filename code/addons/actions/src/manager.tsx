import React from 'react';

import { Badge, Spaced } from 'storybook/internal/components';
import { STORY_CHANGED } from 'storybook/internal/core-events';
import { addons, types, useAddonState, useChannel } from 'storybook/internal/manager-api';

import { ADDON_ID, CLEAR_ID, EVENT_ID, PANEL_ID, PARAM_KEY } from './constants';
import ActionLogger from './containers/ActionLogger';

function Title() {
  const [{ count }, setCount] = useAddonState(ADDON_ID, { count: 0 });

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

addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    title: Title,
    type: types.PANEL,
    render: ({ active }) => <ActionLogger api={api} active={!!active} />,
    paramKey: PARAM_KEY,
  });
});
