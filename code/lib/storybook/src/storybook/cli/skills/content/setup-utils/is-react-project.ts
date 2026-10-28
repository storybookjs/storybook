import type { ProjectInfo } from '../../project-info.ts';
import { frameworkToRendererMap } from '../framework-renderer.ts';

export function isReactProject(projectInfo: ProjectInfo): boolean {
  const renderer =
    projectInfo.rendererPackage ??
    (projectInfo.framework ? frameworkToRendererMap[projectInfo.framework] : undefined);
  return renderer === '@storybook/react';
}
