import type { ProjectInfo } from './types.ts';

const SUPPORTED_REACT_BUILDERS = ['@storybook/builder-vite', 'storybook-builder-rsbuild'] as const;

type AiSetupProjectSupportInfo = Pick<ProjectInfo, 'rendererPackage' | 'builderPackage'>;

export function isAiSetupSupportedProject(projectInfo: AiSetupProjectSupportInfo): boolean {
  return (
    projectInfo.rendererPackage === '@storybook/react' &&
    SUPPORTED_REACT_BUILDERS.includes(projectInfo.builderPackage as SupportedReactBuilder)
  );
}

export function getUnsupportedAiSetupProjectMessage(
  projectInfo: AiSetupProjectSupportInfo
): string {
  return (
    'AI-assisted setup is currently only available for projects using the React renderer with Vite or Rsbuild builders. Detected renderer: ' +
    projectInfo.rendererPackage +
    ', builder: ' +
    projectInfo.builderPackage
  );
}

type SupportedReactBuilder = (typeof SUPPORTED_REACT_BUILDERS)[number];
