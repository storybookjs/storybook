import { SvelteRenderer, setProjectAnnotations } from '@storybook/svelte'
import type { ProjectAnnotations } from 'storybook/internal/types';
import sbAnnotations from '../.storybook/preview'
import * as addonTest from '@storybook/addon-test/preview';

setProjectAnnotations([
  sbAnnotations,
  addonTest as ProjectAnnotations<SvelteRenderer>, // instruments actions as spies
]);
