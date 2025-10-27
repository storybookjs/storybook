import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type Builder,
  type NpmOptions,
  ProjectType,
  SupportedLanguage,
  configureEslintPlugin,
  copyTemplateFiles,
  detectBuilder,
  externalFrameworks,
  extractEslintInfo,
} from 'storybook/internal/cli';
import {
  type JsPackageManager,
  frameworkPackages,
  getPackageDetails,
  isCI,
  optionalEnvToBoolean,
  versions,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { SupportedFrameworks, SupportedRenderers } from 'storybook/internal/types';

// eslint-disable-next-line depend/ban-dependencies
import ora from 'ora';
import invariant from 'tiny-invariant';
import { dedent } from 'ts-dedent';

import { configureMain, configurePreview } from './configure';
import type { FrameworkOptions, GeneratorOptions } from './types';

const defaultOptions: FrameworkOptions = {
  extraPackages: [],
  extraAddons: [],
  staticDir: undefined,
  addScripts: true,
  addMainFile: true,
  addPreviewFile: true,
  addComponents: true,
  webpackCompiler: () => undefined,
  extraMain: undefined,
  framework: undefined,
  extensions: undefined,
  componentsDestinationPath: undefined,
  storybookConfigFolder: '.storybook',
  installFrameworkPackages: true,
};

const getBuilderDetails = (builder: string) => {
  const map = versions as Record<string, string>;

  if (map[builder]) {
    return builder;
  }

  const builderPackage = `@storybook/${builder}`;
  if (map[builderPackage]) {
    return builderPackage;
  }

  return builder;
};

const getExternalFramework = (framework?: string) =>
  externalFrameworks.find(
    (exFramework) =>
      framework !== undefined &&
      (exFramework.name === framework ||
        exFramework.packageName === framework ||
        exFramework?.frameworks?.some?.((item) => item === framework))
  );

const getFrameworkPackage = (framework: string | undefined, renderer: string, builder: string) => {
  const externalFramework = getExternalFramework(framework);
  const storybookBuilder = builder?.replace(/^@storybook\/builder-/, '');
  const storybookFramework = framework?.replace(/^@storybook\//, '');

  if (externalFramework === undefined) {
    const frameworkPackage = framework
      ? `@storybook/${storybookFramework}`
      : `@storybook/${renderer}-${storybookBuilder}`;

    if (versions[frameworkPackage as keyof typeof versions]) {
      return frameworkPackage;
    }

    throw new Error(
      dedent`
        Could not find framework package: ${frameworkPackage}.
        Make sure this package exists, and if it does, please file an issue as this might be a bug in Storybook.
      `
    );
  }

  return (
    externalFramework.frameworks?.find((item) => item.match(new RegExp(`-${storybookBuilder}`))) ??
    externalFramework.packageName
  );
};

const getRendererPackage = (framework: string | undefined, renderer: string) => {
  const externalFramework = getExternalFramework(framework);

  if (externalFramework !== undefined) {
    return externalFramework.renderer || externalFramework.packageName;
  }

  return `@storybook/${renderer}`;
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

const getFrameworkDetails = (
  renderer: SupportedRenderers,
  builder: Builder,
  // TODO: Remove in SB11
  pnp: boolean,
  language: SupportedLanguage,
  framework?: SupportedFrameworks,
  shouldApplyRequireWrapperOnPackageNames?: boolean
): {
  type: 'framework' | 'renderer';
  packages: string[];
  builder?: string;
  frameworkPackagePath?: string;
  renderer?: string;
  rendererId: SupportedRenderers;
  frameworkPackage?: string;
} => {
  const frameworkPackage = getFrameworkPackage(framework, renderer, builder);
  invariant(frameworkPackage, 'Missing framework package.');

  const frameworkPackagePath = shouldApplyRequireWrapperOnPackageNames
    ? applyGetAbsolutePathWrapper(frameworkPackage)
    : frameworkPackage;

  const rendererPackage = getRendererPackage(framework, renderer) as string;
  const rendererPackagePath = shouldApplyRequireWrapperOnPackageNames
    ? applyGetAbsolutePathWrapper(rendererPackage)
    : rendererPackage;

  const builderPackage = getBuilderDetails(builder);
  const builderPackagePath = shouldApplyRequireWrapperOnPackageNames
    ? applyGetAbsolutePathWrapper(builderPackage)
    : builderPackage;

  const isExternalFramework = !!getExternalFramework(frameworkPackage);
  const isKnownFramework =
    isExternalFramework || !!(versions as Record<string, string>)[frameworkPackage];
  const isKnownRenderer = !!(versions as Record<string, string>)[rendererPackage];

  if (isKnownFramework) {
    return {
      packages: [frameworkPackage],
      frameworkPackagePath,
      frameworkPackage,
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

  const frameworksWithTemplates: SupportedFrameworks[] = [
    'angular',
    'ember',
    'html-vite',
    'nextjs',
    'nextjs-vite',
    'preact-vite',
    'react-native-web-vite',
    'react-vite',
    'react-webpack5',
    'server-webpack5',
    'svelte-vite',
    'sveltekit',
    'vue3-vite',
    'web-components-vite',
  ];

  return frameworksWithTemplates.includes(framework as SupportedFrameworks);
};

export async function baseGenerator(
  packageManager: JsPackageManager,
  npmOptions: NpmOptions,
  { language, builder, pnp, frameworkPreviewParts, projectType, features }: GeneratorOptions,
  renderer: SupportedRenderers,
  options: FrameworkOptions = defaultOptions,
  framework?: SupportedFrameworks
) {
  const isStorybookInMonorepository = packageManager.isStorybookInMonorepo();
  const shouldApplyRequireWrapperOnPackageNames = isStorybookInMonorepository || pnp;

  if (!builder) {
    builder = await detectBuilder(packageManager as any, projectType);
  }

  if (features.includes('test')) {
    const supportedFrameworks: ProjectType[] = [
      ProjectType.REACT,
      ProjectType.VUE3,
      ProjectType.NEXTJS,
      ProjectType.NUXT,
      ProjectType.PREACT,
      ProjectType.SVELTE,
      ProjectType.SVELTEKIT,
      ProjectType.WEB_COMPONENTS,
      ProjectType.REACT_NATIVE_WEB,
    ];
    const supportsTestAddon =
      projectType === ProjectType.NEXTJS ||
      (builder !== 'webpack5' && supportedFrameworks.includes(projectType));
    if (!supportsTestAddon) {
      features.splice(features.indexOf('test'), 1);
    }
  }

  const {
    packages,
    type,
    rendererId,
    frameworkPackagePath,
    builder: builderInclude,
    frameworkPackage,
  } = getFrameworkDetails(
    renderer,
    builder,
    pnp,
    language,
    framework,
    shouldApplyRequireWrapperOnPackageNames
  );

  const {
    extraAddons = [],
    extraPackages,
    staticDir,
    addScripts,
    addMainFile,
    addPreviewFile,
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

  const compiler = webpackCompiler ? webpackCompiler({ builder }) : undefined;

  if (features.includes('test')) {
    extraAddons.push('@chromatic-com/storybook');
  }

  if (features.includes('docs')) {
    extraAddons.push('@storybook/addon-docs');
  }

  if (features.includes('onboarding')) {
    extraAddons.push('@storybook/addon-onboarding');
  }

  // added to main.js
  const addons = [
    ...(compiler ? [`@storybook/addon-webpack5-compiler-${compiler}`] : []),
    ...stripVersions(extraAddons),
  ].filter(Boolean);

  // added to package.json
  const addonPackages = [
    ...(compiler ? [`@storybook/addon-webpack5-compiler-${compiler}`] : []),
    ...extraAddons,
  ].filter(Boolean);

  const { packageJson } = packageManager.primaryPackageJson;
  const installedDependencies = new Set(
    Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies })
  );

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
          builder: (builder || builderInclude) as string,
        })
      : extraPackages;

  const allPackages = [
    'storybook',
    ...(installFrameworkPackages ? packages : []),
    ...addonPackages,
    ...(extraPackagesToInstall || []),
  ].filter(Boolean);

  const packagesToInstall = [...new Set(allPackages)].filter(
    (packageToInstall) =>
      !installedDependencies.has(getPackageDetails(packageToInstall as string)[0])
  );

  logger.log('');

  const versionedPackagesSpinner = ora({
    indent: 2,
    text: `Getting the correct version of ${packagesToInstall.length} packages`,
  }).start();

  try {
    if (!isCI()) {
      const { hasEslint, isStorybookPluginInstalled, isFlatConfig, eslintConfigFile } =
        // TODO: Investigate why packageManager type does not match on CI
        await extractEslintInfo(packageManager as any);

      if (hasEslint && !isStorybookPluginInstalled) {
        packagesToInstall.push('eslint-plugin-storybook');
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
  versionedPackagesSpinner.succeed();

  if (versionedPackages.length > 0) {
    const addDependenciesSpinner = ora({
      indent: 2,
      text: 'Installing Storybook dependencies',
    }).start();

    await packageManager.addDependencies({ ...npmOptions }, versionedPackages);
    addDependenciesSpinner.succeed();
  }

  if (addMainFile || addPreviewFile) {
    await mkdir(`./${storybookConfigFolder}`, { recursive: true });
  }

  if (addMainFile) {
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

    await configureMain({
      framework: {
        name: frameworkPackagePath,
        options: options.framework || {},
      },
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
      ...(type !== 'framework'
        ? {
            core: {
              builder: builderInclude,
            },
          }
        : {}),
    });
  }

  if (addPreviewFile) {
    await configurePreview({
      frameworkPreviewParts,
      storybookConfigFolder: storybookConfigFolder as string,
      language,
      frameworkPackage,
    });
  }

  if (addScripts) {
    packageManager.addStorybookCommandInScripts({
      port: 6006,
    });
  }

  if (addComponents) {
    const finalFramework = framework || frameworkPackages[frameworkPackage!] || frameworkPackage;
    const templateLocation = hasFrameworkTemplates(finalFramework) ? finalFramework : rendererId;
    if (!templateLocation) {
      throw new Error(`Could not find template location for ${framework} or ${rendererId}`);
    }
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
}
