import { createRequire } from 'node:module';

import {
  loadTypeScriptCompilerApi,
  packageRootFromFile,
  shareTypeScriptCompilerApi,
} from 'storybook/internal/component-meta';

import type ts from 'typescript';

const require = createRequire(import.meta.url);

const importers = {
  typescript: () => import('typescript'),
  typescript6: () => import('@typescript/typescript6'),
};

export const loadTypeScript = () => loadTypeScriptCompilerApi<typeof ts>(importers);

const typescript6Entry = () => require.resolve('@typescript/typescript6');

export const shareTypeScriptWith = (packageDir: string) =>
  shareTypeScriptCompilerApi(packageDir, importers, typescript6Entry);

export const shareReactDocgenTypescript = () =>
  shareTypeScriptWith(packageRootFromFile(require.resolve('react-docgen-typescript')));
