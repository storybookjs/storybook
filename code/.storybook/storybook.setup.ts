import { beforeAll, vi, expect as vitestExpect } from 'vitest';

import { setProjectAnnotations } from '@storybook/react';
import { userEvent as storybookEvent, expect as storybookExpect } from '@storybook/test';

// eslint-disable-next-line import/namespace
import * as testAnnotations from '@storybook/experimental-addon-test/preview';

import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

import * as coreAnnotations from '../addons/toolbars/template/stories/preview';
import * as componentAnnotations from '../core/template/stories/preview';
// register global components used in many stories
import '../renderers/react/template/components';
import * as projectAnnotations from './preview';

vi.spyOn(console, 'warn').mockImplementation((...args) => console.log(...args));

const annotations = setProjectAnnotations([
  a11yAddonAnnotations,
  projectAnnotations,
  componentAnnotations,
  coreAnnotations,
  testAnnotations,
]);

beforeAll(annotations.beforeAll);
