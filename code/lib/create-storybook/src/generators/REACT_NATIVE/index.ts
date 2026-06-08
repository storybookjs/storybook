import { ProjectType, copyTemplateFiles, getBabelDependencies } from 'storybook/internal/cli';
import { executeCommand } from 'storybook/internal/common';
import { RN_STORYBOOK_DIR } from '../../../../../core/src/shared/constants/config-folder.ts';
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';
import { SupportedBuilder, SupportedLanguage, SupportedRenderer } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import {
  type ReactNativeEntrypointTemplateVariant,
  generateReactNativeEntrypoint,
} from './generateEntrypoint.ts';
import { defineGeneratorModule } from '../modules/GeneratorModule.ts';
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

export const detectReactNativeEntrypointTemplateVariant = (
  allDependencies: Record<string, string>
) => {
  if (allDependencies.expo || allDependencies['expo-router']) {
    return 'expo';
  }

  return 'default';
};

/**
 * Expo Go bundles specific native module versions for a given Expo SDK. When dependencies are
 * installed with the user's package manager (npm/yarn/pnpm/bun) instead of `expo install`, the
 * latest versions of packages like `@react-native-async-storage/async-storage`,
 * `react-native-svg`, `@react-native-community/slider`, etc. get pinned in `package.json` — and
 * those typically don't match what Expo Go has linked natively.
 *
 * The symptoms are runtime warnings such as:
 *
 *     WARN  storybook-log: error reading from async storage
 *     [AsyncStorageError: Native module is null, cannot access legacy storage]
 *
 * Running `npx expo install --fix` after installation re-aligns those packages to the versions
 * supported by the installed Expo SDK. It's the recommended fix from the Expo team and what we
 * would have done implicitly if we shipped via `npx expo install` instead of the user's package
 * manager.
 */
const fixExpoDependencyVersions = async () => {
  const task = prompt.taskLog({
    id: 'expo-install-fix',
    title: 'Aligning Expo SDK dependency versions with `npx expo install --fix`',
  });

  try {
    const result = await executeCommand({
      command: 'npx',
      args: ['expo', 'install', '--fix'],
      stdio: 'pipe',
    });

    if (result.stdout) {
      task.message(String(result.stdout));
    }
    task.success('Expo SDK dependency versions aligned', { showLog: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    task.error('Could not run `npx expo install --fix` automatically');
    logger.warn(
      dedent`
        Could not automatically align Expo SDK package versions.

        To avoid runtime warnings such as "Native module is null, cannot access legacy storage",
        run the following command in your project root:

          ${CLI_COLORS.cta('npx expo install --fix')}

        Reason: ${message}
      `
    );
  }
};

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
      'react-native-worklets',
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
      '@storybook/addon-ondevice-controls',
      '@storybook/addon-ondevice-actions',
      '@storybook/react-native',
      '@storybook/react-native-ui-lite',
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

    const templateVariant: ReactNativeEntrypointTemplateVariant =
      detectReactNativeEntrypointTemplateVariant(packageManager.getAllDependencies());

    await generateReactNativeEntrypoint({
      language: context.language,
      templateVariant,
    });

    // React Native doesn't use baseGenerator - return special config
    return {
      // Signal to skip baseGenerator by returning minimal config
      storybookConfigFolder: RN_STORYBOOK_DIR,
      skipGenerator: true,
      storybookCommand: null,
      shouldRunDev: false, // React Native is started via platform scripts (see postConfigure), not `storybook dev`
    };
  },
  postInstall: async ({ packageManager }) => {
    // Only re-align versions for projects that actually use Expo. Plain React Native CLI projects
    // are unaffected by the Expo Go SDK <-> native module mismatch this guards against.
    const variant = detectReactNativeEntrypointTemplateVariant(packageManager.getAllDependencies());
    if (variant !== 'expo') {
      return;
    }

    await fixExpoDependencyVersions();
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

    const metroStatus = lastMetroCodemodResult?.status;
    const showWithStorybookManualSnippet =
      !lastMetroCodemodResult ||
      metroStatus === 'fallback-commented' ||
      metroStatus === 'skipped-missing-file';

    const mayNeedFollowUp = !!scriptWarningSummary || showWithStorybookManualSnippet;

    logger.log(dedent`
      ${CLI_COLORS.success('Storybook for React Native has been configured.')}

      ${mayNeedFollowUp ? `${CLI_COLORS.info('If anything below could not be applied automatically, follow the guidance or the docs link.')}\n` : ''}
      Storybook run scripts:

      ${CLI_COLORS.cta(' ' + platformRunGuidance + ' ')}

      Metro config status:

      ${CLI_COLORS.info(' ' + metroCodemodSummary + ' ')}

      ${
        showWithStorybookManualSnippet
          ? dedent`
      If your Metro config still needs wiring, wrap the default export with withStorybook:

      ${CLI_COLORS.info(' ' + "const { withStorybook } = require('@storybook/react-native/withStorybook');" + ' ')}
      ${CLI_COLORS.info(' ' + 'module.exports = withStorybook(defaultConfig);' + ' ')}
      `
          : ''
      }
      ${scriptWarningSummary ? `${CLI_COLORS.warning(scriptWarningSummary)}\n` : ''}

      For more details go to:
      ${METRO_SETUP_DOCS_LINK}
    `);
  },
});
