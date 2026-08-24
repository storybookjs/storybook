import { addons } from 'storybook/manager-api';

import { registerService } from '../../manager.ts';
import { dynamicSnippetServiceDef } from './definition.ts';

const ADDON_ID = 'core/dynamic-snippets';

export default addons.register(ADDON_ID, () => {
  if (globalThis.FEATURES?.experimentalDocgenServer) {
    registerService(dynamicSnippetServiceDef);
  }
});
