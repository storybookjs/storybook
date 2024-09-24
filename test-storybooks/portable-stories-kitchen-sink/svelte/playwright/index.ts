import { SvelteRenderer, setProjectAnnotations } from '@storybook/svelte'
import type { ProjectAnnotations } from 'storybook/internal/types';
import sbAnnotations from '../.storybook/preview'
import * as addonInteractions from '@storybook/addon-interactions/preview';
import * as addonActions from '@storybook/addon-essentials/actions/preview';

setProjectAnnotations([
  sbAnnotations,
  addonInteractions as ProjectAnnotations<SvelteRenderer>, // instruments actions as spies
  addonActions as ProjectAnnotations<SvelteRenderer>, // creates actions from argTypes
]);
