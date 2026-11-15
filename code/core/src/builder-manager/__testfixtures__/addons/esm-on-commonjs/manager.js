import { addons } from 'storybook/manager-api';

import dependency, { hello } from './dependency/index.js';

addons.register('esm-on-commonjs', () =>
  addons.add('esm-on-commonjs/tool', { mode: dependency.mode, hello: hello() })
);
