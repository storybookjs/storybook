import { deprecate } from 'storybook/internal/client-logger';
import type {
  ArgTypes,
  NormalizedProjectAnnotations,
  ProjectAnnotations,
  Renderer,
} from 'storybook/internal/types';

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
      // There's an architectural decision to be made regarding embedded addons in core:
      //
      // Option 1: Keep embedded addons but ensure consistency by moving addon-specific code
      // (like inferControls) to live alongside the addon code itself. This maintains the
      // concept of core addons while improving code organization.
      //
      // Option 2: Fully integrate these addons into core, potentially moving UI components
      // into the manager and treating them as core features rather than addons. This is a
      // bigger architectural change requiring careful consideration.
      //
      // For now, we're keeping inferControls here as we need time to properly evaluate
      // these options and their implications. Some features (like Angular's cleanArgsDecorator)
      // currently rely on this behavior.
      //
      // TODO: Make an architectural decision on the handling of core addons
      inferControls,
    ],
    initialGlobals: combineParameters(initialGlobals, globals),
    ...(annotations as NormalizedProjectAnnotations<TRenderer>),
  };
}
