import { addons } from 'storybook/internal/manager-api';

import { startCase } from 'es-toolkit/compat';

addons.setConfig({
  sidebar: {
    renderLabel: ({ name, type }) => (type === 'story' ? name : startCase(name)),
  },
});
