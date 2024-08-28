import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import * as path from 'node:path';

import {
  JsPackageManagerFactory,
  extractProperFrameworkName,
  loadAllPresets,
  loadMainConfig,
  validateFrameworkName,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { findUp } from 'find-up';
import c from 'tinyrainbow';
import dedent from 'ts-dedent';

import { type PostinstallOptions } from '../../../lib/cli-storybook/src/add';

const extensions = ['.js', '.jsx', '.ts', '.tsx', '.cts', '.mts', '.cjs', '.mjs'];

export default async function postInstall(options: PostinstallOptions) {
  const packageManager = JsPackageManagerFactory.getPackageManager({
    force: options.packageManager,
  });

  const info = await getFrameworkInfo(options);

  if (
    info.frameworkPackageName !== '@storybook/nextjs' &&
    info.builderPackageName !== '@storybook/builder-vite'
  ) {
    logger.info(
      'The Vitest addon can only be used with a Vite-based Storybook framework or Next.js.'
    );
    return;
  }

  const annotationsImport = [
    '@storybook/nextjs',
    '@storybook/experimental-nextjs-vite',
    '@storybook/sveltekit',
  ].includes(info.frameworkPackageName)
    ? info.frameworkPackageName
    : info.rendererPackageName &&
        ['@storybook/react', '@storybook/svelte', '@storybook/vue3'].includes(
          info.rendererPackageName
        )
      ? info.rendererPackageName
      : null;

  if (!annotationsImport) {
    logger.info('The Vitest addon cannot yet be used with: ' + info.frameworkPackageName);
    return;
  }

  const vitestInfo = getVitestPluginInfo(info.frameworkPackageName);

  const packages = ['vitest@latest', '@vitest/browser@latest', 'playwright@latest'];

  if (info.frameworkPackageName === '@storybook/nextjs') {
    logger.info(
      dedent`
        We detected that you're using Next.js.
        We will configure the vite-plugin-storybook-nextjs plugin to allow you to run tests in Vitest.
      `
    );
    packages.push('vite-plugin-storybook-nextjs@latest');
  }

  logger.info(c.bold('Installing packages...'));
  logger.info(packages.join(', '));
  await packageManager.addDependencies({ installAsDevDependencies: true }, packages);

  logger.info(c.bold('Executing npx playwright install chromium --with-deps ...'));
  await packageManager.executeCommand({
    command: 'npx',
    args: ['playwright', 'install', 'chromium', '--with-deps'],
  });

  logger.info(c.bold('Writing .storybook/vitest.setup.ts file...'));

  const previewExists = extensions
    .map((ext) => path.resolve(options.configDir, `preview${ext}`))
    .some((config) => existsSync(config));

  await writeFile(
    resolve(options.configDir, 'vitest.setup.ts'),
    dedent`
      import { beforeAll } from 'vitest'
      import { setProjectAnnotations } from '${annotationsImport}'
      ${previewExists ? `import * as projectAnnotations from './preview'` : ''}

      const project = setProjectAnnotations(${previewExists ? 'projectAnnotations' : '[]'})

      beforeAll(project.beforeAll)
    `
  );

  // Check for an existing config file. Can be from Vitest (preferred) or Vite (with `test` option).
  const viteConfigFiles = extensions.map((ext) => 'vite.config' + ext);
  const viteConfig = await findUp(viteConfigFiles, { cwd: process.cwd() });
  const vitestConfigFiles = extensions.map((ext) => 'vitest.config' + ext);
  const rootConfig = (await findUp(vitestConfigFiles, { cwd: process.cwd() })) || viteConfig;

  if (rootConfig) {
    // If there's an existing config, we create a workspace file so we can run Storybook tests alongside.
    const extname = path.extname(rootConfig);
    const browserWorkspaceFile = resolve(dirname(rootConfig), `vitest.workspace${extname}`);
    if (existsSync(browserWorkspaceFile)) {
      logger.info(
        dedent`
          We can not automatically setup the plugin when you use Vitest with workspaces.
          Please refer to the documentation to complete the setup manually:
          https://storybook.js.org/docs/writing-tests/test-runner-with-vitest#manual
        `
      );
    } else {
      logger.info(c.bold('Writing vitest.workspace.ts file...'));
      await writeFile(
        browserWorkspaceFile,
        dedent`
          import { defineWorkspace } from 'vitest/config';
          import { storybookTest } from '@storybook/experimental-addon-vitest/plugin';
          ${vitestInfo.frameworkPluginImport ? vitestInfo.frameworkPluginImport + '\n' : ''}
          export default defineWorkspace([
            '${relative(dirname(browserWorkspaceFile), rootConfig)}',
            {
              extends: '${viteConfig ? relative(dirname(browserWorkspaceFile), viteConfig) : ''}',
              plugins: [
                storybookTest(),${vitestInfo.frameworkPluginCall ? '\n' + vitestInfo.frameworkPluginCall : ''}
              ],
              test: {
                browser: {
                  enabled: true,
                  headless: true,
                  name: 'chromium',
                  provider: 'playwright',
                },
                include: ['**/*.stories.?(m)[jt]s?(x)'],
                setupFiles: ['./.storybook/vitest.setup.ts'],
              },
            },
          ]);
        `.replace(/\s+extends: '',/, '')
      );
    }
  } else {
    // If there's no existing Vitest/Vite config, we create a new Vitest config file.
    logger.info(c.bold('Writing vitest.config.ts file...'));
    await writeFile(
      resolve('vitest.config.ts'),
      dedent`
        import { defineConfig } from "vitest/config";
        import { storybookTest } from "@storybook/experimental-addon-vitest/plugin";
        ${vitestInfo.frameworkPluginImport ? vitestInfo.frameworkPluginImport + '\n' : ''}
        export default defineConfig({
          plugins: [
            storybookTest(),${vitestInfo.frameworkPluginCall ? '\n' + vitestInfo.frameworkPluginCall : ''}
          ],
          test: {
            browser: {
              enabled: true,
              headless: true,
              name: 'chromium',
              provider: 'playwright',
            },
            include: ['**/*.stories.?(m)[jt]s?(x)'],
            setupFiles: ['./.storybook/vitest.setup.ts'],
          },
        });
      `
    );
  }

  logger.info(
    dedent`
      The Vitest addon is now configured and you're ready to run your tests!
      Check the documentation for more information about its features and options at:
      https://storybook.js.org/docs/writing-tests/test-runner-with-vitest
    `
  );
}

const getVitestPluginInfo = (framework: string) => {
  let frameworkPluginImport = '';
  let frameworkPluginCall = '';

  if (framework === '@storybook/nextjs') {
    frameworkPluginImport = "import vitePluginNext from 'vite-plugin-storybook-nextjs'";
    frameworkPluginCall = 'vitePluginNext()';
  }

  if (framework === '@storybook/sveltekit') {
    frameworkPluginImport = "import { storybookSveltekitPlugin } from '@storybook/sveltekit/vite'";
    frameworkPluginCall = 'storybookSveltekitPlugin()';
  }

  return { frameworkPluginImport, frameworkPluginCall };
};

async function getFrameworkInfo({ configDir, packageManager: pkgMgr }: PostinstallOptions) {
  const packageManager = JsPackageManagerFactory.getPackageManager({ force: pkgMgr });
  const packageJson = await packageManager.retrievePackageJson();

  const config = await loadMainConfig({ configDir, noCache: true });
  const { framework } = config;

  const frameworkName = typeof framework === 'string' ? framework : framework?.name;
  validateFrameworkName(frameworkName);
  const frameworkPackageName = extractProperFrameworkName(frameworkName);

  const presets = await loadAllPresets({
    corePresets: [join(frameworkName, 'preset')],
    overridePresets: [
      require.resolve('@storybook/core/core-server/presets/common-override-preset'),
    ],
    configDir,
    packageJson,
    isCritical: true,
  });

  const core = await presets.apply('core', {});

  const { builder, renderer } = core;

  if (!builder) {
    throw new Error('Could not detect your Storybook builder.');
  }

  const builderPackageJson = await fs.readFile(
    `${typeof builder === 'string' ? builder : builder.name}/package.json`,
    'utf8'
  );
  const builderPackageName = JSON.parse(builderPackageJson).name;

  let rendererPackageName: string | undefined;
  if (renderer) {
    const rendererPackageJson = await fs.readFile(`${renderer}/package.json`, 'utf8');
    rendererPackageName = JSON.parse(rendererPackageJson).name;
  }

  return {
    frameworkPackageName,
    builderPackageName,
    rendererPackageName,
  };
}
