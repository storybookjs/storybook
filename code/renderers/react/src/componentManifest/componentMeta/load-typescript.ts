/**
 * Load the `typescript` that React's component-meta extraction runs on, from this package, so the
 * import resolves where `@storybook/react` declares its `typescript` peer.
 *
 * The native API's subpaths only exist in TypeScript 7.1 and newer, so their types come from the
 * `typescript-native` alias of the monorepo, while the runtime import is the user's `typescript`.
 */
import { loadTypeScriptForDocgen } from 'storybook/internal/common';

import type ts from 'typescript';

import type { ReactTypeScript } from './ComponentMetaManager.ts';
import type { NativeTypeScriptModules } from './native/native-typescript.ts';

export const loadReactTypeScript = (): Promise<ReactTypeScript> =>
  loadTypeScriptForDocgen<typeof ts, NativeTypeScriptModules>({
    importCompilerApi: () => import('typescript'),
    importNativeApi: async () => ({
      // @ts-expect-error -- the subpath exists in TypeScript 7.1 and newer, not in the workspace's.
      sync: (await import('typescript/sync')) as unknown as NativeTypeScriptModules['sync'],
      // @ts-expect-error -- as above.
      ast: (await import('typescript/ast')) as unknown as NativeTypeScriptModules['ast'],
    }),
  });
