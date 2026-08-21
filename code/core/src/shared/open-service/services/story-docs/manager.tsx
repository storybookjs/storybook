import { addons } from 'storybook/manager-api';

import { registerService } from '../../manager.ts';
import { storyDocsServiceDef } from './definition.ts';

const ADDON_ID = 'core/story-docs';

export default addons.register(ADDON_ID, () => {
  if (globalThis.FEATURES?.experimentalDocgenServer) {
    registerService(storyDocsServiceDef);
  }
});
