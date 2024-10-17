import { writeFile } from 'node:fs/promises';
import { dirname, join, parse, posix, relative, resolve, sep } from 'node:path';

import type { Metafile } from 'esbuild';
import aliasPlugin from 'esbuild-plugin-alias';
// eslint-disable-next-line depend/ban-dependencies
import * as fs from 'fs-extra';
// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';
import slash from 'slash';
import { dedent } from 'ts-dedent';
import type { Options } from 'tsup';
import { build } from 'tsup';
import type { PackageJson } from 'type-fest';

import { exec } from '../utils/exec';
import { esbuild } from './tools';

/* TYPES */

type Formats = 'esm' | 'cjs';
type BundlerConfig = {
  entries: string[];
  externals: string[];
  noExternal: string[];
  platform: Options['platform'];
  pre: string;
  post: string;
  formats: Formats[];
};
type PackageJsonWithBundlerConfig = PackageJson & {
  bundler: BundlerConfig;
};
type DtsConfigSection = Pick<Options, 'dts' | 'tsconfig'>;

/* MAIN */

const OUT_DIR = join(process.cwd(), 'dist');

const run = async ({ cwd, flags }: { cwd: string; flags: string[] }) => {
  const {
    name,
    dependencies,
    peerDependencies,
    bundler: {
      entries = [],
      externals: extraExternals = [],
      noExternal: extraNoExternal = [],
      platform,
      pre,
      post,
      formats = ['esm', 'cjs'],
    },
  } = (await fs.readJson(join(cwd, 'package.json'))) as PackageJsonWithBundlerConfig;

  if (pre) {
    await exec(`jiti ${pre}`, { cwd });
  }

  const metafilesDir = join(
    __dirname,
    '..',
    '..',
    'code',
    'bench',
    'esbuild-metafiles',
    name.replace('@storybook', '')
  );

  const reset = hasFlag(flags, 'reset');
  const watch = hasFlag(flags, 'watch');
  const optimized = hasFlag(flags, 'optimized');
  if (reset) {
    await fs.emptyDir(OUT_DIR);
    await fs.emptyDir(metafilesDir);
  }

  const tasks: Promise<any>[] = [];

  const externals = [
    name,
    ...extraExternals,
    ...Object.keys(dependencies || {}),
    ...Object.keys(peerDependencies || {}),
  ];

  const allEntries = entries.map((e: string) => slash(join(cwd, e)));

  const { dtsBuild, dtsConfig, tsConfigExists } = await getDTSConfigs({
    formats,
    entries,
    optimized,
  });

  /* preset files are always CJS only.
   * Generating an ESM file for them anyway is problematic because they often have a reference to `require`.
   * TSUP generated code will then have a `require` polyfill/guard in the ESM files, which causes issues for webpack.
   */
  const nonPresetEntries = allEntries.filter((f) => !parse(f).name.includes('preset'));

  const noExternal = [...extraNoExternal];

  if (formats.includes('esm')) {
    tasks.push(
      build({
        noExternal,
        silent: true,
        treeshake: true,
        entry: nonPresetEntries,
        shims: false,
        watch,
        outDir: OUT_DIR,
        sourcemap: false,
        metafile: true,
        format: ['esm'],
        target: platform === 'node' ? ['node18'] : ['chrome100', 'safari15', 'firefox91'],
        clean: false,
        ...(dtsBuild === 'esm' ? dtsConfig : {}),
        platform: platform || 'browser',
        esbuildPlugins:
          platform === 'node'
            ? []
            : [
                aliasPlugin({
                  process: resolve('../node_modules/process/browser.js'),
                  util: resolve('../node_modules/util/util.js'),
                }),
              ],
        external: externals,

        banner:
          platform === 'node'
            ? {
                js: dedent`
                  import ESM_COMPAT_Module from "node:module";
                  import { fileURLToPath as ESM_COMPAT_fileURLToPath } from 'node:url';
                  import { dirname as ESM_COMPAT_dirname } from 'node:path';
                  const __filename = ESM_COMPAT_fileURLToPath(import.meta.url);
                  const __dirname = ESM_COMPAT_dirname(__filename);
                  const require = ESM_COMPAT_Module.createRequire(import.meta.url);
                `,
              }
            : {},

        esbuildOptions: (c) => {
          c.conditions = ['module'];
          c.platform = platform || 'browser';
          Object.assign(c, getESBuildOptions(optimized));
        },
      })
    );
  }

  if (formats.includes('cjs')) {
    tasks.push(
      build({
        noExternal,
        silent: true,
        entry: allEntries,
        watch,
        outDir: OUT_DIR,
        sourcemap: false,
        metafile: true,
        format: ['cjs'],
        target: 'node18',
        ...(dtsBuild === 'cjs' ? dtsConfig : {}),
        platform: 'node',
        clean: false,
        external: externals,

        esbuildOptions: (c) => {
          c.platform = 'node';
          Object.assign(c, getESBuildOptions(optimized));
        },
      })
    );
  }

  if (tsConfigExists && !optimized) {
    tasks.push(...entries.map(generateDTSMapperFile));
  }

  await Promise.all(tasks);

  if (!watch) {
    await saveMetafiles({ metafilesDir, formats });
  }

  const dtsFiles = await glob(OUT_DIR + '/**/*.d.ts');
  await Promise.all(
    dtsFiles.map(async (file) => {
      const content = await fs.readFile(file, 'utf-8');
      await fs.writeFile(
        file,
        content.replace(/from \'core\/dist\/(.*)\'/g, `from 'storybook/internal/$1'`)
      );
    })
  );

  if (post) {
    await exec(`jiti ${post}`, { cwd }, { debug: true });
  }

  if (process.env.CI !== 'true') {
    console.log('done');
  }
};

/* UTILS */

async function getDTSConfigs({
  formats,
  entries,
  optimized,
}: {
  formats: Formats[];
  entries: string[];
  optimized: boolean;
}) {
  const tsConfigPath = join(cwd, 'tsconfig.json');
  const tsConfigExists = await fs.pathExists(tsConfigPath);

  const dtsBuild = optimized && formats[0] && tsConfigExists ? formats[0] : undefined;

  const dtsConfig: DtsConfigSection = {
    tsconfig: tsConfigPath,
    dts: {
      entry: entries,
      resolve: true,
    },
  };

  return { dtsBuild, dtsConfig, tsConfigExists };
}

function getESBuildOptions(optimized: boolean) {
  return {
    logLevel: 'error',
    legalComments: 'none',
    minifyWhitespace: optimized,
    minifyIdentifiers: false,
    minifySyntax: optimized,
  };
}

async function generateDTSMapperFile(file: string) {
  const { name: entryName, dir } = parse(file);

  const pathName = join(process.cwd(), dir.replace('./src', 'dist'), `${entryName}.d.ts`);
  const srcName = join(process.cwd(), file);
  const rel = relative(dirname(pathName), dirname(srcName)).split(sep).join(posix.sep);

  await fs.ensureFile(pathName);
  await fs.writeFile(
    pathName,
    dedent`
      // dev-mode
      export * from '${rel}/${entryName}';
    `,
    { encoding: 'utf-8' }
  );
}

async function saveMetafiles({
  metafilesDir,
  formats,
}: {
  metafilesDir: string;
  formats: Formats[];
}) {
  await fs.ensureDir(metafilesDir);
  const metafile: Metafile = {
    inputs: {},
    outputs: {},
  };

  await Promise.all(
    formats.map(async (format) => {
      const fromFilename = `metafile-${format}.json`;
      const currentMetafile = await fs.readJson(join(OUT_DIR, fromFilename));
      metafile.inputs = { ...metafile.inputs, ...currentMetafile.inputs };
      metafile.outputs = { ...metafile.outputs, ...currentMetafile.outputs };

      await fs.rm(join(OUT_DIR, fromFilename));
    })
  );

  await writeFile(join(metafilesDir, 'metafile.json'), JSON.stringify(metafile, null, 2));
  await writeFile(
    join(metafilesDir, 'metafile.txt'),
    await esbuild.analyzeMetafile(metafile, { color: false, verbose: false })
  );
}

const hasFlag = (flags: string[], name: string) => !!flags.find((s) => s.startsWith(`--${name}`));

/* SELF EXECUTION */

const flags = process.argv.slice(2);
const cwd = process.cwd();

run({ cwd, flags }).catch((err: unknown) => {
  // We can't let the stack try to print, it crashes in a way that sets the exit code to 0.
  // Seems to have something to do with running JSON.parse() on binary / base64 encoded sourcemaps
  // in @cspotcode/source-map-support
  if (err instanceof Error) {
    console.error(err.stack);
  }
  process.exit(1);
});
