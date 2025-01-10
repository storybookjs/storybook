import {
  composeConfigs,
  setProjectAnnotations as originalSetProjectAnnotations,
  setDefaultProjectAnnotations,
} from 'storybook/internal/preview-api';
import type {
  NamedOrDefaultProjectAnnotations,
  NormalizedProjectAnnotations,
  ProjectAnnotations,
} from 'storybook/internal/types';

import type { SvelteRenderer } from '@storybook/svelte';
import { INTERNAL_DEFAULT_PROJECT_ANNOTATIONS as svelteAnnotations } from '@storybook/svelte';

import * as svelteKitAnnotations from './preview';

/**
 * Function that sets the globalConfig of your storybook. The global config is the preview module of
 * your .storybook folder.
 *
 * It should be run a single time, so that your global config (e.g. decorators) is applied to your
 * stories when using `composeStories` or `composeStory`.
 *
 * Example:
 *
 * ```jsx
 * // setup-file.js
 * import { setProjectAnnotations } from '@storybook/sveltekit';
 * import projectAnnotations from './.storybook/preview';
 *
 * setProjectAnnotations(projectAnnotations);
 * ```
 *
 * @param projectAnnotations - E.g. (import projectAnnotations from '../.storybook/preview')
 */
export function setProjectAnnotations(
  projectAnnotations:
    | NamedOrDefaultProjectAnnotations<any>
    | NamedOrDefaultProjectAnnotations<any>[]
): NormalizedProjectAnnotations<SvelteRenderer> {
  setDefaultProjectAnnotations(INTERNAL_DEFAULT_PROJECT_ANNOTATIONS);
  return originalSetProjectAnnotations(
    projectAnnotations
  ) as NormalizedProjectAnnotations<SvelteRenderer>;
}

// This will not be necessary once we have auto preset loading
const INTERNAL_DEFAULT_PROJECT_ANNOTATIONS: ProjectAnnotations<SvelteRenderer> = composeConfigs([
  svelteAnnotations,
  svelteKitAnnotations,
]);
