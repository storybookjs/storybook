import type { ProjectInfo } from '../../project-info.ts';

export function getTypeImportSource(projectInfo: ProjectInfo): string {
  return projectInfo.framework || projectInfo.rendererPackage || '@storybook/react';
}
