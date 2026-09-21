import { addons } from 'storybook/manager-api';

import { isReviewFeatureEnabled } from '../../../review/features.ts';
import { registerService } from '../../manager.ts';
import { reviewServiceDef } from './definition.ts';

const ADDON_ID = 'core/review';

export default addons.register(ADDON_ID, () => {
  if (isReviewFeatureEnabled(globalThis.FEATURES)) {
    registerService(reviewServiceDef);
  }
});
