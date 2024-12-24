import { writeFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';

import type { Metafile } from 'esbuild';
import aliasPlugin from 'esbuild-plugin-alias';
// eslint-disable-next-line depend/ban-dependencies
import * as fs from 'fs-extra';
// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';
import { dirname, join, parse, posix, relative, sep } from 'path';
import slash from 'slash';
import { dedent } from 'ts-dedent';
import type { Options } from 'tsup';
import { build } from 'tsup';
import type { PackageJson } from 'type-fest';

import { globalPackages as globalManagerPackages } from '../../code/core/src/manager/globals/globals';
import { globalPackages as globalPreviewPackages } from '../../code/core/src/preview/globals/globals';
import { exec } from '../utils/exec';
import { esbuild } from './tools';

/* TYPES */

type Formats = 'esm' | 'cjs';
type BundlerConfig = {
  previewEntries: string[];
  managerEntries: string[];
  nodeEntries: string[];
  exportEntries: string[];
  externals: string[];
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

export const nodeInternals = [
  'module',
  'node:module',
  ...builtinModules.flatMap((m: string) => [m, `node:${m}`]),
];

const run = async ({ cwd, flags }: { cwd: string; flags: string[] }) => {
  const {
    name,
    dependencies,
    peerDependencies,
    bundler: {
      managerEntries = [],
      previewEntries = [],
      nodeEntries = [],
      exportEntries = [],
      externals: extraExternals = [],
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
    name.replace('@storybook/', '')
  );

  const reset = hasFlag(flags, 'reset');
  const watch = hasFlag(flags, 'watch');
  const optimized = hasFlag(flags, 'optimized');

  if (reset) {
    await fs.emptyDir(OUT_DIR);
    await fs.emptyDir(metafilesDir);
  }

  const tasks: (() => Promise<any>)[] = [];

  const commonOptions: Options = {
    outDir: OUT_DIR,
    metafile: true,
    silent: true,
    treeshake: true,
    shims: false,
    watch,
    clean: false,
  };

  const browserOptions: Options = {
    target: ['chrome100', 'safari15', 'firefox91'],
    platform: 'browser',
    esbuildPlugins: [
      aliasPlugin({
        process: require.resolve('../node_modules/process/browser.js'),
        util: require.resolve('../node_modules/util/util.js'),
        assert: require.resolve('browser-assert'),
      }),
    ],
    format: ['esm'],
    esbuildOptions: (options) => {
      options.conditions = ['module'];
      options.platform = 'browser';
      options.loader = {
        ...options.loader,
        '.png': 'dataurl',
      };
      Object.assign(options, getESBuildOptions(optimized));
    },
  };

  const commonExternals = [
    name,
    ...extraExternals,
    ...Object.keys(dependencies || {}),
    ...Object.keys(peerDependencies || {}),
  ];

  if (exportEntries.length > 0) {
    const { dtsConfig, tsConfigExists } = await getDTSConfigs({
      formats,
      entries: exportEntries,
      optimized,
    });

    tasks.push(async () => {
      await Promise.all([
        build({
          ...commonOptions,
          ...(optimized ? dtsConfig : {}),
          ...browserOptions,
          entry: exportEntries,
          external: [...commonExternals, ...globalManagerPackages, ...globalPreviewPackages],
        }),
        build({
          ...commonOptions,
          ...(optimized ? dtsConfig : {}),
          entry: exportEntries,
          format: ['cjs'],
          target: browserOptions.target,
          platform: 'neutral',
          external: [...commonExternals, ...globalManagerPackages, ...globalPreviewPackages],
          esbuildOptions: (options) => {
            options.platform = 'neutral';
            Object.assign(options, getESBuildOptions(optimized));
          },
        }),
      ]);
      if (!watch) {
        await readMetafiles({ formats: ['esm', 'cjs'] });
      }
    });

    if (tsConfigExists && !optimized) {
      tasks.push(...exportEntries.map((entry) => () => generateDTSMapperFile(entry)));
    }
  }

  if (managerEntries.length > 0) {
    tasks.push(async () => {
      await build({
        ...commonOptions,
        ...browserOptions,
        entry: managerEntries.map((e: string) => slash(join(cwd, e))),
        outExtension: () => ({
          js: '.js',
        }),
        external: [...commonExternals, ...globalManagerPackages],
      });
      if (!watch) {
        await readMetafiles({ formats: ['esm'] });
      }
    });
  }

  if (previewEntries.length > 0) {
    const { dtsConfig, tsConfigExists } = await getDTSConfigs({
      formats,
      entries: previewEntries,
      optimized,
    });
    tasks.push(async () => {
      await build({
        ...commonOptions,
        ...(optimized ? dtsConfig : {}),
        ...browserOptions,
        format: ['esm', 'cjs'],
        entry: previewEntries.map((e: string) => slash(join(cwd, e))),
        external: [...commonExternals, ...globalPreviewPackages],
      });
      if (!watch) {
        await readMetafiles({ formats: ['esm', 'cjs'] });
      }
    });

    if (tsConfigExists && !optimized) {
      tasks.push(...previewEntries.map((entry) => () => generateDTSMapperFile(entry)));
    }
  }

  if (nodeEntries.length > 0) {
    const { dtsConfig, tsConfigExists } = await getDTSConfigs({
      formats: ['esm'],
      entries: nodeEntries,
      optimized,
    });
    tasks.push(async () => {
      await Promise.all([
        build({
          ...commonOptions,
          entry: nodeEntries.map((e: string) => slash(join(cwd, e))),
          format: ['cjs'],
          target: 'node18',
          platform: 'node',
          external: commonExternals,
          esbuildOptions: (c) => {
            c.platform = 'node';
            Object.assign(c, getESBuildOptions(optimized));
          },
        }),
        build({
          ...commonOptions,
          ...(optimized ? dtsConfig : {}),
          entry: nodeEntries.map((e: string) => slash(join(cwd, e))),
          format: ['esm'],
          target: 'node18',
          platform: 'neutral',
          banner: {
            js: dedent`
              import ESM_COMPAT_Module from "node:module";
              import { fileURLToPath as ESM_COMPAT_fileURLToPath } from 'node:url';
              import { dirname as ESM_COMPAT_dirname } from 'node:path';
              const __filename = ESM_COMPAT_fileURLToPath(import.meta.url);
              const __dirname = ESM_COMPAT_dirname(__filename);
              const require = ESM_COMPAT_Module.createRequire(import.meta.url);
            `,
          },
          external: [...commonExternals, ...nodeInternals],
          esbuildOptions: (c) => {
            c.mainFields = ['main', 'module', 'node'];
            c.conditions = ['node', 'module', 'import', 'require'];
            c.platform = 'neutral';
            Object.assign(c, getESBuildOptions(optimized));
          },
        }),
      ]);
      if (!watch) {
        await readMetafiles({ formats: ['esm', 'cjs'] });
      }
    });

    if (tsConfigExists && !optimized) {
      tasks.push(...nodeEntries.map((entry) => () => generateDTSMapperFile(entry)));
    }
  }

  for (const task of tasks) {
    await task();
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

  if (!watch) {
    await saveMetafiles({ metafilesDir });
  }

  if (post) {
    await exec(`jiti ${post}`, { cwd }, { debug: true });
  }

  console.log('done');
};

/* UTILS */

// keep in sync with code/lib/manager-api/src/index.ts

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

const metafile: Metafile = {
  inputs: {},
  outputs: {},
};

async function readMetafiles({ formats }: { formats: Formats[] }) {
  await Promise.all(
    formats.map(async (format) => {
      const fromFilename = `metafile-${format}.json`;
      const currentMetafile = await fs.readJson(join(OUT_DIR, fromFilename));
      metafile.inputs = { ...metafile.inputs, ...currentMetafile.inputs };
      metafile.outputs = { ...metafile.outputs, ...currentMetafile.outputs };

      await fs.rm(join(OUT_DIR, fromFilename));
    })
  );
}

async function saveMetafiles({ metafilesDir }: { metafilesDir: string }) {
  await fs.ensureDir(metafilesDir);

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
