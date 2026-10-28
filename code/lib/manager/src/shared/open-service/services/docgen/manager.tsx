import { addons, getFeatures } from '@storybook/manager/manager-api';

import { registerService } from '@storybook/core/internal/deep/shared/open-service/manager';
import { docgenServiceDef } from '@storybook/core/internal/deep/shared/open-service/services/docgen/definition';

const ADDON_ID = 'core/docgen';

export default addons.register(ADDON_ID, () => {
  if (getFeatures().docgenServer) {
    registerService(docgenServiceDef);
  }
});
