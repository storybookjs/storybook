import * as fs from 'fs-extra';
import path, { dirname, join, relative } from 'path';
import type { Options } from 'tsup';
import type { PackageJson } from 'type-fest';
import { build } from 'tsup';
import aliasPlugin from 'esbuild-plugin-alias';
import dedent from 'ts-dedent';
import slash from 'slash';
import { exec } from '../utils/exec';

/* TYPES */

type BundlerConfig = {
  browserEntries: string[];
  nodeEntries: string[];
  externals: string[];
  pre: string;
  post: string;
};
type PackageJsonWithBundlerConfig = PackageJson & {
  bundler: BundlerConfig;
};
type DtsConfigSection = Pick<Options, 'dts' | 'tsconfig'>;

/* MAIN */

const run = async ({ cwd, flags }: { cwd: string; flags: string[] }) => {
  const {
    name,
    dependencies,
    peerDependencies,
    bundler: { browserEntries = [], nodeEntries = [], externals: extraExternals = [], pre, post },
  } = (await fs.readJson(join(cwd, 'package.json'))) as PackageJsonWithBundlerConfig;

  if (pre) {
    await exec(`node -r ${__dirname}/../node_modules/esbuild-register/register.js ${pre}`, { cwd });
  }

  const reset = hasFlag(flags, 'reset');
  const watch = hasFlag(flags, 'watch');
  const optimized = hasFlag(flags, 'optimized');

  if (reset) {
    await fs.emptyDir(join(process.cwd(), 'dist'));
  }

  const tasks: Promise<any>[] = [];

  const outDir = join(process.cwd(), 'dist');
  const externals = [
    name,
    ...extraExternals,
    ...Object.keys(dependencies || {}),
    ...Object.keys(peerDependencies || {}),
  ];

  const { tsConfigExists } = await getDTSConfigs({
    entries: [],
    optimized,
  });

  if (browserEntries.length > 0) {
    const allEntries = browserEntries.map((e: string) => slash(join(cwd, e)));

    const { dtsBuild, dtsConfig } = await getDTSConfigs({
      entries: allEntries,
      optimized,
    });

    tasks.push(
      build({
        silent: true,
        entry: allEntries,
        watch,
        outDir,
        sourcemap: false,
        format: ['esm'],
        outExtension: () => ({
          js: '.js',
        }),
        target: ['chrome100', 'safari15', 'firefox91'],
        clean: false,
        ...(dtsBuild ? dtsConfig : {}),
        platform: 'browser',
        esbuildPlugins: [
          aliasPlugin({
            process: path.resolve('../node_modules/process/browser.js'),
            util: path.resolve('../node_modules/util/util.js'),
          }),
        ],
        external: externals,

        esbuildOptions: (c) => {
          c.conditions = ['module'];
          c.platform = 'browser';
          Object.assign(c, getESBuildOptions(optimized));
        },
      })
    );
  }

  if (nodeEntries.length > 0) {
    const allEntries = nodeEntries.map((e: string) => slash(join(cwd, e)));

    const { dtsBuild, dtsConfig } = await getDTSConfigs({
      entries: allEntries,
      optimized,
    });

    tasks.push(
      build({
        silent: true,
        entry: allEntries,
        watch,
        outDir,
        sourcemap: false,
        format: ['cjs'],
        outExtension: () => ({
          js: '.js',
        }),
        target: 'node18',
        clean: false,
        ...(dtsBuild ? dtsConfig : {}),
        platform: 'node',
        esbuildPlugins: [
          aliasPlugin({
            process: path.resolve('../node_modules/process/browser.js'),
            util: path.resolve('../node_modules/util/util.js'),
          }),
        ],
        external: externals,

        esbuildOptions: (c) => {
          c.platform = 'node';
          Object.assign(c, getESBuildOptions(optimized));
        },
      })
    );
  }

  if (tsConfigExists && !optimized) {
    tasks.push(...[...browserEntries, ...nodeEntries].map(generateDTSMapperFile));
  }

  await Promise.all(tasks);

  if (post) {
    await exec(
      `node -r ${__dirname}/../node_modules/esbuild-register/register.js ${post}`,
      { cwd },
      { debug: true }
    );
  }

  if (process.env.CI !== 'true') {
    console.log('done');
  }
};

/* UTILS */

async function getDTSConfigs({ entries, optimized }: { entries: string[]; optimized: boolean }) {
  const tsConfigPath = join(cwd, 'tsconfig.json');
  const tsConfigExists = await fs.pathExists(tsConfigPath);

  const dtsBuild = optimized && tsConfigExists;

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
  const { name: entryName, dir } = path.parse(file);

  const pathName = join(process.cwd(), dir.replace('./src', 'dist'), `${entryName}.d.ts`);
  const srcName = join(process.cwd(), file);
  const rel = relative(dirname(pathName), dirname(srcName)).split(path.sep).join(path.posix.sep);

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
