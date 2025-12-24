import { global as globalThis } from '@storybook/global';

import Button from './button.gjs';
import Form from './form.gjs';
import Html from './html.gjs';
import Pre from './pre.gjs';

globalThis.__TEMPLATE_COMPONENTS__ = { Button, Pre, Form, Html };
globalThis.storybookRenderer = 'ember';
