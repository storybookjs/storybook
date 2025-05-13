import { global as globalThis } from '@storybook/global';

import Button from './Button.vue';
import Form from './Form.vue';
import Html from './Html.vue';
import Pre from './Pre.vue';

globalThis.Components = { Button, Pre, Form, Html };
globalThis.storybookRenderer = 'vue3';
