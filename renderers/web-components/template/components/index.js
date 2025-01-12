import { global as globalThis } from '@storybook/global';

import { ButtonTag } from './Button';
import { FormTag } from './Form';
import { HtmlTag } from './Html';
import { PreTag } from './Pre';

globalThis.Components = {
  Button: ButtonTag,
  Form: FormTag,
  Html: HtmlTag,
  Pre: PreTag,
};
globalThis.storybookRenderer = 'web-components';
