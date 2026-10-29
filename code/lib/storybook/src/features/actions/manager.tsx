import React from 'react';

import { addons, types } from '@storybook/manager/manager-api';

import { Title } from './components/Title.tsx';
import { ADDON_ID, PANEL_ID, PARAM_KEY } from './constants.ts';
import ActionLogger from './containers/ActionLogger/index.tsx';

export default addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    title: Title,
    type: types.PANEL,
    render: ({ active }) => <ActionLogger api={api} active={!!active} />,
    paramKey: PARAM_KEY,
  });
});
