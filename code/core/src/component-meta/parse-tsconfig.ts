import { dirname } from 'node:path';

import type { ProjectCommandLine } from './types.ts';

/**
 * The tsconfig-parsing surface of the `typescript` module this helper drives.
 */
export interface TsconfigParserModule {
  sys: {
    readFile(path: string): string | undefined;
  };
  readJsonConfigFile(fileName: string, readFile: (path: string) => string | undefined): unknown;
  /**
   * Incidental parameters are `any`, not `unknown`: the consumer's function is a plain declaration
   * (no method bivariance), so under `strictFunctionTypes` these positions are checked
   * contravariantly against the consumer's own `TsConfigSourceFile`/`CompilerOptions`/… — the exact
   * cross-instance comparison this contract exists to avoid. `any` is assignable in both
   * directions and keeps the check shallow.
   */
  parseJsonSourceFileConfigFileContent(
    // oxlint-disable no-explicit-any
    json: any,
    host: any,
    basePath: string,
    existingOptions: any,
    configFileName: string,
    resolutionStack: any,
    extraFileExtensions: any
    // oxlint-enable no-explicit-any
  ): ProjectCommandLine & { options: { outDir?: unknown } };
}

/** Structural `ts.FileExtensionInfo`; `scriptKind` is the numeric `ts.ScriptKind` enum value. */
export interface FileExtensionInfo {
  extension: string;
  isMixedContent: boolean;
  scriptKind?: number;
}

/**
 * Parse a tsconfig with TypeScript's own machinery, the way `tsc` would, with the two fixes every
 * component-meta project needs: `outDir` neutralized (volar#1786 / TS#30457) and separators
 * normalized for the manager's path comparisons.
 *
 * Adapted from:
 * https://github.com/volarjs/volar.js/blob/882cd56d46a13d272f34e451f495d3d62251969a/packages/language-server/lib/project/typescriptProjectLs.ts#L262-L353
 */
export function parseTsconfigCommandLine<CL extends ProjectCommandLine = ProjectCommandLine>(
  typescript: TsconfigParserModule,
  tsconfig: string,
  extraFileExtensions?: readonly FileExtensionInfo[]
): CL {
  const config = typescript.readJsonConfigFile(tsconfig, typescript.sys.readFile);
  const content = typescript.parseJsonSourceFileConfigFileContent(
    config,
    typescript.sys,
    dirname(tsconfig),
    {},
    tsconfig,
    undefined,
    extraFileExtensions
  );
  // fix https://github.com/johnsoncodehk/volar/issues/1786
  // https://github.com/microsoft/TypeScript/issues/30457
  content.options.outDir = undefined;
  content.fileNames = content.fileNames.map((fileName) => fileName.replace(/\\/g, '/'));
  // The runtime value is whatever the caller's own module produced; core only typed the subset.
  return content as unknown as CL;
}
