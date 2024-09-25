import { VueRenderer, setProjectAnnotations } from '@storybook/vue3'
import type { ProjectAnnotations } from 'storybook/internal/types';
import sbAnnotations from '../.storybook/preview'
import * as addonInteractions from '@storybook/addon-interactions/preview';
import * as addonActions from '@storybook/addon-essentials/actions/preview';

setProjectAnnotations([
  sbAnnotations,
  addonInteractions as ProjectAnnotations<VueRenderer>, // instruments actions as spies
  addonActions as ProjectAnnotations<VueRenderer>, // creates actions from argTypes
]);
