import type {
  NamedOrDefaultProjectAnnotations,
  NormalizedProjectAnnotations,
} from 'storybook/internal/types';

import {
  setProjectAnnotations as originalSetProjectAnnotations,
  setDefaultProjectAnnotations,
} from 'storybook/preview-api';

import * as INTERNAL_DEFAULT_PROJECT_ANNOTATIONS from './render';
import type { EmberRenderer } from './types';

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
 * import { setProjectAnnotations } from '@storybook/preact';
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
): NormalizedProjectAnnotations<EmberRenderer> {
  setDefaultProjectAnnotations(INTERNAL_DEFAULT_PROJECT_ANNOTATIONS);
  return originalSetProjectAnnotations(
    projectAnnotations
  ) as NormalizedProjectAnnotations<EmberRenderer>;
}
