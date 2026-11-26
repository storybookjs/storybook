import ts from 'typescript';

import {
  type LoadedDocgenTypeScript,
  loadNativeTypeScriptModules,
} from './load-docgen-typescript.ts';
import type { NativeTypeScriptModules } from './native/native-typescript.ts';

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
