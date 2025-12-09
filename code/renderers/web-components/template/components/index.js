import { global as globalThis } from '@storybook/global';

import { ButtonTag } from './Button';
import { FormTag } from './Form';
import { HtmlTag } from './Html';
import { PreTag } from './Pre';

globalThis.__TEMPLATE_COMPONENTS__ = {
  Button: ButtonTag,
  Form: FormTag,
  Html: HtmlTag,
  Pre: PreTag,
};
globalThis.storybookRenderer = 'web-components';
