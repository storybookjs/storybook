import { platform } from 'node:os';

import { expect, it } from 'vitest';

import type { Metafile, OutputFile } from 'esbuild';
import { resolve } from 'pathe';

import { getEntryOutputs, sanitizePath } from './files.ts';

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

it('getEntryOutputs orders entry scripts like the entry points and skips chunks and styles', () => {
  const metafile = {
    inputs: {},
    outputs: {
      'out/second.js': { entryPoint: 'cache/second.js' },
      'out/chunk-ABCDEFGH.js': {},
      'out/first.css': { entryPoint: 'cache/first.js' },
      'out/first.js': { entryPoint: 'cache/first.js' },
    },
  } as unknown as Metafile;

  expect(
    getEntryOutputs(metafile, [resolve('/project/cache/first.js'), 'cache/second.js'], '/project')
  ).toEqual([resolve('/project/out/first.js'), resolve('/project/out/second.js')]);
});
