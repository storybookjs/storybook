import type { NativeTypeScriptModules } from './native/native-typescript.ts';

// The native API's modules from the monorepo's `typescript-native` alias (TypeScript 7.1).
export async function loadNativeTypeScriptModules(): Promise<NativeTypeScriptModules> {
  return {
    sync: await import('typescript-native/sync'),
    ast: await import('typescript-native/ast'),
    factory: await import('typescript-native/ast/factory'),
  };
}
