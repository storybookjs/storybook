import { global as globalThis } from '@storybook/global';

import { Button } from './Button';
import { Pre } from './Pre';
import { Form } from './Form';
import { Html } from './Html';
import { Accordion } from './Accordion';

globalThis.Components = { Button, Pre, Form, Html, Accordion };
globalThis.storybookRenderer = 'html';
