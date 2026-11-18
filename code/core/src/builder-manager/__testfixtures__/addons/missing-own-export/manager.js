import { addons } from 'storybook/manager-api';

import { notExported } from './dependency.js';

addons.register('missing-own-export', () => notExported);
