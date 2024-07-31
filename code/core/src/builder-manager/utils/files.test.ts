import { it, expect } from 'vitest';
import type { OutputFile } from 'esbuild';
import { platform } from 'os';
import { sanitizePath } from './files';

const os = platform();
const isWindows = os === 'win32';

it('sanitizePath', () => {
  const addonsDir = isWindows
    ? 'C:\\Users\\username\\Projects\\projectname\\storybook'
    : '/Users/username/Projects/projectname/storybook';
  const text = 'demo text';
  const file: OutputFile = {
    path: isWindows
      ? 'C:\\Users\\username\\Projects\\projectname\\storybook\\node_modules\\@storybook\\addon-x+y\\dist\\manager.js'
      : '/Users/username/Projects/projectname/storybook/node_modules/@storybook/addon-x+y/dist/manager.js',
    contents: Uint8Array.from(Array.from(text).map((letter) => letter.charCodeAt(0))),
    text,
    hash: '',
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
