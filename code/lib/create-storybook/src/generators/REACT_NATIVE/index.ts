import { copyTemplateFiles, getBabelDependencies } from '../../../../../core/src/cli/helpers';
import { SupportedLanguage } from '../../../../../core/src/cli/project_types';
import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) => {
  const packageJson = await packageManager.retrievePackageJson();

  const missingReactDom =
    !packageJson.dependencies['react-dom'] && !packageJson.devDependencies['react-dom'];

  const reactVersion = packageJson.dependencies.react;

  const peerDependencies = [
    'react-native-safe-area-context',
    '@react-native-async-storage/async-storage',
    '@react-native-community/datetimepicker',
    '@react-native-community/slider',
    'react-native-reanimated',
    'react-native-gesture-handler',
    '@gorhom/bottom-sheet',
    'react-native-svg',
  ].filter((dep) => !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]);

  const packagesToResolve = [
    ...peerDependencies,
    '@storybook/addon-ondevice-controls',
    '@storybook/addon-ondevice-actions',
    '@storybook/react-native',
  ];

  const packagesWithFixedVersion: string[] = [];

  const versionedPackages = await packageManager.getVersionedPackages(packagesToResolve);

  const babelDependencies = await getBabelDependencies(packageManager as any, packageJson);

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
    packageManager: packageManager as any,
    renderer: 'react-native',
    // this value for language is not used since we only ship the ts template. This means we just fallback to @storybook/react-native/template/cli.
    language: SupportedLanguage.TYPESCRIPT_4_9,
    destination: storybookConfigFolder,
    features: options.features,
  });
};

export default generator;
