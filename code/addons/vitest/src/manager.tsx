import { addons, type API } from 'storybook/internal/manager-api';

import { ADDON_ID } from './constants';

addons.register(ADDON_ID, () => {});
