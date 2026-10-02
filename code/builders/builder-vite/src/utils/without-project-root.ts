import { getProjectRoot } from 'storybook/internal/common';

// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';

export function createProjectRootRemover() {
  const projectRoot = getProjectRoot();
  // Forward slashes for bundler ids, plus the native and JSON-escaped spellings on Windows
  const spellings = [
    ...new Set([slash(projectRoot), projectRoot, JSON.stringify(projectRoot).slice(1, -1)]),
  ];
  return (text: string) =>
    spellings.reduce((result, root) => result.replaceAll(root, '<projectRoot>'), text);
}
