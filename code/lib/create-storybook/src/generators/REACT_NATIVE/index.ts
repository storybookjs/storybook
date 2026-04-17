import { ProjectType, copyTemplateFiles, getBabelDependencies } from 'storybook/internal/cli';
import { RN_STORYBOOK_DIR } from '../../../../../core/src/shared/constants/config-folder.ts';
import { CLI_COLORS, logger } from 'storybook/internal/node-logger';
import { SupportedBuilder, SupportedLanguage, SupportedRenderer } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { defineGeneratorModule } from '../modules/GeneratorModule.ts';
import { generateReactNativeEntrypoint } from './generateEntrypoint.ts';
import {
  deriveStorybookPlatformScripts,
  type StorybookPlatformScriptDerivationResult,
} from './generateScripts.ts';
import {
  METRO_SETUP_DOCS_LINK,
  runMetroCodemodOrFallback,
  type MetroCodemodResult,
} from './metroConfig.ts';

let lastMetroCodemodResult: MetroCodemodResult | undefined;
let lastScriptDerivationResult: StorybookPlatformScriptDerivationResult | undefined;

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

    const existingScripts = packageManager.primaryPackageJson.packageJson.scripts;
    const scriptDerivationResult = deriveStorybookPlatformScripts(
      existingScripts as Record<string, unknown> | undefined
    );
    lastScriptDerivationResult = scriptDerivationResult;

    const needsCrossEnv =
      Object.keys(scriptDerivationResult.scriptsToAdd).length > 0 &&
      !packageManager.getDependencyVersion('cross-env');

    const packagesToResolve = [
      ...peerDependencies,
      ...(needsCrossEnv ? ['cross-env'] : []),
      '@storybook/addon-ondevice-controls@10.4.0-canary-20260410142651',
      '@storybook/addon-ondevice-actions@10.4.0-canary-20260410142651',
      '@storybook/react-native@10.4.0-canary-20260410142651',
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
      ...scriptDerivationResult.scriptsToAdd,
    });

    // Copy React Native templates
    await copyTemplateFiles({
      packageManager: packageManager as any,
      templateLocation: SupportedRenderer.REACT_NATIVE,
      language: SupportedLanguage.TYPESCRIPT,
      destination: RN_STORYBOOK_DIR,
      features: context.features,
    });
    await generateReactNativeEntrypoint({ language: context.language });

    lastMetroCodemodResult = await runMetroCodemodOrFallback({
      packageManager,
      yes: !!context.yes,
    });

    // React Native doesn't use baseGenerator - return special config
    return {
      // Signal to skip baseGenerator by returning minimal config
      storybookConfigFolder: RN_STORYBOOK_DIR,
      skipGenerator: true,
      storybookCommand: null,
      shouldRunDev: false, // React Native needs additional manual steps to configure the project
    };
  },
  postConfigure: ({ packageManager }) => {
    const platformRunGuidance = (() => {
      const scriptNames = Object.keys(lastScriptDerivationResult?.scriptsToAdd ?? {});

      if (scriptNames.length === 0) {
        return 'No platform launch scripts could be generated automatically.';
      }

      return scriptNames
        .map((scriptName) => packageManager.getRunCommand(scriptName))
        .join('\n      ');
    })();

    const scriptWarningSummary = (() => {
      const missing = lastScriptDerivationResult?.missingBaseScripts ?? [];
      if (missing.length === 0) {
        return null;
      }

      return `Could not infer ${missing.join(', ')} app scripts from package.json. To launch Storybook manually, set STORYBOOK_ENABLED=true when running your app scripts.`;
    })();

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
  
      Storybook run scripts:

      ${CLI_COLORS.cta(' ' + platformRunGuidance + ' ')}

      Metro config status:

      ${CLI_COLORS.info(' ' + metroCodemodSummary + ' ')}

      If manual setup is needed, wrap your Metro config with withStorybook like this:
  
      ${CLI_COLORS.info(' ' + "const { withStorybook } = require('@storybook/react-native/withStorybook');" + ' ')}
      ${CLI_COLORS.info(' ' + 'module.exports = withStorybook(defaultConfig);' + ' ')}

      ${scriptWarningSummary ? `${CLI_COLORS.warning(scriptWarningSummary)}\n` : ''}
  
      For more details go to:
      ${METRO_SETUP_DOCS_LINK}
    `);
  },
});
