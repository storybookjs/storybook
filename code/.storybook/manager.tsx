import { startCase } from 'es-toolkit/compat';
import { addons } from 'storybook/manager-api';

addons.setConfig({
  sidebar: {
    // TODO: [test-syntax] What to do with tests?
    renderLabel: ({ name, type }) => (type === 'story' ? name : startCase(name)),
  },
});
