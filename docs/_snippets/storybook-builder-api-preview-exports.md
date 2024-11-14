```ts filename="codegen-iframe-script.ts" renderer="common" language="ts"
import { virtualPreviewFile, virtualStoriesFile } from './virtual-file-names';
import { transformAbsPath } from './utils/transform-abs-path';
import type { ExtendedOptions } from './types';

export async function generateIframeScriptCode(options: ExtendedOptions) {
  const { presets, frameworkPath, framework } = options;
  const frameworkImportPath = frameworkPath || `@storybook/${framework}`;

  const presetEntries = await presets.apply('config', [], options);
  const configEntries = [...presetEntries].filter(Boolean);

  const absoluteFilesToImport = (files: string[], name: string) =>
    files
      .map((el, i) => `import ${name ? `* as ${name}_${i} from ` : ''}'${transformAbsPath(el)}'`)
      .join('\n');

  const importArray = (name: string, length: number) =>
    new Array(length).fill(0).map((_, i) => `${name}_${i}`);

  const code = `
    // Ensure that the client API is initialized by the framework before any other iframe code
    // is loaded. That way our client-apis can assume the existence of the API+store
    import { configure } from '${frameworkImportPath}';

    import {
      addDecorator,
      addParameters,
      addArgTypesEnhancer,
      addArgsEnhancer,
      setGlobalRender
    } from '@storybook/client-api';
    import { logger } from '@storybook/client-logger';
    ${absoluteFilesToImport(configEntries, 'config')}
    import * as preview from '${virtualPreviewFile}';
    import { configStories } from '${virtualStoriesFile}';

    const configs = [${importArray('config', configEntries.length)
      .concat('preview.default')
      .join(',')}].filter(Boolean)

    configs.forEach(config => {
      Object.keys(config).forEach((key) => {
        const value = config[key];
        switch (key) {
          case 'args':
          case 'argTypes': {
            return logger.warn('Invalid args/argTypes in config, ignoring.', JSON.stringify(value));
          }
          case 'decorators': {
            return value.forEach((decorator) => addDecorator(decorator, false));
          }
          case 'parameters': {
            return addParameters({ ...value }, false);
          }
          case 'render': {
            return setGlobalRender(value)
          }
          case 'globals':
          case 'globalTypes': {
            const v = {};
            v[key] = value;
            return addParameters(v, false);
          }
          case 'decorateStory':
          case 'renderToCanvas': {
            return null;
          }
          default: {
            // eslint-disable-next-line prefer-template
            return console.log(key + ' was not supported :( !');
          }
        }
      });
    })
    configStories(configure);
    `.trim();
  return code;
}
```
