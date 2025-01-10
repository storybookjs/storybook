import { global as globalThis } from '@storybook/global';

import { Button } from './Button';
import { Form } from './Form';
import { Html } from './Html';
import { Pre } from './Pre';

globalThis.Components = { Button, Pre, Form, Html };
globalThis.storybookRenderer = 'html';
