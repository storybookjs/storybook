import { addons } from 'storybook/manager-api';

import dependency, { hello } from './dependency/index.js';

const optional = import('storybook-addon-that-is-not-installed').catch(() => 'missing');

addons.register('esm-on-commonjs', () =>
  addons.add('esm-on-commonjs/tool', { mode: dependency.mode, hello: hello(), optional })
);
