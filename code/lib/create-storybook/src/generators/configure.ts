import fse from '@ndelangen/fs-extra-unified';
import path from 'path';
import { dedent } from 'ts-dedent';
import { logger } from 'storybook/internal/node-logger';
import { externalFrameworks, SupportedLanguage } from 'storybook/internal/cli';

interface ConfigureMainOptions {
  addons: string[];
  extensions?: string[];
  staticDirs?: string[];
  storybookConfigFolder: string;
  language: SupportedLanguage;
  prefixes: string[];
  /**
   * Extra values for main.js
   *
   * In order to provide non-serializable data like functions, you can use
   * { value: '%%yourFunctionCall()%%' }
   *
   * '%% and %%' will be replaced.
   *
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
  rendererId: string;
}

/**
 * We need to clean up the paths in case of pnp
 * input: "path.dirname(require.resolve(path.join('@storybook/react-webpack5', 'package.json')))"
 * output: "@storybook/react-webpack5"
 * */
const sanitizeFramework = (framework: string) => {
  // extract either @storybook/<framework> or storybook-<framework>
  const matches = framework.match(/(@storybook\/\w+(?:-\w+)*)|(storybook-(\w+(?:-\w+)*))/g);
  if (!matches) {
    return undefined;
  }

  return matches[0];
};

export async function configureMain({
  addons,
  extensions = ['js', 'jsx', 'mjs', 'ts', 'tsx'],
  storybookConfigFolder,
  language,
  prefixes = [],
  ...custom
}: ConfigureMainOptions) {
  const srcPath = path.resolve(storybookConfigFolder, '../src');
  const prefix = (await fse.pathExists(srcPath)) ? '../src' : '../stories';
  const config = {
    stories: [`${prefix}/**/*.mdx`, `${prefix}/**/*.stories.@(${extensions.join('|')})`],
    addons,
    ...custom,
  };

  const isTypescript =
    language === SupportedLanguage.TYPESCRIPT_4_9 || language === SupportedLanguage.TYPESCRIPT_3_8;

  let mainConfigTemplate = dedent`<<import>><<prefix>>const config<<type>> = <<mainContents>>;
    export default config;`;

  const frameworkPackage = sanitizeFramework(custom.framework?.name);

  if (!frameworkPackage) {
    mainConfigTemplate = mainConfigTemplate.replace('<<import>>', '').replace('<<type>>', '');
    logger.warn('Could not find framework package name');
  }

  const mainContents = JSON.stringify(config, null, 2)
    .replace(/['"]%%/g, '')
    .replace(/%%['"]/g, '');

  const imports = [];
  const finalPrefixes = [...prefixes];

  if (custom.framework?.name.includes('path.dirname(')) {
    imports.push(`import path from 'path';`);
  }

  if (isTypescript) {
    imports.push(`import type { StorybookConfig } from '${frameworkPackage}';`);
  } else {
    finalPrefixes.push(`/** @type { import('${frameworkPackage}').StorybookConfig } */`);
  }

  let mainJsContents = mainConfigTemplate
    .replace('<<import>>', `${imports.join('\n\n')}\n\n`)
    .replace('<<prefix>>', finalPrefixes.length > 0 ? `${finalPrefixes.join('\n\n')}\n` : '')
    .replace('<<type>>', isTypescript ? ': StorybookConfig' : '')
    .replace('<<mainContents>>', mainContents);

  const mainPath = `./${storybookConfigFolder}/main.${isTypescript ? 'ts' : 'js'}`;

  try {
    const prettier = (await import('prettier')).default;
    mainJsContents = await prettier.format(dedent(mainJsContents), {
      ...(await prettier.resolveConfig(mainPath)),
      filepath: mainPath,
    });
  } catch {
    logger.verbose(`Failed to prettify ${mainPath}`);
  }

  await fse.writeFile(mainPath, mainJsContents, { encoding: 'utf8' });
}

export async function configurePreview(options: ConfigurePreviewOptions) {
  const { prefix: frameworkPrefix = '' } = options.frameworkPreviewParts || {};
  const isTypescript =
    options.language === SupportedLanguage.TYPESCRIPT_4_9 ||
    options.language === SupportedLanguage.TYPESCRIPT_3_8;

  // We filter out community packages here, as we are not certain if they export a Preview type.
  // Let's make this configurable in the future.
  const rendererPackage =
    options.rendererId &&
    !externalFrameworks.map(({ name }) => name as string).includes(options.rendererId)
      ? `@storybook/${options.rendererId}`
      : null;

  const previewPath = `./${options.storybookConfigFolder}/preview.${isTypescript ? 'ts' : 'js'}`;

  // If the framework template included a preview then we have nothing to do
  if (await fse.pathExists(previewPath)) {
    return;
  }

  const prefix = [
    isTypescript && rendererPackage ? `import type { Preview } from '${rendererPackage}'` : '',
    frameworkPrefix,
  ]
    .filter(Boolean)
    .join('\n');

  let preview = dedent`
    ${prefix}${prefix.length > 0 ? '\n' : ''}
    ${
      !isTypescript && rendererPackage
        ? `/** @type { import('${rendererPackage}').Preview } */\n`
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

  try {
    const prettier = (await import('prettier')).default;
    preview = await prettier.format(preview, {
      ...(await prettier.resolveConfig(previewPath)),
      filepath: previewPath,
    });
  } catch {
    logger.verbose(`Failed to prettify ${previewPath}`);
  }

  await fse.writeFile(previewPath, preview, { encoding: 'utf8' });
}
