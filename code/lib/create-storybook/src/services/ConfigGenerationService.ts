import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { SupportedLanguage } from 'storybook/internal/cli';

import { dedent } from 'ts-dedent';

import type { GeneratorFeature } from '../generators/types';

export interface MainConfigOptions {
  addons: string[];
  extensions?: string[];
  staticDirs?: string[];
  storybookConfigFolder: string;
  language: SupportedLanguage;
  prefixes: string[];
  frameworkPackage?: string;
  features: GeneratorFeature[];
  [key: string]: any;
}

export interface PreviewConfigOptions {
  frameworkPreviewParts?: {
    prefix: string;
  };
  storybookConfigFolder: string;
  language: SupportedLanguage;
  frameworkPackage?: string;
}

export interface FrameworkPreviewParts {
  prefix: string;
}

/** Service for generating Storybook configuration file contents */
export class ConfigGenerationService {
  /** Check if a path exists */
  private async pathExists(path: string): Promise<boolean> {
    return stat(path)
      .then(() => true)
      .catch(() => false);
  }

  /** Generate the main.js/ts configuration content */
  async generateMainConfig({
    addons,
    extensions = ['js', 'jsx', 'mjs', 'ts', 'tsx'],
    storybookConfigFolder,
    language,
    frameworkPackage,
    prefixes = [],
    features = [],
    ...custom
  }: MainConfigOptions): Promise<string> {
    const srcPath = resolve(storybookConfigFolder, '../src');
    const prefix = (await this.pathExists(srcPath)) ? '../src' : '../stories';
    const stories = features.includes('docs') ? [`${prefix}/**/*.mdx`] : [];

    stories.push(`${prefix}/**/*.stories.@(${extensions.join('|')})`);

    const config = {
      stories,
      addons,
      ...custom,
    };

    const isTypescript = language === SupportedLanguage.TYPESCRIPT;

    let mainConfigTemplate = dedent`<<import>><<prefix>>const config<<type>> = <<mainContents>>;
      export default config;`;

    if (!frameworkPackage) {
      mainConfigTemplate = mainConfigTemplate.replace('<<import>>', '').replace('<<type>>', '');
    }

    const mainContents = JSON.stringify(config, null, 2)
      .replace(/['"]%%/g, '')
      .replace(/%%['"]/g, '');

    const imports = [];
    const finalPrefixes = [...prefixes];

    if (custom.framework?.name.includes('path.dirname(')) {
      imports.push(`import path from 'node:path';`);
    }

    if (isTypescript && frameworkPackage) {
      imports.push(`import type { StorybookConfig } from '${frameworkPackage}';`);
    } else if (frameworkPackage) {
      finalPrefixes.push(`/** @type { import('${frameworkPackage}').StorybookConfig } */`);
    }

    return mainConfigTemplate
      .replace('<<import>>', imports.length > 0 ? `${imports.join('\n\n')}\n\n` : '')
      .replace('<<prefix>>', finalPrefixes.length > 0 ? `${finalPrefixes.join('\n\n')}\n` : '')
      .replace('<<type>>', isTypescript ? ': StorybookConfig' : '')
      .replace('<<mainContents>>', mainContents);
  }

  /** Get the main config file path */
  getMainConfigPath(storybookConfigFolder: string, language: SupportedLanguage): string {
    const isTypescript = language === SupportedLanguage.TYPESCRIPT;
    return `./${storybookConfigFolder}/main.${isTypescript ? 'ts' : 'js'}`;
  }

  /** Generate the preview.js/ts configuration content */
  generatePreviewConfig(options: PreviewConfigOptions): string {
    const { prefix: frameworkPrefix = '' } = options.frameworkPreviewParts || {};
    const isTypescript = options.language === SupportedLanguage.TYPESCRIPT;
    const frameworkPackage = options.frameworkPackage;

    const prefix = [
      isTypescript && frameworkPackage ? `import type { Preview } from '${frameworkPackage}'` : '',
      frameworkPrefix,
    ]
      .filter(Boolean)
      .join('\n');

    return dedent`
      ${prefix}${prefix.length > 0 ? '\n' : ''}
      ${
        !isTypescript && frameworkPackage
          ? `/** @type { import('${frameworkPackage}').Preview } */\n`
          : ''
      }const preview${isTypescript ? ': Preview' : ''} = {
        parameters: {
          controls: {
            matchers: {
             color: /(background|color)$/i,
             date: /Date$/i,
            },
          },
        },
      };
      
      export default preview;
      `
      .replace('  \n', '')
      .trim();
  }

  /** Get the preview config file path */
  getPreviewConfigPath(storybookConfigFolder: string, language: SupportedLanguage): string {
    const isTypescript = language === SupportedLanguage.TYPESCRIPT;
    return `./${storybookConfigFolder}/preview.${isTypescript ? 'ts' : 'js'}`;
  }

  /** Check if a preview file already exists */
  async previewExists(
    storybookConfigFolder: string,
    language: SupportedLanguage
  ): Promise<boolean> {
    const previewPath = this.getPreviewConfigPath(storybookConfigFolder, language);
    return this.pathExists(previewPath);
  }
}
