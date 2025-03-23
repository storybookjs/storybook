import { copyTemplateFiles, getBabelDependencies } from '../../helpers';
import type { JsPackageManager } from '@storybook/core/common';
import type { NpmOptions } from '../../NpmOptions';
import { SupportedLanguage } from '../../project_types';

const generator = async (
  packageManager: JsPackageManager,
  npmOptions: NpmOptions
): Promise<void> => {
  const packageJson = await packageManager.retrievePackageJson();

  const missingReactDom =
    !packageJson.dependencies['react-dom'] && !packageJson.devDependencies['react-dom'];

  const reactVersion = packageJson.dependencies.react;

  const controlsPeerDependencies = [
    'react-native-safe-area-context',
    '@react-native-async-storage/async-storage',
    '@react-native-community/datetimepicker',
    '@react-native-community/slider',
  ].filter((dep) => !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]);

  const packagesToResolve = [
    ...controlsPeerDependencies,
    '@storybook/addon-ondevice-controls',
    '@storybook/addon-ondevice-actions',
    '@storybook/react-native',
  ];

  const packagesWithFixedVersion: string[] = [];

  const versionedPackages = await packageManager.getVersionedPackages(packagesToResolve);

  const babelDependencies = await getBabelDependencies(packageManager, packageJson);

  const packages: string[] = [];

  packages.push(...babelDependencies);

  packages.push(...packagesWithFixedVersion);

  packages.push(...versionedPackages);

  if (missingReactDom && reactVersion) {
    packages.push(`react-dom@${reactVersion}`);
  }

  await packageManager.addDependencies({ ...npmOptions, packageJson }, packages);

  packageManager.addScripts({
    'storybook-generate': 'sb-rn-get-stories',
  });

  const storybookConfigFolder = '.storybook';

  await copyTemplateFiles({
    packageManager,
    renderer: 'react-native',
    language: SupportedLanguage.TYPESCRIPT_3_8,
    destination: storybookConfigFolder,
    includeCommonAssets: false,
  });
};

export default generator;
