import { addons } from '@storybook/manager/manager-api';

import { registerService } from '@storybook/core/internal/deep/shared/open-service/manager';
import { reviewServiceDef } from '@storybook/core/internal/deep/shared/open-service/services/review/definition';

const ADDON_ID = 'core/review';

export default addons.register(ADDON_ID, () => {
  registerService(reviewServiceDef);
});
