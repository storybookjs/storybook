import { VueRenderer, setProjectAnnotations } from '@storybook/vue3'
import type { ProjectAnnotations } from 'storybook/internal/types';
import sbAnnotations from '../.storybook/preview'
import * as addonTest from '@storybook/addon-test/preview';

setProjectAnnotations([
  sbAnnotations,
  addonTest as ProjectAnnotations<VueRenderer>, // instruments actions as spies
]);
