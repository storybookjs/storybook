import { createRequire } from 'node:module';

import {
  loadTypeScriptCompilerApi,
  packageRootFromFile,
  redirectTypeScriptToTypeScript6,
} from 'storybook/internal/component-meta';

import type ts from 'typescript';

const require = createRequire(import.meta.url);

const importers = {
  typescript: () => import('typescript'),
  typescript6: () => import('@typescript/typescript6'),
};

export const loadTypeScript = () => loadTypeScriptCompilerApi<typeof ts>(importers);

/**
 * When Storybook falls back to `@typescript/typescript6`, make `react-docgen-typescript` load it in
 * place of the project's `typescript`. See {@link redirectTypeScriptToTypeScript6}.
 */
export const redirectReactDocgenTypescriptToTypeScript6 = () =>
  redirectTypeScriptToTypeScript6(
    packageRootFromFile(require.resolve('react-docgen-typescript')),
    importers,
    () => require.resolve('@typescript/typescript6')
  );
