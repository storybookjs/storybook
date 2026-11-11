import { join } from 'node:path';
import * as process from 'node:process';

import { globalExternals } from '@fal-works/esbuild-plugin-global-externals';
import { spawn } from 'cross-spawn';
import * as esbuild from 'esbuild';
import limit from 'p-limit';
import picocolors from 'picocolors';
import prettyTime from 'pretty-hrtime';
// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';
import sortPackageJson from 'sort-package-json';
import { dedent } from 'ts-dedent';
import type * as typefest from 'type-fest';
import typescript from 'typescript';

export { globalExternals };

export { spawn };

export const defineEntry =
  (cwd: string) =>
  (
    entry: string,
    targets: ('node' | 'browser')[],
    generateDTS: boolean = true,
    externals: string[] = [],
    internals: string[] = [],
    noExternal: string[] = [],
    isPublic: boolean = false
  ) => ({
    file: slash(join(cwd, entry)),
    node: targets.includes('node'),
    browser: targets.includes('browser'),
    dts: generateDTS,
    externals,
    internals,
    noExternal,
    isPublic,
  });

export const merge = <T extends Record<string, any>>(...objects: T[]): T =>
  Object.assign({}, ...objects);

export const measure = async (fn: () => Promise<void>) => {
  const start = process.hrtime();
  await fn();
  return process.hrtime(start);
};

export {
  typescript,
  typefest,
  process,
  esbuild,
  prettyTime,
  picocolors,
  dedent,
  limit,
  sortPackageJson,
};

export const nodeInternals = [
  'module',
  'node:module',
  ...require('module').builtinModules.flatMap((m: string) => [m, `node:${m}`]),
];
