import { global as globalThis } from '@storybook/global';

import Button from './Button.svelte';
import Form from './Form.svelte';
import Html from './Html.svelte';
import Pre from './Pre.svelte';

globalThis.__TEMPLATE_COMPONENTS__ = { Button, Pre, Form, Html };
globalThis.storybookRenderer = 'svelte';
