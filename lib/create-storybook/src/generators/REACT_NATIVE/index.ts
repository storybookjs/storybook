import { copyTemplateFiles, getBabelDependencies } from 'storybook/internal/cli';
import type { NpmOptions } from 'storybook/internal/cli';
import { SupportedLanguage } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';

const generator = async (
  packageManager: JsPackageManager,
  npmOptions: NpmOptions
): Promise<void> => {
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
    // this value for language is not used since we only ship the ts template. This means we just fallback to @storybook/react-native/template/cli.
    language: SupportedLanguage.TYPESCRIPT_4_9,
    destination: storybookConfigFolder,
  });
};

export default generator;
