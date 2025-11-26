import React from 'react';

import { addons, types } from 'storybook/manager-api';

import { Title } from './components/Title';
import { ADDON_ID, PANEL_ID, PARAM_KEY } from './constants';
import ActionLogger from './containers/ActionLogger';

export default addons.register(ADDON_ID, (api) => {
  if (globalThis?.FEATURES?.actions) {
    addons.add(PANEL_ID, {
      title: Title,
      type: types.PANEL,
      render: ({ active }) => <ActionLogger api={api} active={!!active} />,
      paramKey: PARAM_KEY,
    });
  }
});
