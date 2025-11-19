import { stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { logger } from 'storybook/internal/node-logger';
import { Feature, SupportedLanguage } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

interface ConfigureMainOptions {
  addons: string[];
  extensions?: string[];
  staticDirs?: string[];
  storybookConfigFolder: string;
  language: SupportedLanguage;
  prefixes: string[];
  frameworkPackage: string;
  features: Set<Feature>;
  /**
   * Extra values for main.js
   *
   * In order to provide non-serializable data like functions, you can use `{ value:
   * '%%yourFunctionCall()%%' }`
   *
   * `%%` and `%%` will be replaced.
   */
  [key: string]: any;
}

export interface FrameworkPreviewParts {
  prefix: string;
}

interface ConfigurePreviewOptions {
  frameworkPreviewParts?: FrameworkPreviewParts;
  storybookConfigFolder: string;
  language: SupportedLanguage;
  frameworkPackage?: string;
}

const pathExists = async (path: string) => {
  return stat(path)
    .then(() => true)
    .catch(() => false);
};

export async function configureMain({
  addons,
  extensions = ['js', 'jsx', 'mjs', 'ts', 'tsx'],
  storybookConfigFolder,
  language,
  frameworkPackage,
  prefixes = [],
  features,
  ...custom
}: ConfigureMainOptions) {
  const srcPath = resolve(storybookConfigFolder, '../src');
  const prefix = (await pathExists(srcPath)) ? '../src' : '../stories';
  const stories = features.has(Feature.DOCS) ? [`${prefix}/**/*.mdx`] : [];

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
    logger.warn('Could not find framework package name');
  }

  const mainContents = JSON.stringify(config, null, 2)
    .replace(/['"]%%/g, '')
    .replace(/%%['"]/g, '');

  const imports = [];
  const finalPrefixes = [...prefixes];

  if (custom.framework.includes('path.dirname(')) {
    imports.push(`import path from 'node:path';`);
  }

  if (isTypescript) {
    imports.push(`import type { StorybookConfig } from '${frameworkPackage}';`);
  } else {
    finalPrefixes.push(`/** @type { import('${frameworkPackage}').StorybookConfig } */`);
  }

  let mainJsContents = '';
  mainJsContents = mainConfigTemplate
    .replace('<<import>>', `${imports.join('\n\n')}\n\n`)
    .replace('<<prefix>>', finalPrefixes.length > 0 ? `${finalPrefixes.join('\n\n')}\n` : '')
    .replace('<<type>>', isTypescript ? ': StorybookConfig' : '')
    .replace('<<mainContents>>', mainContents);

  const mainPath = `./${storybookConfigFolder}/main.${isTypescript ? 'ts' : 'js'}`;

  await writeFile(mainPath, mainJsContents, { encoding: 'utf8' });

  return { mainPath };
}

export async function configurePreview(options: ConfigurePreviewOptions) {
  const { prefix: frameworkPrefix = '' } = options.frameworkPreviewParts || {};
  const isTypescript = options.language === SupportedLanguage.TYPESCRIPT;

  const previewConfigPath = `./${options.storybookConfigFolder}/preview.${isTypescript ? 'ts' : 'js'}`;

  // If the framework template included a preview then we have nothing to do
  if (await pathExists(previewConfigPath)) {
    return { previewConfigPath };
  }

  const frameworkPackage = options.frameworkPackage;

  const prefix = [
    isTypescript && frameworkPackage ? `import type { Preview } from '${frameworkPackage}'` : '',
    frameworkPrefix,
  ]
    .filter(Boolean)
    .join('\n');

  let preview = '';
  preview = dedent`
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

  await writeFile(previewConfigPath, preview, { encoding: 'utf8' });

  return { previewConfigPath };
}
