import path from 'path';
import fse from 'fs-extra';
import { dedent } from 'ts-dedent';
import ora from 'ora';
import type { NpmOptions } from '../NpmOptions';
import type { SupportedRenderers, SupportedFrameworks, Builder } from '../project_types';
import { SupportedLanguage, externalFrameworks, CoreBuilder } from '../project_types';
import { copyTemplateFiles } from '../helpers';
import { configureMain, configurePreview } from './configure';
import type { JsPackageManager } from '../js-package-manager';
import { getPackageDetails } from '../js-package-manager';
import { getBabelPresets, writeBabelConfigFile } from '../babel-config';
import packageVersions from '../versions';
import type { FrameworkOptions, GeneratorOptions } from './types';
import {
  configureEslintPlugin,
  extractEslintInfo,
  suggestESLintPlugin,
} from '../automigrate/helpers/eslintPlugin';
import { detectBuilder } from '../detect';

const logger = console;

const defaultOptions: FrameworkOptions = {
  extraPackages: [],
  extraAddons: [],
  staticDir: undefined,
  addScripts: true,
  addMainFile: true,
  addComponents: true,
  skipBabel: false,
  useSWC: () => false,
  extraMain: undefined,
  framework: undefined,
  extensions: undefined,
  componentsDestinationPath: undefined,
  storybookConfigFolder: '.storybook',
};

const getBuilderDetails = (builder: string) => {
  const map = packageVersions as Record<string, string>;

  if (map[builder]) {
    return builder;
  }

  const builderPackage = `@storybook/${builder}`;
  if (map[builderPackage]) {
    return builderPackage;
  }

  return builder;
};

const getExternalFramework = (framework: string) =>
  externalFrameworks.find(
    (exFramework) =>
      framework !== undefined &&
      (exFramework.name === framework ||
        exFramework.packageName === framework ||
        exFramework?.frameworks?.some?.((item) => item === framework))
  );

const getFrameworkPackage = (framework: string, renderer: string, builder: string) => {
  const externalFramework = getExternalFramework(framework);
  const storybookBuilder = builder?.replace(/^@storybook\/builder-/, '');
  const storybookFramework = framework?.replace(/^@storybook\//, '');

  if (externalFramework === undefined) {
    const frameworkPackage = framework
      ? `@storybook/${storybookFramework}`
      : `@storybook/${renderer}-${storybookBuilder}`;

    if (packageVersions[frameworkPackage as keyof typeof packageVersions]) {
      return frameworkPackage;
    }

    throw new Error(
      dedent`
        Could not find framework package: ${frameworkPackage}.
        Make sure this package exists, and if it does, please file an issue as this might be a bug in Storybook.
      `
    );
  }

  if (externalFramework.frameworks !== undefined) {
    return externalFramework.frameworks.find((item) =>
      item.match(new RegExp(`-${storybookBuilder}`))
    );
  }

  return externalFramework.packageName;
};

const getRendererPackage = (framework: string, renderer: string) => {
  const externalFramework = getExternalFramework(framework);
  if (externalFramework !== undefined)
    return externalFramework.renderer || externalFramework.packageName;

  return `@storybook/${renderer}`;
};

const applyRequireWrapper = (packageName: string) => `%%getAbsolutePath('${packageName}')%%`;

const getFrameworkDetails = (
  renderer: SupportedRenderers,
  builder: Builder,
  pnp: boolean,
  language: SupportedLanguage,
  framework?: SupportedFrameworks,
  shouldApplyRequireWrapperOnPackageNames?: boolean
): {
  type: 'framework' | 'renderer';
  packages: string[];
  builder?: string;
  framework?: string;
  renderer?: string;
  rendererId: SupportedRenderers;
} => {
  const frameworkPackage = getFrameworkPackage(framework, renderer, builder);

  const frameworkPackagePath = shouldApplyRequireWrapperOnPackageNames
    ? applyRequireWrapper(frameworkPackage)
    : frameworkPackage;

  const rendererPackage = getRendererPackage(framework, renderer);
  const rendererPackagePath = shouldApplyRequireWrapperOnPackageNames
    ? applyRequireWrapper(rendererPackage)
    : rendererPackage;

  const builderPackage = getBuilderDetails(builder);
  const builderPackagePath = shouldApplyRequireWrapperOnPackageNames
    ? applyRequireWrapper(builderPackage)
    : builderPackage;

  const isExternalFramework = !!getExternalFramework(frameworkPackage);
  const isKnownFramework =
    isExternalFramework || !!(packageVersions as Record<string, string>)[frameworkPackage];
  const isKnownRenderer = !!(packageVersions as Record<string, string>)[rendererPackage];

  if (isKnownFramework) {
    return {
      packages: [rendererPackage, frameworkPackage],
      framework: frameworkPackagePath,
      rendererId: renderer,
      type: 'framework',
    };
  }

  if (isKnownRenderer) {
    return {
      packages: [rendererPackage, builderPackage],
      builder: builderPackagePath,
      renderer: rendererPackagePath,
      rendererId: renderer,
      type: 'renderer',
    };
  }

  throw new Error(
    `Could not find the framework (${frameworkPackage}) or renderer (${rendererPackage}) package`
  );
};

const stripVersions = (addons: string[]) => addons.map((addon) => getPackageDetails(addon)[0]);

const hasInteractiveStories = (rendererId: SupportedRenderers) =>
  ['react', 'angular', 'preact', 'svelte', 'vue', 'vue3', 'html', 'solid', 'qwik'].includes(
    rendererId
  );

const hasFrameworkTemplates = (framework?: SupportedFrameworks) =>
  ['angular', 'nextjs'].includes(framework);

export async function baseGenerator(
  packageManager: JsPackageManager,
  npmOptions: NpmOptions,
  {
    language,
    builder,
    pnp,
    frameworkPreviewParts,
    yes: skipPrompts,
    projectType,
  }: GeneratorOptions,
  renderer: SupportedRenderers,
  options: FrameworkOptions = defaultOptions,
  framework?: SupportedFrameworks
) {
  const isStorybookInMonorepository = packageManager.isStorybookInMonorepo();
  const shouldApplyRequireWrapperOnPackageNames = isStorybookInMonorepository || pnp;

  if (!builder) {
    // eslint-disable-next-line no-param-reassign
    builder = await detectBuilder(packageManager, projectType);
  }

  const {
    packages: frameworkPackages,
    type,
    rendererId,
    framework: frameworkInclude,
    builder: builderInclude,
  } = getFrameworkDetails(
    renderer,
    builder,
    pnp,
    language,
    framework,
    shouldApplyRequireWrapperOnPackageNames
  );

  const {
    extraAddons: extraAddonPackages,
    extraPackages,
    staticDir,
    addScripts,
    addMainFile,
    addComponents,
    extraMain,
    extensions,
    storybookConfigFolder,
    componentsDestinationPath,
    useSWC,
  } = {
    ...defaultOptions,
    ...options,
  };

  let { skipBabel } = {
    ...defaultOptions,
    ...options,
  };

  const swc = useSWC({ builder });

  if (swc) {
    skipBabel = true;
  }

  const extraAddonsToInstall =
    typeof extraAddonPackages === 'function'
      ? await extraAddonPackages({
          builder: builder || builderInclude,
          framework: framework || frameworkInclude,
        })
      : extraAddonPackages;

  // added to main.js
  const addons = [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    ...stripVersions(extraAddonsToInstall),
  ].filter(Boolean);

  // added to package.json
  const addonPackages = [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/blocks',
    ...extraAddonsToInstall,
  ].filter(Boolean);

  if (hasInteractiveStories(rendererId)) {
    addons.push('@storybook/addon-interactions');
    addonPackages.push('@storybook/addon-interactions');

    // TODO: migrate template stories in solid and qwik to use @storybook/test
    if (['solid', 'qwik'].includes(rendererId)) {
      addonPackages.push('@storybook/testing-library');
    } else {
      addonPackages.push('@storybook/test');
    }
  }

  const files = await fse.readdir(process.cwd());

  const packageJson = await packageManager.retrievePackageJson();
  const installedDependencies = new Set(
    Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies })
  );

  if (!installedDependencies.has('react')) {
    // we add these here because they are required by addon-essentials > addon-docs
    addonPackages.push('react@^18.2.0');
  }
  if (!installedDependencies.has('react-dom')) {
    // we add these here because they are required by addon-essentials > addon-docs
    addonPackages.push('react-dom@^18.2.0');
  }

  // TODO: We need to start supporting this at some point
  if (type === 'renderer') {
    throw new Error(
      dedent`
        Sorry, for now, you can not do this, please use a framework such as @storybook/react-webpack5

        https://github.com/storybookjs/storybook/issues/18360
      `
    );
  }

  const extraPackagesToInstall =
    typeof extraPackages === 'function'
      ? await extraPackages({
          builder: builder || builderInclude,
          framework: framework || frameworkInclude,
        })
      : extraPackages;

  const allPackages = [
    'storybook',
    getExternalFramework(rendererId) ? undefined : `@storybook/${rendererId}`,
    ...frameworkPackages,
    ...addonPackages,
    ...extraPackagesToInstall,
  ].filter(Boolean);

  const packages = [...new Set(allPackages)].filter(
    (packageToInstall) => !installedDependencies.has(getPackageDetails(packageToInstall)[0])
  );

  logger.log();
  const versionedPackagesSpinner = ora({
    indent: 2,
    text: `Getting the correct version of ${packages.length} packages`,
  }).start();
  const versionedPackages = await packageManager.getVersionedPackages(packages);
  versionedPackagesSpinner.succeed();

  // Add basic babel config for a select few frameworks that need it, if they do not have a babel config file already
  if (builder !== CoreBuilder.Vite && !skipBabel) {
    const frameworksThatNeedBabelConfig = [
      '@storybook/react-webpack5',
      '@storybook/vue-webpack5',
      '@storybook/vue3-webpack5',
      '@storybook/html-webpack5',
      '@storybook/web-components-webpack5',
    ];
    const needsBabelConfig = frameworkPackages.find((pkg) =>
      frameworksThatNeedBabelConfig.includes(pkg)
    );
    const hasNoBabelFile = !files.some(
      (fname) => fname.startsWith('.babel') || fname.startsWith('babel')
    );

    if (hasNoBabelFile && needsBabelConfig) {
      const isTypescript = language !== SupportedLanguage.JAVASCRIPT;
      const isReact = rendererId === 'react';
      versionedPackages.push(
        ...getBabelPresets({
          typescript: isTypescript,
          jsx: isReact,
        })
      );
      await writeBabelConfigFile({
        typescript: isTypescript,
        jsx: isReact,
      });
    }
  }

  try {
    if (process.env.CI !== 'true') {
      const { hasEslint, isStorybookPluginInstalled, eslintConfigFile } = await extractEslintInfo(
        packageManager
      );

      if (hasEslint && !isStorybookPluginInstalled) {
        if (skipPrompts || (await suggestESLintPlugin())) {
          versionedPackages.push('eslint-plugin-storybook');
          await configureEslintPlugin(eslintConfigFile, packageManager);
        }
      }
    }
  } catch (err) {
    // any failure regarding configuring the eslint plugin should not fail the whole generator
  }

  if (versionedPackages.length > 0) {
    const addDependenciesSpinner = ora({
      indent: 2,
      text: 'Installing Storybook dependencies',
    }).start();

    await packageManager.addDependencies({ ...npmOptions, packageJson }, versionedPackages);
    addDependenciesSpinner.succeed();
  }

  await fse.ensureDir(`./${storybookConfigFolder}`);

  if (addMainFile) {
    const prefixes = shouldApplyRequireWrapperOnPackageNames
      ? [
          'import { join, dirname } from "path"',
          language === SupportedLanguage.JAVASCRIPT
            ? dedent`/**
            * This function is used to resolve the absolute path of a package.
            * It is needed in projects that use Yarn PnP or are set up within a monorepo.
            */ 
            function getAbsolutePath(value) {
              return dirname(require.resolve(join(value, 'package.json')))
            }`
            : dedent`/**
          * This function is used to resolve the absolute path of a package.
          * It is needed in projects that use Yarn PnP or are set up within a monorepo.
          */ 
          function getAbsolutePath(value: string): any {
            return dirname(require.resolve(join(value, 'package.json')))
          }`,
        ]
      : [];

    await configureMain({
      framework: {
        name: frameworkInclude,
        options: swc
          ? {
              ...(options.framework ?? {}),
              builder: {
                ...(options.framework?.builder ?? {}),
                useSWC: true,
              },
            }
          : options.framework || {},
      },
      prefixes,
      storybookConfigFolder,
      docs: { autodocs: 'tag' },
      addons: shouldApplyRequireWrapperOnPackageNames
        ? addons.map((addon) => applyRequireWrapper(addon))
        : addons,
      extensions,
      language,
      ...(staticDir ? { staticDirs: [path.join('..', staticDir)] } : null),
      ...extraMain,
      ...(type !== 'framework'
        ? {
            core: {
              builder: builderInclude,
            },
          }
        : {}),
    });
  }

  await configurePreview({
    frameworkPreviewParts,
    storybookConfigFolder,
    language,
    rendererId,
  });

  if (addScripts) {
    await packageManager.addStorybookCommandInScripts({
      port: 6006,
    });
  }

  if (addComponents) {
    const templateLocation = hasFrameworkTemplates(framework) ? framework : rendererId;
    await copyTemplateFiles({
      renderer: templateLocation,
      packageManager,
      language,
      destination: componentsDestinationPath,
    });
  }
}
