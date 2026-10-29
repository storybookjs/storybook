import { addons } from 'storybook/manager-api';

import { registerService } from '../../manager.ts';
import { reviewServiceDef } from './definition.ts';

const ADDON_ID = 'core/review';

export default addons.register(ADDON_ID, () => {
  registerService(reviewServiceDef);
});
