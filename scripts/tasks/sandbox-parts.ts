// This file requires many imports from `../code`, which requires both an install and bootstrap of
// the repo to work properly. So we load it async in the task runner *after* those steps.
import { existsSync } from 'node:fs';
import { access, cp, lstat, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { isFunction } from 'es-toolkit/predicate';
import JSON5 from 'json5';
import { createRequire } from 'module';
import { join, relative, resolve, sep } from 'path';
import slash from 'slash';
import { dedent } from 'ts-dedent';

import { SupportedLanguage } from '../../code/core/dist/types';
import { babelParse, types as t } from '../../code/core/src/babel';
import { JsPackageManagerFactory } from '../../code/core/src/common/js-package-manager';
import storybookPackages from '../../code/core/src/common/versions';
import type { ConfigFile } from '../../code/core/src/csf-tools';
import {
  readConfig as csfReadConfig,
  formatConfig,
  writeConfig,
} from '../../code/core/src/csf-tools';
import type { TemplateKey } from '../../code/lib/cli-storybook/src/sandbox-templates';
import { ProjectTypeService } from '../../code/lib/create-storybook/src/services/ProjectTypeService';
import type { PassedOptionValues, Task, TemplateDetails } from '../task';
import { executeCLIStep, steps } from '../utils/cli-step';
import { CODE_DIRECTORY, REPROS_DIRECTORY } from '../utils/constants';
import { exec } from '../utils/exec';
import { filterExistsInCodeDir } from '../utils/filterExistsInCodeDir';
import { addPreviewAnnotations, readConfig } from '../utils/main-js';
import { updatePackageScripts } from '../utils/package-json';
import { findFirstPath } from '../utils/paths';
import { workspacePath } from '../utils/workspace';
import {
  addPackageResolutions,
  addWorkaroundResolutions,
  configureYarn2ForVerdaccio,
  installYarn2,
} from '../utils/yarn';

async function ensureSymlink(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });

  try {
    await lstat(dest);
    return;
  } catch (e: any) {
    if (e?.code !== 'ENOENT') {
      throw e;
    }
  }

  await symlink(src, dest);
}

// Windows-compatible symlink function that falls back to copying
async function ensureSymlinkOrCopy(source: string, target: string): Promise<void> {
  try {
    await ensureSymlink(source, target);
  } catch (error: any) {
    // If symlink fails (typically on Windows without admin privileges), fall back to cp
    if (error.code === 'EPERM' || error.code === 'EEXIST') {
      logger.info(`Symlink failed for ${target}, falling back to cp`);
      await cp(source, target, { recursive: true, force: true });
    } else {
      throw error;
    }
  }
}

async function readJson(path: string) {
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const logger = console;

export const essentialsAddons = [
  'actions',
  'backgrounds',
  'controls',
  'highlight',
  'measure',
  'outline',
  'toolbars',
  'viewport',
];

export const create: Task['run'] = async ({ key, template, sandboxDir }, { dryRun, debug }) => {
  const parentDir = resolve(sandboxDir, '..');
  await mkdir(parentDir, { recursive: true });

  if ('inDevelopment' in template && template.inDevelopment) {
    const srcDir = join(REPROS_DIRECTORY, key, 'after-storybook');
    if (!existsSync(srcDir)) {
      throw new Error(`Missing repro directory '${srcDir}', did the generate task run?`);
    }
    await cp(srcDir, sandboxDir, { recursive: true });
  } else {
    await executeCLIStep(steps.repro, {
      argument: key,
      optionValues: { output: sandboxDir, init: false, debug },
      cwd: parentDir,
      dryRun,
      debug,
    });
  }
};

export const install: Task['run'] = async ({ sandboxDir, key }, { link, dryRun, debug }) => {
  const cwd = sandboxDir;
  await installYarn2({ cwd, dryRun, debug });

  if (link) {
    await executeCLIStep(steps.link, {
      argument: `"${sandboxDir}"`,
      cwd: CODE_DIRECTORY,
      optionValues: { local: true, start: false },
      dryRun,
      debug,
    });
    await addWorkaroundResolutions({ cwd, dryRun, debug, key });
  } else {
    // We need to add package resolutions to ensure that we only ever install the latest version
    // of any storybook packages as verdaccio is not able to both proxy to npm and publish over
    // the top. In theory this could mask issues where different versions cause problems.
    await addPackageResolutions({ cwd, dryRun, debug });
    await configureYarn2ForVerdaccio({ cwd, dryRun, debug, key });

    // Add vite plugin workarounds for frameworks that need it
    // (to support vite 5 without peer dep errors)
    const sandboxesNeedingWorkarounds: TemplateKey[] = [
      'bench/react-vite-default-ts',
      'bench/react-vite-default-ts-nodocs',
      'bench/react-vite-default-ts-test-build',
      'react-vite/default-js',
      'react-vite/default-ts',
      'svelte-vite/default-js',
      'svelte-vite/default-ts',
      'vue3-vite/default-js',
      'vue3-vite/default-ts',
    ];
    if (sandboxesNeedingWorkarounds.includes(key) || key.includes('vite')) {
      await addWorkaroundResolutions({ cwd, dryRun, debug });
    }

    await exec(
      'yarn install',
      { cwd },
      {
        debug,
        dryRun,
        startMessage: `⬇️ Installing local dependencies`,
        errorMessage: `🚨 Installing local dependencies failed`,
      }
    );
  }
};

export const init: Task['run'] = async (
  { sandboxDir, template },
  { dryRun, debug, addon: addons, skipTemplateStories }
) => {
  const cwd = sandboxDir;

  let extra = {};

  switch (template.expected.renderer) {
    case '@storybook/html':
      extra = { type: 'html' };
      break;
    case '@storybook/server':
      extra = { type: 'server' };
      break;
    case '@storybook/svelte':
      await prepareSvelteSandbox(cwd);
      break;
  }

  switch (template.expected.framework) {
    case '@storybook/react-native-web-vite':
      extra = { type: 'react_native_web' };
      await prepareReactNativeWebSandbox(cwd);
      break;
  }

  await executeCLIStep(steps.init, {
    cwd,
    optionValues: {
      loglevel: debug ? 'debug' : 'info',
      yes: true,
      ...extra,
      ...(template.initOptions || {}),
    },
    dryRun,
    debug,
  });

  logger.info(`🔢 Adding package scripts:`);

  const nodeOptions = [
    ...(process.env.NODE_OPTIONS || '').split(' '),
    '--preserve-symlinks',
    '--preserve-symlinks-main',
  ].filter(Boolean);

  const pnp = await pathExists(join(cwd, '.pnp.cjs')).catch(() => {});
  if (pnp && !nodeOptions.find((s) => s.includes('--require'))) {
    nodeOptions.push('--require ./.pnp.cjs');
  }

  const nodeOptionsString = nodeOptions.join(' ');
  const prefix = `NODE_OPTIONS='${nodeOptionsString}' STORYBOOK_TELEMETRY_URL="http://localhost:6007/event-log"`;

  await updatePackageScripts({
    cwd,
    prefix,
  });

  switch (template.expected.framework) {
    case '@storybook/angular':
      await prepareAngularSandbox(cwd, template.name);
      break;
    default:
  }

  if (template.typeCheck) {
    await prepareTypeChecking(cwd);
  }

  if (!skipTemplateStories) {
    for (const addon of addons) {
      await executeCLIStep(steps.add, {
        argument: addon,
        cwd,
        dryRun,
        debug,
        optionValues: { yes: true },
      });
    }
  }
};

// Ensure that sandboxes can refer to story files defined in `code/`.
// Most WP-based build systems will not compile files outside of the project root or 'src/` or
// similar. Plus they aren't guaranteed to handle TS files. So we need to patch in esbuild
// loader for such files. NOTE this isn't necessary for Vite, as far as we know.
function addEsbuildLoaderToStories(mainConfig: ConfigFile) {
  // NOTE: the test regexp here will apply whether the path is symlink-preserved or otherwise
  const require = createRequire(import.meta.url);
  const esbuildLoaderPath = require.resolve('../../code/node_modules/esbuild-loader');
  const webpackFinalCode = `
  (config) => ({
    ...config,
    module: {
      ...config.module,
      rules: [
        // Ensure esbuild-loader applies to all files in ./template-stories
        {
          test: [/\\/template-stories\\//],
          exclude: [/\\.mdx$/],
          loader: '${esbuildLoaderPath}',
          options: {
            loader: 'tsx',
            target: 'es2022',
          },
        },
        // Handle MDX files per the addon-docs presets (ish)
        {
          test: /template-stories\\/.*\\.mdx$/,
          exclude: /\\.stories\\.mdx$/,
          use: [
            {
              loader: '@storybook/addon-docs/mdx-loader',
            },
          ],
        },
        // Ensure no other loaders from the framework apply
        ...config.module.rules.map(rule => ({
          ...rule,
          exclude: [/\\/template-stories\\//].concat(rule.exclude || []),
        })),
      ],
    },
  })`;
  mainConfig.setFieldNode(
    ['webpackFinal'],
    // @ts-expect-error (Property 'expression' does not exist on type 'BlockStatement')
    babelParse(webpackFinalCode).program.body[0].expression
  );
}

/*
  Recompile optimized deps on each startup, so you can change @storybook/* packages and not
  have to clear caches.
  And allow source directories to complement any existing allow patterns
  (".storybook" is already being allowed by builder-vite)
*/
function setSandboxViteFinal(mainConfig: ConfigFile, template: TemplateKey) {
  const temporaryAliasWorkaround = template.includes('nuxt')
    ? `
    // TODO: Remove this once Storybook Nuxt applies this internally
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve.alias,
        vue: 'vue/dist/vue.esm-bundler.js',
      }
    }
  `
    : '';
  const viteFinalCode = `
  (config) => ({
    ...config,
    optimizeDeps: { ...config.optimizeDeps, force: true },
    server: {
      ...config.server,
      fs: {
        ...config.server?.fs,
        allow: ['stories', 'src', 'template-stories', 'node_modules', ...(config.server?.fs?.allow || [])],
      },
    },
    ${temporaryAliasWorkaround}
  })`;
  // @ts-expect-error (Property 'expression' does not exist on type 'BlockStatement')
  mainConfig.setFieldNode(['viteFinal'], babelParse(viteFinalCode).program.body[0].expression);
}

// Update the stories field to ensure that no TS files
// that are linked from the renderer are picked up in non-TS projects
function updateStoriesField(mainConfig: ConfigFile, isJs: boolean) {
  const stories = mainConfig.getFieldValue(['stories']) as string[];

  // If the project is a JS project, let's make sure any linked in TS stories from the
  // renderer inside src|stories are simply ignored.
  // TODO: We should definitely improve the logic here, as it will break every time the stories field change format in the generated sandboxes.
  const updatedStories = isJs
    ? stories.map((specifier) => specifier.replace('|ts|tsx', ''))
    : stories;

  mainConfig.setFieldValue(['stories'], [...updatedStories]);
}

// Add a stories field entry for the passed symlink
function addStoriesEntry(mainConfig: ConfigFile, path: string, disableDocs: boolean) {
  const stories = mainConfig.getFieldValue(['stories']) as string[];

  const entry = {
    directory: slash(join('../template-stories', path)),
    titlePrefix: slash(path),
    files: disableDocs
      ? '**/*.stories.@(js|jsx|mjs|ts|tsx)'
      : '**/*.@(mdx|stories.@(js|jsx|mjs|ts|tsx))',
  };

  mainConfig.setFieldValue(['stories'], [...stories, entry]);
}

function getStoriesFolderWithVariant(variant?: string, folder = 'stories') {
  return variant ? `${folder}_${variant}` : folder;
}

// packageDir is eg 'renderers/react', 'addons/actions'
async function linkPackageStories(
  packageDir: string,
  {
    mainConfig,
    cwd,
    linkInDir,
    disableDocs,
  }: { mainConfig: ConfigFile; cwd: string; linkInDir?: string; disableDocs: boolean },
  variant?: string
) {
  const storiesFolderName = variant ? getStoriesFolderWithVariant(variant) : 'stories';
  const source = join(CODE_DIRECTORY, packageDir, 'template', storiesFolderName);
  // By default we link `stories` directories
  //   e.g '../../../code/lib/preview-api/template/stories' to 'template-stories/lib/preview-api'
  // if the directory <code>/lib/preview-api/template/stories exists
  //
  // The files must be linked in the cwd, in order to ensure that any dependencies they
  // reference are resolved in the cwd. In particular 'react' resolved by MDX files.
  const target = linkInDir
    ? resolve(linkInDir, variant ? getStoriesFolderWithVariant(variant, packageDir) : packageDir)
    : resolve(cwd, 'template-stories', packageDir);

  await ensureSymlinkOrCopy(source, target);

  if (!linkInDir) {
    addStoriesEntry(mainConfig, packageDir, disableDocs);
  }

  // Add `previewAnnotation` entries of the form
  //   './template-stories/lib/preview-api/preview.[tj]s'
  // if the file <code>/lib/preview-api/template/stories/preview.[jt]s exists
  await Promise.all(
    ['js', 'ts'].map(async (ext) => {
      const previewFile = `preview.${ext}`;
      const previewPath = join(
        CODE_DIRECTORY,
        packageDir,
        'template',
        storiesFolderName,
        previewFile
      );
      if (await pathExists(previewPath)) {
        let storiesDir = 'template-stories';
        if (linkInDir) {
          storiesDir = (await pathExists(join(cwd, 'src/stories'))) ? 'src/stories' : 'stories';
        }
        addPreviewAnnotations(mainConfig, [
          `./${join(storiesDir, variant ? `${packageDir}_${variant}` : packageDir, previewFile)}`,
        ]);
      }
    })
  );
}

export async function setupVitest(details: TemplateDetails, options: PassedOptionValues) {
  const { sandboxDir, template } = details;
  const packageJsonPath = join(sandboxDir, 'package.json');
  const packageJson = await readJson(packageJsonPath);

  packageJson.scripts = {
    ...packageJson.scripts,
    vitest: 'vitest --reporter=default --reporter=hanging-process --test-timeout=5000',
  };

  // This workaround is needed because Vitest seems to have issues in link mode
  // so the /setup-file and /global-setup files from the vitest addon won't work in portal protocol
  if (options.link) {
    const vitestAddonPath = relative(sandboxDir, join(CODE_DIRECTORY, 'addons', 'vitest'));
    packageJson.resolutions = {
      ...packageJson.resolutions,
      '@storybook/addon-vitest': `file:${vitestAddonPath}`,
    };
  }

  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

  const isVue = template.expected.renderer === '@storybook/vue3';
  // const isAngular = template.expected.framework === '@storybook/angular';

  const portableStoriesFrameworks = [
    '@storybook/nextjs-vite',
    '@storybook/sveltekit',
    // TODO: add angular once we enable their sandboxes
  ];
  const storybookPackage = portableStoriesFrameworks.includes(template.expected.framework)
    ? template.expected.framework
    : template.expected.renderer;

  const isTypeScriptSandbox = template.name.includes('TypeScript');
  const setupFilePath = join(
    sandboxDir,
    isTypeScriptSandbox ? '.storybook/vitest.setup.ts' : '.storybook/vitest.setup.js'
  );

  const shouldUseCsf4 = template.expected.framework === '@storybook/react-vite';
  if (shouldUseCsf4) {
    await writeFile(
      setupFilePath,
      dedent`import { beforeAll } from 'vitest'
      import { setProjectAnnotations } from '${storybookPackage}'
      import projectAnnotations from './preview'

      // setProjectAnnotations still kept to support non-CSF4 story tests
      setProjectAnnotations(projectAnnotations.composed)
      `
    );
  } else {
    await writeFile(
      setupFilePath,
      dedent`import { beforeAll } from 'vitest'
      import { setProjectAnnotations } from '${storybookPackage}'
      import * as rendererDocsAnnotations from '${template.expected.renderer}/entry-preview-docs'
      import * as addonA11yAnnotations from '@storybook/addon-a11y/preview'
      import '../src/stories/components'
      import * as templateAnnotations from '../template-stories/core/preview'
      import * as projectAnnotations from './preview'
      ${isVue ? 'import * as vueAnnotations from "../src/stories/renderers/vue3/preview.js"' : ''}

      setProjectAnnotations([
        ${isVue ? 'vueAnnotations,' : ''}
        rendererDocsAnnotations,
        templateAnnotations,
        addonA11yAnnotations,
        projectAnnotations,
      ])`
    );
  }

  const opts = { cwd: sandboxDir };
  const viteConfigFile = await findFirstPath(['vite.config.ts', 'vite.config.js'], opts);
  const vitestConfigFile = await findFirstPath(['vitest.config.ts', 'vitest.config.js'], opts);
  const workspaceFile = await findFirstPath(['vitest.workspace.ts', 'vitest.workspace.js'], opts);

  const configFile = workspaceFile || vitestConfigFile || viteConfigFile;
  if (!configFile) {
    throw new Error(`No Vitest or Vite config file found in sandbox: ${sandboxDir}`);
  }

  let fileContent = await readFile(join(sandboxDir, configFile), 'utf-8');
  // Insert resolve: { preserveSymlinks: true } as a sibling to plugins in the top-level config object
  // Handles both defineConfig({ ... }) and defineWorkspace([ ... , { ... }])
  fileContent = fileContent.replace(/(plugins\s*:\s*\[[^\]]*\],?)/, (match) => {
    // Insert resolve after plugins
    return `${match}\n  resolve: {\n    preserveSymlinks: true\n  },`;
  });
  // search for storybookTest({...}) and place `tags: 'vitest'` into it but tags option doesn't exist yet in the config. Also consider multi line
  const storybookTestRegex = /storybookTest\((\{[\s\S]*?\})\)/g;
  fileContent = fileContent.replace(storybookTestRegex, (match, args) => {
    // Add tags as the last property before the closing }
    const lastBraceIndex = args.lastIndexOf('}');
    if (lastBraceIndex !== -1) {
      // Insert before the last }
      const before = args.slice(0, lastBraceIndex).trimEnd();
      const needsComma = before.endsWith('{') ? '' : ',';
      const after = args.slice(lastBraceIndex);
      return `storybookTest(${before}${needsComma}\n  tags: {\n    include: ['vitest']\n  }\n${after})`;
    }
    // If tags exists and is not empty, or any other case, return as is
    return match;
  });

  await writeFile(join(sandboxDir, configFile), fileContent);
  // Only run story tests which are tagged with 'vitest'
  const previewConfig = await readConfig({ cwd: sandboxDir, fileName: 'preview' });
  previewConfig.setFieldValue(['tags'], ['vitest']);
  await writeConfig(previewConfig);
}

export async function addExtraDependencies({
  cwd,
  dryRun,
  debug,
  extraDeps,
}: {
  cwd: string;
  dryRun: boolean;
  debug: boolean;
  extraDeps?: string[];
}) {
  const extraDevDeps = ['@storybook/test-runner@latest'];

  if (debug) {
    logger.log('\uD83C\uDF81 Adding extra dev deps', extraDevDeps);
  }

  if (dryRun) {
    return;
  }

  const packageManager = JsPackageManagerFactory.getPackageManager({}, cwd);

  await packageManager.addDependencies(
    { type: 'devDependencies', skipInstall: true },
    extraDevDeps
  );

  if (extraDeps) {
    const versionedExtraDeps = await packageManager.getVersionedPackages(extraDeps);
    if (debug) {
      logger.log('\uD83C\uDF81 Adding extra deps', versionedExtraDeps);
    }
    await packageManager.addDependencies(
      { type: 'devDependencies', skipInstall: true },
      versionedExtraDeps
    );
  }
}

export const addGlobalMocks: Task['run'] = async ({ sandboxDir }) => {
  await cp(join(CODE_DIRECTORY, 'core', 'template', '__mocks__'), join(sandboxDir, '__mocks__'), {
    recursive: true,
  });
};

export const addStories: Task['run'] = async (
  { sandboxDir, template, key },
  { addon: extraAddons, disableDocs }
) => {
  logger.log('💃 Adding stories');
  const cwd = sandboxDir;
  const storiesPath =
    (await findFirstPath([join('src', 'stories'), 'stories'], { cwd })) || 'stories';

  const mainConfig = await readConfig({ fileName: 'main', cwd });
  const packageManager = JsPackageManagerFactory.getPackageManager({}, sandboxDir);

  // Package manager types differ slightly due to private methods and compilation differences of types
  const projectTypeService = new ProjectTypeService(packageManager as any);

  // Ensure that we match the right stories in the stories directory
  updateStoriesField(
    mainConfig,
    (await projectTypeService.detectLanguage()) === SupportedLanguage.JAVASCRIPT
  );

  const isCoreRenderer =
    template.expected.renderer.startsWith('@storybook/') &&
    template.expected.renderer !== '@storybook/server';

  const sandboxSpecificStoriesFolder = key.replaceAll('/', '-');
  const storiesVariantFolder = getStoriesFolderWithVariant(sandboxSpecificStoriesFolder);

  if (isCoreRenderer) {
    // Link in the template/components/index.js from preview-api, the renderer and the addons
    const rendererPath = await workspacePath('renderer', template.expected.renderer);
    await ensureSymlinkOrCopy(
      join(CODE_DIRECTORY, rendererPath, 'template', 'components'),
      resolve(cwd, storiesPath, 'components')
    );
    addPreviewAnnotations(mainConfig, [`.${sep}${join(storiesPath, 'components')}`]);

    // Add stories for the renderer. NOTE: these *do* need to be processed by the framework build system
    await linkPackageStories(rendererPath, {
      mainConfig,
      cwd,
      linkInDir: resolve(cwd, storiesPath),
      disableDocs,
    });

    if (
      await pathExists(
        resolve(CODE_DIRECTORY, rendererPath, join('template', storiesVariantFolder))
      )
    ) {
      await linkPackageStories(
        rendererPath,
        {
          mainConfig,
          cwd,
          linkInDir: resolve(cwd, storiesPath),
          disableDocs,
        },
        sandboxSpecificStoriesFolder
      );
    }
  }

  const isCoreFramework = template.expected.framework.startsWith('@storybook/');

  if (isCoreFramework) {
    const frameworkPath = await workspacePath('frameworks', template.expected.framework);

    // Add stories for the framework if it has one. NOTE: these *do* need to be processed by the framework build system
    if (await pathExists(resolve(CODE_DIRECTORY, frameworkPath, join('template', 'stories')))) {
      await linkPackageStories(frameworkPath, {
        mainConfig,
        cwd,
        linkInDir: resolve(cwd, storiesPath),
        disableDocs,
      });
    }

    if (
      await pathExists(
        resolve(CODE_DIRECTORY, frameworkPath, join('template', storiesVariantFolder))
      )
    ) {
      await linkPackageStories(
        frameworkPath,
        {
          mainConfig,
          cwd,
          linkInDir: resolve(cwd, storiesPath),
          disableDocs,
        },
        sandboxSpecificStoriesFolder
      );
    }
  }

  if (isCoreRenderer) {
    // Add stories for lib/preview-api (and addons below). NOTE: these stories will be in the
    // template-stories folder and *not* processed by the framework build config (instead by esbuild-loader)
    await linkPackageStories(await workspacePath('core package', 'storybook'), {
      mainConfig,
      cwd,
      disableDocs,
    });

    await linkPackageStories(await workspacePath('addon test package', '@storybook/addon-vitest'), {
      mainConfig,
      cwd,
      disableDocs,
    });
  }

  const mainAddons = (mainConfig.getSafeFieldValue(['addons']) || []).reduce(
    (acc: string[], addon: any) => {
      const name = typeof addon === 'string' ? addon : addon.name;
      const match = /@storybook\/addon-(.*)/.exec(name);

      if (!match) {
        return acc;
      }
      const suffix = match[1];
      if (suffix === 'essentials') {
        const essentials = disableDocs
          ? essentialsAddons.filter((a) => a !== 'docs')
          : essentialsAddons;
        return [...acc, ...essentials];
      }
      return [...acc, suffix];
    },
    []
  );

  const addonDirs = await Promise.all(
    [...mainAddons, ...extraAddons]
      // only include addons that are in the monorepo
      .filter((addon: string) =>
        Object.keys(storybookPackages).find((pkg: string) => pkg === `@storybook/addon-${addon}`)
      )
      .map(async (addon) => workspacePath('addon', `@storybook/addon-${addon}`))
  );

  if (isCoreRenderer) {
    const existingStories = await filterExistsInCodeDir(addonDirs, join('template', 'stories'));
    for (const packageDir of existingStories) {
      await linkPackageStories(packageDir, { mainConfig, cwd, disableDocs });
    }

    // Add some extra settings (see above for what these do)
    if (template.expected.builder === '@storybook/builder-webpack5') {
      addEsbuildLoaderToStories(mainConfig);
    }
  }

  await writeConfig(mainConfig);
};

export const extendMain: Task['run'] = async ({ template, sandboxDir, key }, { disableDocs }) => {
  logger.log('📝 Extending main.js');
  const mainConfig = await readConfig({ fileName: 'main', cwd: sandboxDir });

  const templateConfig: any = isFunction(template.modifications?.mainConfig)
    ? template.modifications?.mainConfig(mainConfig)
    : template.modifications?.mainConfig || {};
  const configToAdd = {
    ...templateConfig,
    features: {
      ...templateConfig.features,
    },
    ...(template.modifications?.editAddons
      ? {
          addons: template.modifications?.editAddons(mainConfig.getFieldValue(['addons']) || []),
        }
      : {}),
    core: {
      ...templateConfig.core,
      // We don't want to show the "What's new" notifications in the sandbox as it can affect E2E tests
      disableWhatsNewNotifications: true,
    },
  };

  Object.entries(configToAdd).forEach(([field, value]) => mainConfig.setFieldValue([field], value));

  const previewHeadCode = `
    (head) => \`
      \${head}
      ${templateConfig.previewHead || ''}
      <style>
        /* explicitly set monospace font stack to workaround inconsistent fonts in Chromatic */
        pre, code, kbd, samp {
          font-family:
            ui-monospace,
            Menlo,
            Monaco,
            "Cascadia Mono",
            "Segoe UI Mono",
            "Roboto Mono",
            "Oxygen Mono",
            "Ubuntu Monospace",
            "Source Code Pro",
            "Fira Mono",
            "Droid Sans Mono",
            "Courier New",
            monospace;
        }
      </style>
    \``;
  // @ts-expect-error (Property 'expression' does not exist on type 'BlockStatement')
  mainConfig.setFieldNode(['previewHead'], babelParse(previewHeadCode).program.body[0].expression);

  // Simulate Storybook Lite
  if (disableDocs) {
    const addons = mainConfig.getFieldValue(['addons']);
    const addonsNoDocs = addons.filter((addon: any) => addon !== '@storybook/addon-docs');
    mainConfig.setFieldValue(['addons'], addonsNoDocs);

    // remove the docs options so that docs tags are ignored
    mainConfig.setFieldValue(['docs'], {});
    mainConfig.setFieldValue(['typescript'], { reactDocgen: false });

    let updatedStories = mainConfig.getFieldValue(['stories']) as string[];
    updatedStories = updatedStories.filter((specifier) => !specifier.endsWith('.mdx'));
    mainConfig.setFieldValue(['stories'], updatedStories);
  }

  if (template.expected.builder === '@storybook/builder-vite') {
    setSandboxViteFinal(mainConfig, key);
  }
  await writeConfig(mainConfig);
};

export const extendPreview: Task['run'] = async ({ template, sandboxDir }) => {
  logger.log('📝 Extending preview.js');
  const previewConfig = await readConfig({ cwd: sandboxDir, fileName: 'preview' });

  if (template.modifications?.useCsfFactory) {
    const storiesDir = (await pathExists(join(sandboxDir, 'src/stories')))
      ? '../src/stories/components'
      : '../stories/components';
    previewConfig.setImport(null, storiesDir);
    previewConfig.setImport(
      { namespace: 'templateAnnotations' },
      '../template-stories/core/preview'
    );
    previewConfig.appendNodeToArray(['addons'], t.identifier('templateAnnotations'));
  }

  if (template.expected.builder.includes('vite')) {
    previewConfig.setFieldValue(['tags'], ['vitest']);
  }

  if (template.name.includes('Bench')) {
    await writeConfig(previewConfig);
    return;
  }

  previewConfig.setImport(['sb'], 'storybook/test');
  let config = formatConfig(previewConfig);

  const mockBlock = [
    "sb.mock('../template-stories/core/test/ModuleMocking.utils.ts');",
    "sb.mock('../template-stories/core/test/ModuleSpyMocking.utils.ts', { spy: true });",
    "sb.mock('../template-stories/core/test/ModuleAutoMocking.utils.ts');",
    "sb.mock(import('lodash-es'));",
    "sb.mock(import('lodash-es/add'));",
    "sb.mock(import('lodash-es/sum'));",
    "sb.mock(import('uuid'));",
    '',
  ].join('\n');

  // find last import statement and append sb.mock calls
  config = config.replace(
    'import { sb } from "storybook/test";',
    `import { sb } from 'storybook/test';\n\n${mockBlock}`
  );

  await writeFile(previewConfig.fileName, config);
};

export const runMigrations: Task['run'] = async ({ sandboxDir, template }, { dryRun, debug }) => {
  if (template.modifications?.useCsfFactory) {
    await executeCLIStep(steps.automigrate, {
      cwd: sandboxDir,
      argument: 'csf-factories',
      dryRun,
      debug,
      env: {
        STORYBOOK_PROJECT_ROOT: sandboxDir,
      },
    });
  }
};

export async function setImportMap(cwd: string) {
  const packageJson = await readJson(join(cwd, 'package.json'));

  packageJson.imports = {
    '#utils': {
      storybook: './template-stories/core/utils.mock.ts',
      default: './template-stories/core/utils.ts',
    },
  };

  await writeFile(join(cwd, 'package.json'), JSON.stringify(packageJson, null, 2));
}

async function prepareReactNativeWebSandbox(cwd: string) {
  // Make it so that RN sandboxes have stories in src/stories similar to
  // other react sandboxes, for consistency.
  if (!(await pathExists(join(cwd, 'src')))) {
    await mkdir(join(cwd, 'src'));
  }
}

async function prepareSvelteSandbox(cwd: string) {
  const svelteConfigJsPath = join(cwd, 'svelte.config.js');
  const svelteConfigTsPath = join(cwd, 'svelte.config.ts');

  // Check which config file exists
  const configPath = (await pathExists(svelteConfigTsPath))
    ? svelteConfigTsPath
    : (await pathExists(svelteConfigJsPath))
      ? svelteConfigJsPath
      : null;

  if (!configPath) {
    throw new Error(
      `No svelte.config.js or svelte.config.ts found in sandbox: ${cwd}, cannot modify config.`
    );
  }

  const svelteConfig = await csfReadConfig(configPath);

  // Enable async components
  // see https://svelte.dev/docs/svelte/await-expressions
  svelteConfig.setFieldValue(['compilerOptions', 'experimental', 'async'], true);

  // Enable remote functions
  // see https://svelte.dev/docs/kit/remote-functions
  svelteConfig.setFieldValue(['kit', 'experimental', 'remoteFunctions'], true);

  await writeConfig(svelteConfig);
}

/**
 * Prepare a sandbox for typechecking.
 *
 * 1. Add a typecheck script
 * 2. Ensure typescript compiler options compatible with our example code
 * 3. Set skipLibCheck to false to test storybook's public types
 *
 * This is currently configured for manipulating the output of `create vite` so will need some
 * adjustment when we extend to type checking webpack sandboxes (if we ever do).
 */
async function prepareTypeChecking(cwd: string) {
  const packageJsonPath = join(cwd, 'package.json');
  const packageJson = await readJson(packageJsonPath);

  packageJson.scripts = {
    ...packageJson.scripts,
    typecheck: 'yarn tsc -p tsconfig.app.json',
  };
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

  const tsConfigPath = join(cwd, 'tsconfig.app.json');
  const tsConfigContent = await readFile(tsConfigPath, { encoding: 'utf-8' });
  // This does not preserve comments, but that shouldn't be an issue for sandboxes
  const tsConfigJson = JSON5.parse(tsConfigContent);

  // We use enums
  tsConfigJson.compilerOptions.erasableSyntaxOnly = false;
  // Lots of unnecessary imports of react that need fixing
  tsConfigJson.compilerOptions.noUnusedLocals = false;
  // This is much better done by eslint
  tsConfigJson.compilerOptions.noUnusedParameters = false;
  // Means we can check our own public types
  tsConfigJson.compilerOptions.skipLibCheck = false;
  // Add chai global types
  (tsConfigJson.compilerOptions.types ??= []).push('chai');
  await writeFile(tsConfigPath, JSON.stringify(tsConfigJson, null, 2));
}

async function prepareAngularSandbox(cwd: string, templateName: string) {
  const angularJson = await readJson(join(cwd, 'angular.json'));

  Object.keys(angularJson.projects).forEach((projectName: string) => {
    /**
     * Sets compodoc option in angular.json projects to false. We have to generate compodoc manually
     * to avoid symlink issues related to the template-stories folder. In a second step a docs:json
     * script is placed into the package.json to generate the Compodoc documentation.json, which
     * respects symlinks
     */
    angularJson.projects[projectName].architect.storybook.options.compodoc = false;
    angularJson.projects[projectName].architect['build-storybook'].options.compodoc = false;
    /**
     * Sets preserveSymlinks option in angular.json projects to true. This is necessary to respect
     * symlinks so that Angular doesn't complain about wrong types in @storybook/* packages
     */
    angularJson.projects[projectName].architect.storybook.options.preserveSymlinks = true;
    angularJson.projects[projectName].architect['build-storybook'].options.preserveSymlinks = true;
  });

  await writeFile(join(cwd, 'angular.json'), JSON.stringify(angularJson, null, 2));

  const packageJsonPath = join(cwd, 'package.json');
  const packageJson = await readJson(packageJsonPath);

  packageJson.scripts = {
    ...packageJson.scripts,
    'docs:json': 'DIR=$PWD; yarn --cwd ../../scripts jiti combine-compodoc $DIR',
    storybook: `yarn docs:json && ${packageJson.scripts.storybook}`,
    'build-storybook': `yarn docs:json && ${packageJson.scripts['build-storybook']}`,
  };

  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Set tsConfig compilerOptions

  const tsConfigPath = join(cwd, '.storybook', 'tsconfig.json');
  const tsConfigContent = await readFile(tsConfigPath, { encoding: 'utf-8' });
  // This does not preserve comments, but that shouldn't be an issue for sandboxes
  const tsConfigJson = JSON5.parse(tsConfigContent);

  tsConfigJson.compilerOptions.noImplicitOverride = false;
  tsConfigJson.compilerOptions.noPropertyAccessFromIndexSignature = false;
  tsConfigJson.compilerOptions.jsx = 'react';
  tsConfigJson.compilerOptions.skipLibCheck = true;
  tsConfigJson.compilerOptions.noImplicitAny = false;
  tsConfigJson.compilerOptions.strict = false;
  tsConfigJson.include = [
    ...tsConfigJson.include,
    '../template-stories/**/*.stories.ts',
    // This is necessary since template stories depend on globalThis.__TEMPLATE_COMPONENTS__, which Typescript can't look up automatically
    '../src/stories/**/*',
  ];

  if (templateName === 'Angular CLI (Version 15)') {
    tsConfigJson.compilerOptions.paths = {
      '@angular-devkit/*': ['node_modules/@angular-devkit/*'],
    };
  }

  await writeFile(tsConfigPath, JSON.stringify(tsConfigJson, null, 2));
}
