import React from 'react';

import { startCase } from 'es-toolkit/compat';
import { addons, types } from 'storybook/manager-api';

addons.setConfig({
  sidebar: {
    renderLabel: ({ name, type }) => (type === 'story' ? name : startCase(name)),
  },
});

addons.register('storybook/internal/manager', (api) => {
  addons.add('DEBUG-A11y', {
    type: types.TAB,
    title: 'DEBUG A11y',
    render: () => <div>Keep this tab until you're done debugging.</div>,
  });
});
