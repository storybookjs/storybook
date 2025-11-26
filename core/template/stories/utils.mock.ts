import { fn } from 'storybook/test';

import * as utils from './utils.js';

export const foo = fn(utils.foo).mockName('foo');
