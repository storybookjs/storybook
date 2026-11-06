// What docgen's test suites and benchmarks run on: the workspace's TypeScript 6, or the native API
// of TypeScript 7.1 from the monorepo's `typescript-native` alias.
import ts from 'typescript';

import {
  type LoadedDocgenTypeScript,
  loadNativeTypeScriptModules,
} from './load-docgen-typescript.ts';
import type { NativeTypeScriptModules } from './native/native-typescript.ts';

// The API a test suite runs on. The `vitest.config.native-typescript.ts` projects set
// `STORYBOOK_DOCGEN_TS_API=native`.
export const DOCGEN_TS_API: LoadedDocgenTypeScript['api'] =
  process.env.STORYBOOK_DOCGEN_TS_API === 'native' ? 'native' : 'compiler';

export const loadTestNativeTypeScriptModules = (): Promise<NativeTypeScriptModules> =>
  loadNativeTypeScriptModules((subpath) => import(`typescript-native${subpath.slice(1)}`));

export async function loadTestTypeScript(
  api: LoadedDocgenTypeScript['api'] = DOCGEN_TS_API
): Promise<LoadedDocgenTypeScript> {
  return api === 'native'
    ? { api, typescript: await loadTestNativeTypeScriptModules() }
    : { api, typescript: ts };
}
