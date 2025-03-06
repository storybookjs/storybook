import { SvelteRenderer, setProjectAnnotations } from '@storybook/svelte'
import type { ProjectAnnotations } from 'storybook/internal/types';
import sbAnnotations from '../.storybook/preview'
import * as addonInteractions from '@storybook/addon-interactions/preview';

setProjectAnnotations([
  sbAnnotations,
  addonInteractions as ProjectAnnotations<SvelteRenderer>, // instruments actions as spies
]);
