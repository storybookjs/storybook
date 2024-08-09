import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import * as process from 'node:process';

import { globalExternals } from '@fal-works/esbuild-plugin-global-externals';
import { readJson } from '@ndelangen/fs-extra-unified';
import type chalk from 'chalk';
import { spawn } from 'cross-spawn';
import * as esbuild from 'esbuild';
import { glob } from 'glob';
import limit from 'p-limit';
import * as prettier from 'prettier';
import prettyTime from 'pretty-hrtime';
import * as rollup from 'rollup';
import * as rpd from 'rollup-plugin-dts';
import slash from 'slash';
import sortPackageJson from 'sort-package-json';
import { dedent } from 'ts-dedent';
import * as tsup from 'tsup';
import type * as typefest from 'type-fest';
import typescript from 'typescript';
import ts from 'typescript';

import { CODE_DIRECTORY } from '../utils/constants';

export { globalExternals };

export const dts = async (entry: string, externals: string[], tsconfig: string) => {
  const dir = dirname(entry).replace('src', 'dist');
  const out = await rollup.rollup({
    input: entry,
    external: [...externals, 'ast-types'].map((dep) => new RegExp(`^${dep}($|\\/|\\\\)`)),
    output: { file: entry.replace('src', 'dist').replace('.ts', '.d.ts'), format: 'es' },
    plugins: [
      rpd.dts({
        respectExternal: true,
        tsconfig,
        compilerOptions: {
          esModuleInterop: true,
          baseUrl: '.',
          declaration: true,
          noEmit: false,
          emitDeclarationOnly: true,
          noEmitOnError: true,
          checkJs: false,
          declarationMap: false,
          skipLibCheck: true,
          preserveSymlinks: false,
          target: ts.ScriptTarget.ESNext,
        },
      }),
    ],
  });
  const { output } = await out.generate({
    format: 'es',
    // dir: dirname(entry).replace('src', 'dist'),
    file: entry.replace('src', 'dist').replace('.ts', '.d.ts'),
  });

  await Promise.all(
    output.map(async (o) => {
      if (o.type === 'chunk') {
        await writeFile(join(dir, o.fileName), o.code);
      } else {
        throw new Error(`Unexpected output type: ${o.type} for ${entry} (${o.fileName})`);
      }
    })
  );
};

export { spawn };

export const defineEntry =
  (cwd: string) =>
  (
    entry: string,
    targets: ('node' | 'browser')[],
    generateDTS: boolean = true,
    externals: string[] = [],
    internals: string[] = []
  ) => ({
    file: slash(join(cwd, entry)),
    node: targets.includes('node'),
    browser: targets.includes('browser'),
    dts: generateDTS,
    externals,
    internals,
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
  tsup,
  typefest,
  process,
  esbuild,
  prettyTime,
  chalk,
  dedent,
  limit,
  sortPackageJson,
  prettier,
};

export const nodeInternals = [
  'module',
  'node:module',
  ...require('module').builtinModules.flatMap((m: string) => [m, `node:${m}`]),
];

export const getWorkspace = async () => {
  const codePackage = await readJson(join(CODE_DIRECTORY, 'package.json'));
  const {
    workspaces: { packages: patterns },
  } = codePackage;

  const workspaces = await Promise.all(
    (patterns as string[]).map(async (pattern: string) => glob(pattern, { cwd: CODE_DIRECTORY }))
  );

  return Promise.all(
    workspaces
      .flatMap((p) => p.map((i) => join(CODE_DIRECTORY, i)))
      .map(async (p) => {
        const pkg = await readJson(join(p, 'package.json'));
        return { ...pkg, path: p } as typefest.PackageJson &
          Required<Pick<typefest.PackageJson, 'name' | 'version'>> & { path: string };
      })
  );
};
