import type { ProjectAnnotations, Renderer } from 'storybook/internal/types';

export function definePreview(config: ProjectAnnotations<Renderer>): ProjectAnnotations<Renderer> {
  return config;
}
