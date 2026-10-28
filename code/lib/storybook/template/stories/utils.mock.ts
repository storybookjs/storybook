import { fn } from '@storybook/core/test';

import * as utils from './utils.ts';

export const foo = fn(utils.foo).mockName('foo');
