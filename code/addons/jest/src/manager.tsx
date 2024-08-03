import * as React from 'react';
import { addons, types } from 'storybook/internal/manager-api';
import { ADDON_ID, PANEL_ID, PARAM_KEY } from './shared';

import Panel from './components/Panel';

addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    title: 'Tests',
    type: types.PANEL,
    render: ({ active }) => <Panel api={api} active={active} />,
    paramKey: PARAM_KEY,
  });
});
