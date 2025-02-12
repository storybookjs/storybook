import type { ProjectAnnotations, Renderer } from '@storybook/core/types';

export function definePreview(config: ProjectAnnotations<Renderer>): ProjectAnnotations<Renderer> {
  return config;
}
