import { ProjectType, copyTemplateFiles, getBabelDependencies } from 'storybook/internal/cli';
import { CLI_COLORS, logger } from 'storybook/internal/node-logger';
import { SupportedBuilder, SupportedLanguage, SupportedRenderer } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { defineGeneratorModule } from '../modules/GeneratorModule';
import {
  METRO_SETUP_DOCS_LINK,
  runMetroCodemodOrFallback,
  type MetroCodemodResult,
} from './metroConfig';

let lastMetroCodemodResult: MetroCodemodResult | undefined;

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.REACT_NATIVE,
    renderer: SupportedRenderer.REACT,
    builderOverride: SupportedBuilder.WEBPACK5,
    framework: null,
  },
  configure: async (packageManager, context) => {
    const missingReactDom = !packageManager.getDependencyVersion('react-dom');
    const reactVersion = packageManager.getDependencyVersion('react');
    const dependencyCollector = context.dependencyCollector;

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

    dependencyCollector.addDependencies(packages);

    // Add React Native specific scripts
    packageManager.addScripts({
      'storybook-generate': 'sb-rn-get-stories',
    });

    const storybookConfigFolder = '.rnstorybook';

    // Copy React Native templates
    await copyTemplateFiles({
      packageManager: packageManager as any,
      templateLocation: SupportedRenderer.REACT_NATIVE,
      language: SupportedLanguage.TYPESCRIPT,
      destination: storybookConfigFolder,
      features: context.features,
    });

    lastMetroCodemodResult = await runMetroCodemodOrFallback({
      packageManager,
      yes: !!context.yes,
    });

    // React Native doesn't use baseGenerator - return special config
    return {
      // Signal to skip baseGenerator by returning minimal config
      storybookConfigFolder,
      skipGenerator: true,
      storybookCommand: null,
      shouldRunDev: false, // React Native needs additional manual steps to configure the project
    };
  },
  postConfigure: ({ packageManager }) => {
    const metroCodemodSummary = (() => {
      if (!lastMetroCodemodResult) {
        return 'Metro config could not be evaluated automatically.';
      }

      if (lastMetroCodemodResult.status === 'updated') {
        return 'Metro config was updated automatically with withStorybook(...).';
      }

      if (lastMetroCodemodResult.status === 'already-configured') {
        return 'Metro config already appears to be configured for Storybook.';
      }

      if (lastMetroCodemodResult.status === 'skipped-existing-storybook-import') {
        return 'Metro config already contains Storybook imports, so auto-modification was skipped.';
      }

      if (lastMetroCodemodResult.status === 'fallback-commented') {
        return 'Metro config could not be transformed automatically; guidance was added to your Metro config file.';
      }

      return 'No Metro config file was selected; please update Metro manually.';
    })();

    logger.log(dedent`
      ${CLI_COLORS.warning('The Storybook for React Native installation is not 100% automated.')}
  
      To run Storybook for React Native, you will need to:
  
      1. Replace the contents of your app entry with the following
  
      ${CLI_COLORS.info(' ' + "export {default} from './.rnstorybook';" + ' ')}
  
      2. Metro config status:

      ${CLI_COLORS.info(` ${metroCodemodSummary} `)}

      If manual setup is needed, wrap your Metro config with withStorybook like this:
  
      ${CLI_COLORS.info(' ' + "const { withStorybook } = require('@storybook/react-native/metro');" + ' ')}
      ${CLI_COLORS.info(' ' + 'module.exports = withStorybook(defaultConfig);' + ' ')}
  
      For more details go to:
      ${METRO_SETUP_DOCS_LINK}
  
      Then to start Storybook for React Native, run:
  
      ${CLI_COLORS.cta(' ' + packageManager.getRunCommand('start') + ' ')}
    `);
  },
});
