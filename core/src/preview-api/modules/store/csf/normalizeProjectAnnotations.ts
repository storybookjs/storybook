import type {
  ArgTypes,
  NormalizedProjectAnnotations,
  ProjectAnnotations,
  Renderer,
} from '@storybook/core/types';

import { deprecate } from '@storybook/core/client-logger';

import { dedent } from 'ts-dedent';

import { inferArgTypes } from '../inferArgTypes';
import { inferControls } from '../inferControls';
import { combineParameters } from '../parameters';
import { normalizeArrays } from './normalizeArrays';
import { normalizeInputTypes } from './normalizeInputTypes';

// TODO(kasperpeulen) Consolidate this function with composeConfigs
// As composeConfigs is the real normalizer, and always run before normalizeProjectAnnotations
// tmeasday: Alternatively we could get rid of composeConfigs and just pass ProjectAnnotations[] around -- and do the composing here.
// That makes sense to me as it avoids the need for both WP + Vite to call composeConfigs at the right time.
export function normalizeProjectAnnotations<TRenderer extends Renderer>({
  argTypes,
  globalTypes,
  argTypesEnhancers,
  decorators,
  loaders,
  beforeEach,
  experimental_afterEach,
  globals,
  initialGlobals,
  ...annotations
}: ProjectAnnotations<TRenderer>): NormalizedProjectAnnotations<TRenderer> {
  if (globals && Object.keys(globals).length > 0) {
    deprecate(dedent`
      The preview.js 'globals' field is deprecated and will be removed in Storybook 9.0.
      Please use 'initialGlobals' instead. Learn more:

      https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#previewjs-globals-renamed-to-initialglobals
    `);
  }
  return {
    ...(argTypes && { argTypes: normalizeInputTypes(argTypes as ArgTypes) }),
    ...(globalTypes && { globalTypes: normalizeInputTypes(globalTypes) }),
    decorators: normalizeArrays(decorators),
    loaders: normalizeArrays(loaders),
    beforeEach: normalizeArrays(beforeEach),
    experimental_afterEach: normalizeArrays(experimental_afterEach),
    argTypesEnhancers: [
      ...(argTypesEnhancers || []),
      inferArgTypes,
      // inferControls technically should only run if the user is using the controls addon,
      // and so should be added by a preset there. However, as it seems some code relies on controls
      // annotations (in particular the angular implementation's `cleanArgsDecorator`), for backwards
      // compatibility reasons, we will leave this in the store until 7.0
      inferControls,
    ],
    initialGlobals: combineParameters(initialGlobals, globals),
    ...(annotations as NormalizedProjectAnnotations<TRenderer>),
  };
}
