import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type SupportedLanguage, copyTemplateFiles } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { frameworkPackages, optionalEnvToBoolean } from 'storybook/internal/common';
import type { SupportedRenderer } from 'storybook/internal/types';
import { SupportedFramework } from 'storybook/internal/types';

import type { GeneratorFeature } from '../types';

/** Module for managing Storybook templates */
export class TemplateManager {
  /** Check if a framework has custom templates */
  hasFrameworkTemplates(framework?: string): boolean {
    if (!framework) {
      return false;
    }

    // Nuxt has framework templates, but for sandboxes we create them from the Vue3 renderer
    // As the Nuxt framework templates are not compatible with the stories we need for CI.
    // See: https://github.com/storybookjs/storybook/pull/28607#issuecomment-2467903327
    if (framework === 'nuxt') {
      return !optionalEnvToBoolean(process.env.IN_STORYBOOK_SANDBOX);
    }

    const frameworksWithTemplates: SupportedFramework[] = [
      SupportedFramework.ANGULAR,
      SupportedFramework.EMBER,
      SupportedFramework.HTML_VITE,
      SupportedFramework.NEXTJS,
      SupportedFramework.NEXTJS_VITE,
      SupportedFramework.PREACT_VITE,
      SupportedFramework.REACT_NATIVE_WEB_VITE,
      SupportedFramework.REACT_VITE,
      SupportedFramework.REACT_WEBPACK5,
      SupportedFramework.SERVER_WEBPACK5,
      SupportedFramework.SVELTE_VITE,
      SupportedFramework.SVELTEKIT,
      SupportedFramework.VUE3_VITE,
      SupportedFramework.WEB_COMPONENTS_VITE,
    ];

    return frameworksWithTemplates.includes(framework as SupportedFramework);
  }

  /** Copy template files to the destination */
  async copyTemplates(
    framework: string | undefined,
    frameworkPackage: string | undefined,
    rendererId: SupportedRenderer,
    packageManager: JsPackageManager,
    language: SupportedLanguage,
    destination: string | undefined,
    features: GeneratorFeature[]
  ): Promise<void> {
    const templateLocation = this.getTemplateLocation(framework, frameworkPackage, rendererId);
    const commonAssetsDir = this.getCommonAssetsDir();

    await copyTemplateFiles({
      templateLocation,
      packageManager: packageManager as any,
      language,
      destination,
      commonAssetsDir,
      features,
    });
  }

  /** Get the common assets directory path */
  private getCommonAssetsDir(): string {
    return join(
      dirname(fileURLToPath(import.meta.resolve('create-storybook/package.json'))),
      'rendererAssets',
      'common'
    );
  }

  /** Determine the template location to use */
  getTemplateLocation(
    framework: string | undefined,
    frameworkPackage: string | undefined,
    rendererId: SupportedRenderer
  ): SupportedFramework | SupportedRenderer {
    const finalFramework = framework || frameworkPackages[frameworkPackage!] || frameworkPackage;
    const templateLocation = this.hasFrameworkTemplates(finalFramework)
      ? finalFramework
      : rendererId;

    if (!templateLocation) {
      throw new Error(`Could not find template location for ${framework} or ${rendererId}`);
    }

    return templateLocation as SupportedFramework | SupportedRenderer;
  }
}
