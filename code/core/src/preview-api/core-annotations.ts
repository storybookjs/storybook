import { composeConfigs } from 'storybook/internal/preview-api';
import type { Renderer } from 'storybook/internal/types';

import actionAnnotations from 'storybook/actions';
import testAnnotations from 'storybook/test';

import type { NormalizedProjectAnnotations } from '../types';

export function getCoreAnnotations() {
  //@ts-expect-error TypeScript doesn't recognize the default export
  return [actionAnnotations(), testAnnotations()];
}

export function getComposedCoreAnnotations<
  TRenderer extends Renderer,
>(): NormalizedProjectAnnotations<TRenderer> {
  return composeConfigs<TRenderer>(getCoreAnnotations());
}
