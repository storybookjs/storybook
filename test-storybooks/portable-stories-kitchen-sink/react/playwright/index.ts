import type { ProjectAnnotations } from 'storybook/internal/types';
import { ReactRenderer, setProjectAnnotations } from '@storybook/react';
import sbAnnotations from '../.storybook/preview';
import * as addonTest from '@storybook/addon-test/preview';

setProjectAnnotations([
  sbAnnotations,
  addonTest as ProjectAnnotations<ReactRenderer>, // instruments actions as spies
]);
