import { startCase } from 'es-toolkit/compat';
import { addons } from 'storybook/manager-api';

addons.setConfig({
  sidebar: {
    renderLabel: ({ name, type }) => (type === 'story' ? name : startCase(name)),
  },
});
