import { addons, registerService, types } from 'storybook/manager-api';

import { ADDON_ID } from './constants.ts';
import { ManagerDocsCanvas } from './manager/ManagerDocsCanvas.tsx';
import { mdxSourceServiceDef } from './mdx-source-service/definition.ts';

addons.register(ADDON_ID, () => {
  registerService(mdxSourceServiceDef);
  addons.add(ADDON_ID, {
    type: types.experimental_MANAGER_DOCS,
    render: ManagerDocsCanvas,
  });
});
