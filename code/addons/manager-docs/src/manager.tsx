import { addons, types } from 'storybook/manager-api';

import { ADDON_ID } from './constants.ts';
import { ManagerDocsCanvas } from './manager/ManagerDocsCanvas.tsx';

addons.register(ADDON_ID, () => {
  addons.add(ADDON_ID, {
    type: types.experimental_MANAGER_DOCS,
    render: ManagerDocsCanvas,
  });
});
