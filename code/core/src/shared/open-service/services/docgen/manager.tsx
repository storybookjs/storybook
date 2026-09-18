import { addons } from 'storybook/manager-api';

import { registerService } from '../../manager.ts';
import { docgenServiceDef } from './definition.ts';

const ADDON_ID = 'core/docgen';

export default addons.register(ADDON_ID, () => {
  if (globalThis.FEATURES?.experimentalDocgenServer) {
    registerService(docgenServiceDef);
  }
});
