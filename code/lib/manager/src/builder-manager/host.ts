import './hooks.ts';
import '@storybook/core/internal/deep/preview/hooks';

import { cp, rm, writeFile } from 'node:fs/promises';
import type { Server as HttpServer } from 'node:http';

import { getAutoRefs, resolveRefs } from '@storybook/core/internal/common';
import { logger } from '@storybook/core/internal/node-logger';
import type { Ref, ServerApp, Stats } from '@storybook/core/internal/types';

import { basename, join, parse } from 'pathe';

import { getFrameworkNameFromConfig } from '@storybook/core/internal/common';
import type { Storybook } from '@storybook/core';
import { serveBuildOutput } from '@storybook/core/internal/deep/common/utils/server-statics';
import { resolvePackageDir } from '@storybook/core/internal/deep/utils/module';
import { getManagerConfig } from './utils/config.ts';
import { readOrderedFiles } from './utils/files.ts';
import { buildFrameworkGlobals } from './utils/framework.ts';
import { readTemplate, renderHTML } from './utils/template.ts';

/** Own the manager compiler attached by a Storybook host. */
export interface ManagerHost {
  /** Serve the manager through the host's router and HTTP server. */
  dev(host: { router: ServerApp; server: HttpServer; startTime: [number, number] }): Promise<{
    stats?: Stats;
    totalTime: [number, number];
    bail(): Promise<void>;
  }>;
  /** Write the manager into `storybook.options.outputDir`. */
  build(host: { startTime: [number, number] }): Promise<Stats | void>;
  /** Stop this host's pending manager compilation. */
  bail(): Promise<void>;
}

const CORE_DIR_ORIGIN = join(resolvePackageDir('@storybook/manager', import.meta.url), 'dist/ui');
const IS_ROOT_PATH = /^\/($|\?)/;

/** Create an isolated manager compiler for a configured instance. */
export function createManagerHost(storybook: Storybook): ManagerHost {
  const options = storybook.options;
  let asyncIterator: AsyncGenerator<unknown, unknown> | undefined;

  async function getData() {
    const refs = options.test
      ? Promise.resolve({} as Record<string, Ref>)
      : getAutoRefs(options)
          .then((refs) => storybook.callHook('manager:refs:extend', refs))
          .then((refs) => resolveRefs(refs as Record<string, Ref>));
    const favicon = storybook.callHook('manager:favicon:extend', undefined).then(basename);
    const features = storybook.callHook('core:features:extend', undefined);
    const logLevel = storybook.callHook('preview:log-level:extend', undefined);
    const title = storybook.callHook('manager:title:extend', undefined);
    const docsOptions = storybook.callHook('core:docs:extend', {});
    const tagsOptions = storybook.callHook('core:tags:extend', {});
    const template = readTemplate('template.ejs');
    const customHead = storybook.callHook('manager:head:extend', undefined);
    const [entries, envs] = await Promise.all([
      storybook.callHook('manager:entries:collect', []),
      storybook.callHook('core:env:extend', undefined),
    ]);
    const [config, { build: instance }] = await Promise.all([
      getManagerConfig(options, entries, envs),
      import('esbuild'),
    ]);
    return {
      refs,
      favicon,
      features,
      logLevel,
      title,
      docsOptions,
      tagsOptions,
      template,
      customHead,
      config,
      instance,
    };
  }

  async function getGlobals(): Promise<Record<string, unknown>> {
    const [core, framework, security] = await Promise.all([
      storybook.callHook('core:config:extend', undefined),
      storybook.callHook('core:framework:extend', undefined),
      storybook.callHook('server:security:extend', undefined),
    ]);
    const frameworkName =
      getFrameworkNameFromConfig(framework) || getFrameworkNameFromConfig(options.framework);
    if (!frameworkName) {
      throw new Error("You must specify a framework in '.storybook/main.js' config.");
    }
    return buildFrameworkGlobals(options, core, frameworkName, security);
  }

  async function* starter({
    startTime,
    router,
  }: Parameters<ManagerHost['dev']>[0]): AsyncGenerator<
    unknown,
    Awaited<ReturnType<ManagerHost['dev']>>
  > {
    if (!options.quiet) {
      logger.info('Starting...');
    }

    const {
      config,
      favicon,
      customHead,
      features,
      instance,
      refs,
      template,
      title,
      logLevel,
      docsOptions,
      tagsOptions,
    } = await getData();

    yield;

    const addonsDir = config.outdir;
    await rm(addonsDir, { recursive: true, force: true });

    yield;

    const compilation = await instance({
      ...config,
    });

    yield;

    router.use('/sb-addons', serveBuildOutput(addonsDir));
    router.use('/sb-manager', serveBuildOutput(CORE_DIR_ORIGIN));

    const { cssFiles, jsFiles } = await readOrderedFiles(addonsDir, compilation?.outputFiles);

    if (compilation.metafile && options.outputDir) {
      await writeFile(
        join(options.outputDir, 'metafile.json'),
        JSON.stringify(compilation.metafile, null, 2)
      );
    }

    const globals: Record<string, unknown> = await getGlobals();

    yield;

    const html = await renderHTML(
      template,
      title,
      favicon,
      customHead,
      cssFiles,
      jsFiles,
      features,
      refs,
      logLevel,
      docsOptions,
      tagsOptions,
      options,
      globals
    );

    yield;

    router.use('/', ({ url }, res, next) => {
      if (url && IS_ROOT_PATH.test(url)) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.write(html);
        res.end();
      } else {
        next();
      }
    });
    router.use(`/index.html`, (req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      res.write(html);
      res.end();
    });

    return {
      bail,
      stats: {
        toJson: () => ({}),
      },
      totalTime: process.hrtime(startTime),
    };
  }

  async function* builder({
    startTime,
  }: Parameters<ManagerHost['build']>[0]): AsyncGenerator<unknown, Stats> {
    if (!options.outputDir) {
      throw new Error('outputDir is required');
    }
    logger.step('Building manager..');
    const {
      config,
      customHead,
      favicon,
      features,
      instance,
      refs,
      template,
      title,
      logLevel,
      docsOptions,
      tagsOptions,
    } = await getData();
    yield;

    const addonsDir = config.outdir;
    const coreDirTarget = join(options.outputDir, `sb-manager`);

    const compilation = await instance({
      ...config,
      minify: true,
    });

    yield;

    const managerFiles = cp(CORE_DIR_ORIGIN, coreDirTarget, {
      filter: (src) => {
        const { ext } = parse(src);
        if (ext) {
          return ext === '.js';
        }
        return true;
      },
      recursive: true,
    });
    const { cssFiles, jsFiles } = await readOrderedFiles(addonsDir, compilation?.outputFiles);

    const globals: Record<string, unknown> = await getGlobals();

    yield;

    const html = await renderHTML(
      template,
      title,
      favicon,
      customHead,
      cssFiles,
      jsFiles,
      features,
      refs,
      logLevel,
      docsOptions,
      tagsOptions,
      options,
      globals
    );

    await Promise.all([writeFile(join(options.outputDir, 'index.html'), html), managerFiles]);

    logger.trace({ message: 'Manager built', time: process.hrtime(startTime) });

    return {
      toJson: () => ({}),
    };
  }

  async function bail(): Promise<void> {
    if (asyncIterator) {
      try {
        await asyncIterator.throw(new Error());
      } catch {}
    }
  }

  async function dev(host: Parameters<ManagerHost['dev']>[0]): ReturnType<ManagerHost['dev']> {
    const iterator = starter(host);
    asyncIterator = iterator;
    let result;

    do {
      result = await iterator.next();
    } while (!result.done);

    return result.value;
  }

  async function build(
    host: Parameters<ManagerHost['build']>[0]
  ): ReturnType<ManagerHost['build']> {
    const iterator = builder(host);
    asyncIterator = iterator;
    let result;

    do {
      result = await iterator.next();
    } while (!result.done);

    return result.value;
  }

  return { dev, build, bail };
}
