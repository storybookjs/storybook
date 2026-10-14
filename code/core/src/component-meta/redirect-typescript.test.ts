import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterAll, expect, it } from 'vitest';

import { packageRootFromFile, redirectTypeScriptRequires } from './redirect-typescript.ts';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'redirect-typescript-')));
const nodeModules = join(root, 'node_modules');

const writePackage = (name: string, files: Record<string, string>, type?: 'module') => {
  const dir = join(nodeModules, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name, main: 'index.js', ...(type ? { type } : {}) })
  );
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(join(dir, file, '..'), { recursive: true });
    writeFileSync(join(dir, file), source);
  }
  return dir;
};

writePackage('typescript', { 'index.js': 'module.exports = { which: "project" };' });
writePackage('typescript6-copy', {
  'index.js': 'module.exports = { which: "typescript6" };',
  'lib/tsserverlibrary.js': 'module.exports = { which: "tsserver6" };',
});
const docgenLib = writePackage('docgen-lib', {
  'index.js': 'module.exports = () => require("typescript").which;',
});
writePackage('other-tool', {
  'index.js': 'module.exports = () => require("typescript").which;',
});
const esmLib = writePackage(
  'esm-lib',
  {
    'index.js': `export default async function load() {
      const typescript = await import('typescript');
      const tsserver = await import('typescript/lib/tsserverlibrary.js');
      return {
        which: (typescript.default ?? typescript).which,
        sub: (tsserver.default ?? tsserver).which,
      };
    }`,
  },
  'module'
);

const requireFromRoot = createRequire(join(root, 'index.js'));

afterAll(() => rmSync(root, { recursive: true, force: true }));

it('redirects typescript only for loads from inside the given package', async () => {
  redirectTypeScriptRequires(docgenLib, requireFromRoot.resolve('typescript6-copy'));
  redirectTypeScriptRequires(esmLib, requireFromRoot.resolve('typescript6-copy'));

  expect(requireFromRoot('docgen-lib')()).toBe('typescript6');
  expect(requireFromRoot('other-tool')()).toBe('project');
  expect(requireFromRoot('typescript').which).toBe('project');

  const esm = await import(pathToFileURL(join(esmLib, 'index.js')).href);
  await expect(esm.default()).resolves.toEqual({ which: 'typescript6', sub: 'tsserver6' });
});

it('finds the package root above a nested file', () => {
  expect(
    packageRootFromFile(requireFromRoot.resolve('typescript6-copy/lib/tsserverlibrary.js'))
  ).toBe(join(nodeModules, 'typescript6-copy'));
});
