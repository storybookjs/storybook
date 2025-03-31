import React from 'react';

import { Badge } from 'storybook/internal/components';
import { STORY_CHANGED } from 'storybook/internal/core-events';

import { addons, types, useAddonState, useChannel, useStorybookApi } from 'storybook/manager-api';

import { ADDON_ID, CLEAR_ID, EVENT_ID, PANEL_ID, PARAM_KEY } from './constants';
import ActionLogger from './containers/ActionLogger';

function Title() {
  const api = useStorybookApi();
  const selectedPanel = api.getSelectedPanel();
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

export default addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    title: Title,
    type: types.PANEL,
    render: ({ active }) => <ActionLogger api={api} active={!!active} />,
    paramKey: PARAM_KEY,
  });
});
