import '@testing-library/jest-dom';
import type { ProjectAnnotations } from 'storybook/internal/types';
import { ReactRenderer } from '@storybook/react';
import { setProjectAnnotations } from '@storybook/nextjs';
import * as addonInteractions from '@storybook/addon-interactions/preview';
import * as addonActions from '@storybook/addon-essentials/actions/preview';

/**
 * For some weird reason, Jest in Nextjs throws the following error:
 * Cannot find module '.storybook/preview' from 'jest.setup.ts
 *
 * when using import sbAnnotations from './.storybook/preview';
 */
const sbAnnotations = require('./.storybook/preview');

setProjectAnnotations([
  sbAnnotations,
  addonInteractions as ProjectAnnotations<ReactRenderer>, // instruments actions as spies
  addonActions as ProjectAnnotations<ReactRenderer>, // creates actions from argTypes
]);
