import { experimental_MockUniversalStore } from 'storybook/manager-api';
import * as testUtils from 'storybook/test';

import { storeOptions } from './constants';

export const store = testUtils.mocked(new experimental_MockUniversalStore(storeOptions, testUtils));
