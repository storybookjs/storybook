import { getProjectRoot } from 'storybook/internal/common';

// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';

const WINDOWS_PATH_AFTER_ROOT_RE = /<projectRoot>((?:\\{1,2}[^\\/"'`\s]+)+)/g;

// Makes hashed text the same on every machine and OS that builds the same project
export function createHashNormalizer() {
  const projectRoot = getProjectRoot();
  // Forward slashes for bundler ids, plus the native and JSON-escaped spellings on Windows
  const spellings = [
    ...new Set([slash(projectRoot), projectRoot, JSON.stringify(projectRoot).slice(1, -1)]),
  ];
  return (text: string) =>
    spellings
      .reduce((result, root) => result.replaceAll(root, '<projectRoot>'), text)
      .replace(
        WINDOWS_PATH_AFTER_ROOT_RE,
        (_, path: string) => `<projectRoot>${path.replace(/\\{1,2}/g, '/')}`
      )
      .replaceAll('\r\n', '\n');
}
