import {
  CoreBuilder,
  ProjectType,
  SupportedLanguage,
  copyTemplateFiles,
  getBabelDependencies,
} from 'storybook/internal/cli';
import { CLI_COLORS, logger } from 'storybook/internal/node-logger';

import dedent from 'ts-dedent';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.REACT_NATIVE,
    renderer: 'react',
    builderOverride: CoreBuilder.Webpack5,
  },
  configure: async (packageManager, context) => {
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

    const versionedPackages = await packageManager.getVersionedPackages(packagesToResolve);
    const babelDependencies = await getBabelDependencies(packageManager as any);

    const packages: string[] = [
      ...babelDependencies,
      ...versionedPackages,
      ...(missingReactDom && reactVersion ? [`react-dom@${reactVersion}`] : []),
    ];

    // React Native handles dependencies directly (not via baseGenerator)
    await packageManager.addDependencies({ type: 'devDependencies' }, packages);

    // Add React Native specific scripts
    packageManager.addScripts({
      'storybook-generate': 'sb-rn-get-stories',
    });

    const storybookConfigFolder = '.rnstorybook';

    // Copy React Native templates
    await copyTemplateFiles({
      packageManager: packageManager as any,
      templateLocation: 'react-native',
      language: SupportedLanguage.TYPESCRIPT,
      destination: storybookConfigFolder,
      features: context.features,
    });

    // React Native doesn't use baseGenerator - return special config
    return {
      // Signal to skip baseGenerator by returning minimal config
      storybookConfigFolder,
      skipGenerator: true,
      shouldRunDev: false, // React Native needs additional manual steps to configure the project
    };
  },
  postConfigure: ({ packageManager }) => {
    logger.log(dedent`
      ${CLI_COLORS.warning('React Native (RN) Storybook installation is not 100% automated.')}
  
      To run RN Storybook, you will need to:
  
      1. Replace the contents of your app entry with the following
  
      ${CLI_COLORS.info(' ' + "export {default} from './.rnstorybook';" + ' ')}
  
      2. Wrap your metro config with the withStorybook enhancer function like this:
  
      ${CLI_COLORS.info(' ' + "const withStorybook = require('@storybook/react-native/metro/withStorybook');" + ' ')}
      ${CLI_COLORS.info(' ' + 'module.exports = withStorybook(defaultConfig);' + ' ')}
  
      For more details go to:
      https://github.com/storybookjs/react-native#getting-started
  
      Then to start RN Storybook, run:
  
      ${CLI_COLORS.cta(' ' + packageManager.getRunCommand('start') + ' ')}
    `);
  },
});
