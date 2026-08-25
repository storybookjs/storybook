import { startCase } from 'es-toolkit/string';
import { addons } from 'storybook/manager-api';

addons.setConfig({
  sidebar: {
    renderLabel: ({ name, type }) => (type === 'story' ? name : startCase(name)),
  },
});

import '../core/src/shared/open-service/sync-test/manager.tsx';
