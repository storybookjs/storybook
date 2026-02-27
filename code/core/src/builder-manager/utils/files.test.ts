import { platform } from 'node:os';

import { expect, it } from 'vitest';

import { sanitizePath } from './files';

const os = platform();
const isWindows = os === 'win32';

it('sanitizePath', () => {
  const addonsDir = isWindows
    ? 'C:\\Users\\username\\Projects\\projectname\\storybook'
    : '/Users/username/Projects/projectname/storybook';
  const file = {
    fileName: 'node_modules/@storybook/addon-x+y/dist/manager.js',
    code: 'demo text',
    type: 'chunk' as const,
  };
  const { location, url } = sanitizePath(file, addonsDir);

  expect(location).toEqual(
    isWindows
      ? 'C:\\Users\\username\\Projects\\projectname\\storybook\\node_modules\\@storybook\\addon-x+y\\dist\\manager.js'
      : '/Users/username/Projects/projectname/storybook/node_modules/@storybook/addon-x+y/dist/manager.js'
  );
  expect(url).toMatchInlineSnapshot(
    `"./sb-addons/node_modules/%40storybook/addon-x%2By/dist/manager.js"`
  );
});
