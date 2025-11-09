import { SupportedLanguage, copyTemplateFiles, getBabelDependencies } from 'storybook/internal/cli';

import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) => {
  const missingReactDom = !packageManager.getDependencyVersion('react-dom');

  const reactVersion = packageManager.getDependencyVersion('react');

  const peerDependencies = [
    'react-native-safe-area-context',
    '@react-native-async-storage/async-storage',
    '@react-native-community/datetimepicker',
    '@react-native-community/slider',
    'react-native-reanimated',
    'react-native-gesture-handler',
    '@gorhom/bottom-sheet',
    'react-native-svg',
  ].filter((dep) => !packageManager.getDependencyVersion(dep));

  const packagesToResolve = [
    ...peerDependencies,
    '@storybook/addon-ondevice-controls',
    '@storybook/addon-ondevice-actions',
    '@storybook/react-native',
    'storybook',
  ];

  const packagesWithFixedVersion: string[] = [];

  const versionedPackages = await packageManager.getVersionedPackages(packagesToResolve);

  // TODO: Investigate why packageManager type does not match on CI
  const babelDependencies = await getBabelDependencies(packageManager as any);

  const packages: string[] = [];

  packages.push(...babelDependencies);

  packages.push(...packagesWithFixedVersion);

  packages.push(...versionedPackages);

  if (missingReactDom && reactVersion) {
    packages.push(`react-dom@${reactVersion}`);
  }

  await packageManager.addDependencies(
    {
      ...npmOptions,
    },
    packages
  );

  packageManager.addScripts({
    'storybook-generate': 'sb-rn-get-stories',
  });

  const storybookConfigFolder = '.rnstorybook';

  await copyTemplateFiles({
    packageManager: packageManager as any,
    templateLocation: 'react-native',
    // this value for language is not used since we only ship the ts template. This means we just fallback to @storybook/react-native/template/cli.
    language: SupportedLanguage.TYPESCRIPT,
    destination: storybookConfigFolder,
    features: options.features,
  });
};

export default generator;
