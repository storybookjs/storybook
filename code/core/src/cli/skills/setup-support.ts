import type { ProjectInfo } from './project-info.ts';

const SUPPORTED_SETUP_RENDERERS = ['@storybook/react', '@storybook/angular', '@storybook/vue3'];

export function getSetupSupportError({
  rendererPackage,
}: Pick<ProjectInfo, 'rendererPackage'>): string | undefined {
  if (rendererPackage && SUPPORTED_SETUP_RENDERERS.includes(rendererPackage)) {
    return undefined;
  }

  return `AI-assisted setup is currently only available for React, Angular, and Vue projects. Detected renderer: ${rendererPackage ?? 'unknown'}.`;
}
