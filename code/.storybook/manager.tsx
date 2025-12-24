import { startCase, upperCase } from 'es-toolkit/string';
import { addons } from 'storybook/manager-api';

addons.setConfig({
  sidebar: {
    renderAriaLabel: ({ name, type }) => `${type} ${name}`,
    renderLabel: ({ name, type }) => (type === 'story' ? name : startCase(name)),
  },
});
