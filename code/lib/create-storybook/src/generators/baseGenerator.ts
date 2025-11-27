import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type NpmOptions,
  configureEslintPlugin,
  copyTemplateFiles,
  extractEslintInfo,
} from 'storybook/internal/cli';
import {
  type JsPackageManager,
  frameworkPackages,
  getPackageDetails,
  isCI,
  optionalEnvToBoolean,
} from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';
import { SupportedFramework, SupportedLanguage } from 'storybook/internal/types';

import invariant from 'tiny-invariant';
import { dedent } from 'ts-dedent';

import { AddonService } from '../services';
import { configureMain, configurePreview } from './configure';
import type { FrameworkOptions, GeneratorOptions } from './types';

const defaultOptions = {
  extraPackages: [],
  extraAddons: [],
  staticDir: undefined,
  addScripts: true,
  addComponents: true,
  webpackCompiler: () => undefined,
  extraMain: undefined,
  extensions: undefined,
  componentsDestinationPath: undefined,
  storybookConfigFolder: '.storybook',
  installFrameworkPackages: true,
} satisfies FrameworkOptions;

const getPackageByValue = (
  type: 'framework' | 'renderer' | 'builder',
  value: string,
  packages: Record<string, string>
) => {
  const foundPackage = value
    ? Object.entries(packages).find(([key, pkgValue]) => pkgValue === value)?.[0]
    : undefined;

  if (foundPackage) {
    return foundPackage;
  }

  throw new Error(
    dedent`
      Could not find ${type} package for ${value}.
      Make sure this package exists, and if it does, please file an issue as this might be a bug in Storybook.
    `
  );
};

const applyGetAbsolutePathWrapper = (packageName: string) =>
  `%%getAbsolutePath('${packageName}')%%`;

const applyAddonGetAbsolutePathWrapper = (pkg: string | { name: string }) => {
  if (typeof pkg === 'string') {
    return applyGetAbsolutePathWrapper(pkg);
  }
  const obj = { ...pkg } as { name: string };
  obj.name = applyGetAbsolutePathWrapper(pkg.name);
  return obj;
};

const getFrameworkDetails = ({
  framework,
  shouldApplyRequireWrapperOnPackageNames,
}: {
  framework: SupportedFramework;
  shouldApplyRequireWrapperOnPackageNames?: boolean;
}): {
  frameworkPackage: string;
  frameworkPackagePath: string;
} => {
  const frameworkPackage = getPackageByValue('framework', framework, frameworkPackages);

  const frameworkPackagePath = shouldApplyRequireWrapperOnPackageNames
    ? applyGetAbsolutePathWrapper(frameworkPackage)
    : frameworkPackage;

  return {
    frameworkPackage,
    frameworkPackagePath,
  };
};

const hasFrameworkTemplates = (framework?: string) => {
  if (!framework) {
    return false;
  }
  // Nuxt has framework templates, but for sandboxes we create them from the Vue3 renderer
  // As the Nuxt framework templates are not compatible with the stories we need for CI.
  // See: https://github.com/storybookjs/storybook/pull/28607#issuecomment-2467903327
  if (framework === 'nuxt') {
    return !optionalEnvToBoolean(process.env.IN_STORYBOOK_SANDBOX);
  }

  const frameworksWithTemplates: SupportedFramework[] = [
    SupportedFramework.ANGULAR,
    SupportedFramework.EMBER,
    SupportedFramework.HTML_VITE,
    SupportedFramework.NEXTJS,
    SupportedFramework.NEXTJS_VITE,
    SupportedFramework.PREACT_VITE,
    SupportedFramework.REACT_NATIVE_WEB_VITE,
    SupportedFramework.REACT_VITE,
    SupportedFramework.REACT_WEBPACK5,
    SupportedFramework.SERVER_WEBPACK5,
    SupportedFramework.SVELTE_VITE,
    SupportedFramework.SVELTEKIT,
    SupportedFramework.VUE3_VITE,
    SupportedFramework.WEB_COMPONENTS_VITE,
  ];

  return frameworksWithTemplates.includes(framework as SupportedFramework);
};

export async function baseGenerator(
  packageManager: JsPackageManager,
  npmOptions: NpmOptions,
  { language, builder, framework, renderer, pnp, features, dependencyCollector }: GeneratorOptions,
  _options: FrameworkOptions
) {
  const options = { ...defaultOptions, ..._options };
  const isStorybookInMonorepository = packageManager.isStorybookInMonorepo();
  const shouldApplyRequireWrapperOnPackageNames = isStorybookInMonorepository || pnp;

  const taskLog = prompt.taskLog({
    id: 'base-generator',
    title: 'Generating Storybook configuration',
  });

  const { frameworkPackagePath, frameworkPackage } = getFrameworkDetails({
    framework,
    shouldApplyRequireWrapperOnPackageNames,
  });

  const {
    extraAddons = [],
    extraPackages,
    staticDir,
    addScripts,
    addComponents,
    extraMain,
    extensions,
    storybookConfigFolder,
    componentsDestinationPath,
    webpackCompiler,
    installFrameworkPackages,
  } = {
    ...defaultOptions,
    ...options,
  };

  // Configure addons using AddonManager
  const addonManager = new AddonService();
  const { addonsForMain: addons, addonPackages } = addonManager.configureAddons(
    features,
    extraAddons,
    builder,
    webpackCompiler
  );

  const { packageJson } = packageManager.primaryPackageJson;

  const installedDependencies = new Set(
    Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies })
  );

  const extraPackagesToInstall =
    typeof extraPackages === 'function'
      ? await extraPackages({
          builder,
        })
      : extraPackages;

  const allPackages = [
    'storybook',
    ...(installFrameworkPackages ? [frameworkPackage] : []),
    ...addonPackages,
    ...(extraPackagesToInstall || []),
  ].filter(Boolean);

  const packagesToInstall = [...new Set(allPackages)].filter(
    (packageToInstall) =>
      !installedDependencies.has(getPackageDetails(packageToInstall as string)[0])
  );

  let eslintPluginPackage: string | null = null;
  try {
    if (!isCI()) {
      const { hasEslint, isStorybookPluginInstalled, isFlatConfig, eslintConfigFile } =
        // TODO: Investigate why packageManager type does not match on CI
        await extractEslintInfo(packageManager as any);

      if (hasEslint && !isStorybookPluginInstalled) {
        eslintPluginPackage = 'eslint-plugin-storybook';
        packagesToInstall.push(eslintPluginPackage);
        taskLog.message(`- Configuring ESLint plugin`);
        await configureEslintPlugin({
          eslintConfigFile,
          // TODO: Investigate why packageManager type does not match on CI
          packageManager: packageManager as any,
          isFlatConfig,
        });
      }
    }
  } catch (err) {
    // any failure regarding configuring the eslint plugin should not fail the whole generator
  }

  const versionedPackages = await packageManager.getVersionedPackages(
    packagesToInstall as string[]
  );

  if (versionedPackages.length > 0) {
    // When using the dependency collector, just collect the packages
    if (npmOptions.type === 'devDependencies') {
      dependencyCollector.addDevDependencies(versionedPackages);
    } else {
      dependencyCollector.addDependencies(versionedPackages);
    }
  }

  await mkdir(`./${storybookConfigFolder}`, { recursive: true });

  // TODO: Evaluate if this is correct after removing pnp compatibility code in SB11
  const prefixes = shouldApplyRequireWrapperOnPackageNames
    ? [
        'import { dirname } from "path"',
        'import { fileURLToPath } from "url"',
        language === SupportedLanguage.JAVASCRIPT
          ? dedent`/**
            * This function is used to resolve the absolute path of a package.
            * It is needed in projects that use Yarn PnP or are set up within a monorepo.
            */
            function getAbsolutePath(value) {
              return dirname(fileURLToPath(import.meta.resolve(\`\${value}/package.json\`)))
            }`
          : dedent`/**
          * This function is used to resolve the absolute path of a package.
          * It is needed in projects that use Yarn PnP or are set up within a monorepo.
          */
          function getAbsolutePath(value: string): any {
            return dirname(fileURLToPath(import.meta.resolve(\`\${value}/package.json\`)))
          }`,
      ]
    : [];

  const configurationFileExtension = language === SupportedLanguage.TYPESCRIPT ? 'ts' : 'js';

  taskLog.message(`- Configuring main.${configurationFileExtension}`);
  await configureMain({
    framework: frameworkPackagePath,
    features,
    frameworkPackage,
    prefixes,
    storybookConfigFolder,
    addons: shouldApplyRequireWrapperOnPackageNames
      ? addons.map((addon) => applyAddonGetAbsolutePathWrapper(addon))
      : addons,
    extensions,
    language,
    ...(staticDir ? { staticDirs: [join('..', staticDir)] } : null),
    ...extraMain,
  });

  taskLog.message(`- Configuring preview.${configurationFileExtension}`);

  await configurePreview({
    frameworkPreviewParts: _options.frameworkPreviewParts,
    storybookConfigFolder: storybookConfigFolder as string,
    language,
    frameworkPackage,
  });

  if (addScripts) {
    taskLog.message(`- Adding Storybook command to package.json`);
    packageManager.addStorybookCommandInScripts({
      port: 6006,
    });
  }

  if (addComponents) {
    const templateLocation = hasFrameworkTemplates(framework) ? framework : renderer;
    invariant(templateLocation, `Could not find template location for ${framework} or ${renderer}`);

    taskLog.message(`- Copying framework templates`);

    await copyTemplateFiles({
      templateLocation,
      packageManager: packageManager as any,
      language,
      destination: componentsDestinationPath,
      commonAssetsDir: join(
        dirname(fileURLToPath(import.meta.resolve('create-storybook/package.json'))),
        'rendererAssets',
        'common'
      ),
      features,
    });
  }

  taskLog.success('Storybook configuration generated', { showLog: true });

  return {
    configDir: storybookConfigFolder,
    storybookCommand: _options.storybookCommand,
    shouldRunDev: _options.shouldRunDev,
  };
}
