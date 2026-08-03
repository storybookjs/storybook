import type { ProjectInfo } from '../types.ts';

export function getTypeImportSource(projectInfo: ProjectInfo): string {
  return projectInfo.framework || projectInfo.rendererPackage || '@storybook/react';
}
