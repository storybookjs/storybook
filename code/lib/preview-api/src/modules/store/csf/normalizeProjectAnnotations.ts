import type {
  Renderer,
  ArgTypes,
  ProjectAnnotations,
  NormalizedProjectAnnotations,
} from '@storybook/types';

import { inferArgTypes } from '../inferArgTypes';
import { inferControls } from '../inferControls';
import { normalizeInputTypes } from './normalizeInputTypes';
import { normalizeArrays } from './normalizeArrays';

export function normalizeProjectAnnotations<TRenderer extends Renderer>({
  argTypes,
  globalTypes,
  argTypesEnhancers,
  decorators,
  loaders,
  beforeEach,
  ...annotations
}: ProjectAnnotations<TRenderer>): NormalizedProjectAnnotations<TRenderer> {
  return {
    ...(argTypes && { argTypes: normalizeInputTypes(argTypes as ArgTypes) }),
    ...(globalTypes && { globalTypes: normalizeInputTypes(globalTypes) }),
    decorators: normalizeArrays(decorators),
    loaders: normalizeArrays(loaders),
    beforeEach: normalizeArrays(beforeEach),
    argTypesEnhancers: [
      ...(argTypesEnhancers || []),
      inferArgTypes,
      // inferControls technically should only run if the user is using the controls addon,
      // and so should be added by a preset there. However, as it seems some code relies on controls
      // annotations (in particular the angular implementation's `cleanArgsDecorator`), for backwards
      // compatibility reasons, we will leave this in the store until 7.0
      inferControls,
    ],
    ...annotations,
  };
}
