import type {
  ArgTypes,
  NormalizedProjectAnnotations,
  ProjectAnnotations,
  Renderer,
  StrictGlobalTypes,
} from 'storybook/internal/types';

import { inferArgTypes } from '../inferArgTypes';
import { inferControls } from '../inferControls';
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
  afterEach,
  initialGlobals,
  ...annotations
}: ProjectAnnotations<TRenderer>): NormalizedProjectAnnotations<TRenderer> {
  return {
    ...(argTypes && { argTypes: normalizeInputTypes(argTypes as ArgTypes) }),
    ...(globalTypes && { globalTypes: normalizeInputTypes(globalTypes) as StrictGlobalTypes }),
    decorators: normalizeArrays(decorators),
    loaders: normalizeArrays(loaders),
    beforeEach: normalizeArrays(beforeEach),
    afterEach: normalizeArrays(afterEach),
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
    initialGlobals,
    ...(annotations as NormalizedProjectAnnotations<TRenderer>),
  };
}
