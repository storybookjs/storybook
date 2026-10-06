import { join } from 'node:path';

import { ProjectType } from 'storybook/internal/cli';
import {
  SupportedBuilder,
  SupportedFramework,
  SupportedLanguage,
  SupportedRenderer,
} from 'storybook/internal/types';

import { applyPreviewImportsMap } from '../../../../../core/src/shared/constants/config-folder.ts';
import reactNativeGeneratorModule from '../REACT_NATIVE/index.ts';
import reactNativeWebGeneratorModule from '../REACT_NATIVE_WEB/index.ts';
import { defineGeneratorModule } from '../modules/GeneratorModule.ts';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.REACT_NATIVE_AND_RNW,
    renderer: SupportedRenderer.REACT,
    framework: SupportedFramework.REACT_NATIVE_WEB_VITE,
    builderOverride: SupportedBuilder.VITE,
  },
  configure: async (packageManager, context) => {
    await reactNativeGeneratorModule.configure(packageManager, context);
    const configurationResult = await reactNativeWebGeneratorModule.configure(
      packageManager,
      context
    );

    const previewExtension = context.language === SupportedLanguage.JAVASCRIPT ? 'js' : 'ts';
    const { packageJson, operationDir } = packageManager.primaryPackageJson;
    // Vite resolves this specifier; Metro aliases it to `.rnstorybook`.
    if (
      applyPreviewImportsMap(
        packageJson,
        join('.storybook', `preview.${previewExtension}`),
        operationDir
      )
    ) {
      packageManager.writePackageJson(packageJson, operationDir);
    }

    return {
      ...configurationResult,
      shouldRunDev: false, // React Native needs additional manual steps to configure the project
    };
  },
  postConfigure: async ({ packageManager }) => {
    await reactNativeWebGeneratorModule.postConfigure();
    reactNativeGeneratorModule.postConfigure({ packageManager });
  },
  postInstall: async ({ packageManager }) => {
    await reactNativeGeneratorModule.postInstall?.({ packageManager });
  },
});
