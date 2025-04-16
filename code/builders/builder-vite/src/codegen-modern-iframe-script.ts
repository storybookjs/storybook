import { loadPreviewOrConfigFile } from 'storybook/internal/common';
import { isCsfFactoryPreview, readConfig } from 'storybook/internal/csf-tools';
import type { Options, PreviewAnnotation } from 'storybook/internal/types';

import {
  genArrayFromRaw,
  genDynamicImport,
  genImport,
  genObjectFromRawEntries,
  genSafeVariableName,
} from 'knitwork';
import { normalize, relative } from 'pathe';
import { filename } from 'pathe/utils';
import { dedent } from 'ts-dedent';

import { listStories } from './list-stories';
import { processPreviewAnnotation } from './utils/process-preview-annotation';

export async function generateModernIframeScriptCode(options: Options, projectRoot: string) {
  const { presets, configDir } = options;

  const previewOrConfigFile = loadPreviewOrConfigFile({ configDir });
  const previewConfig = await readConfig(previewOrConfigFile!);
  const isCsf4 = isCsfFactoryPreview(previewConfig);

  const previewAnnotationsL = await presets.apply<PreviewAnnotation[]>(
    'previewAnnotations',
    [],
    options
  );
  const previewAnnotations = [...previewAnnotationsL, previewOrConfigFile];

  const previewAnnotationURLs = previewAnnotations
    .filter((path) => path !== undefined)
    .map((path) => processPreviewAnnotation(path, projectRoot));

  const variables: string[] = [];
  const imports: string[] = [];
  for (const previewAnnotation of previewAnnotationURLs) {
    const variable =
      genSafeVariableName(filename(previewAnnotation)).replace(/_(45|46|47)/g, '_') +
      '_' +
      hash(previewAnnotation);
    variables.push(variable);
    imports.push(genImport(previewAnnotation, { name: '*', as: variable }));
  }

  const previewFileURL = previewAnnotationURLs[previewAnnotationURLs.length - 1];
  const previewFileVariable = variables[variables.length - 1];
  const previewFileImport = imports[imports.length - 1];

  // This is pulled out to a variable because it is reused in both the initial page load
  // and the HMR handler.
  // The `hmrPreviewAnnotationModules` parameter is used to pass the updated modules from HMR.
  // However, only the changed modules are provided, the rest are null.
  const getPreviewAnnotationsFunction = isCsf4
    ? dedent`
  const getProjectAnnotations = (hmrPreviewAnnotationModules = []) => {
    const preview = hmrPreviewAnnotationModules[0] ?? ${previewFileVariable};
    return preview.default.composed;
  }`
    : dedent`
  const getProjectAnnotations = (hmrPreviewAnnotationModules = []) => {
    const configs = ${genArrayFromRaw(
      variables.map(
        (previewAnnotation, index) =>
          // Prefer the updated module from an HMR update, otherwise the original module
          `hmrPreviewAnnotationModules[${index}] ?? ${previewAnnotation}`
      ),
      '  '
    )}
    return composeConfigs(configs);
  }`;

  const generateHMRHandler = (): string => {
    // TODO: I disabled HMR for now because it still depends on the virtual module code I removed

    // Web components are not compatible with HMR, so disable HMR, reload page instead.
    return dedent`
    if (import.meta.hot) {
      import.meta.hot.decline();
    }`.trim();
    // if (frameworkName === '@storybook/web-components-vite') {
    //   return dedent`
    //   if (import.meta.hot) {
    //     import.meta.hot.decline();
    //   }`.trim();
    // }

    // return dedent`
    // if (import.meta.hot) {
    //   import.meta.hot.accept('${SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE}', (newModule) => {
    //     // importFn has changed so we need to patch the new one in
    //     window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn: newModule.importFn });
    //   });

    //   import.meta.hot.accept(${JSON.stringify(isCsf4 ? [previewFileURL] : previewAnnotationURLs)}, (previewAnnotationModules) => {
    //     // getProjectAnnotations has changed so we need to patch the new one in
    //     window.__STORYBOOK_PREVIEW__.onGetProjectAnnotationsChanged({ getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules) });
    //   });
    // }`.trim();
  };

  /**
   * This code is largely taken from
   * https://github.com/storybookjs/storybook/blob/d1195cbd0c61687f1720fefdb772e2f490a46584/builders/builder-webpack4/src/preview/virtualModuleModernEntry.js.handlebars
   * Some small tweaks were made to `getProjectAnnotations` (since `import()` needs to be resolved
   * asynchronously) and the HMR implementation has been tweaked to work with Vite.
   *
   * @todo Inline variable and remove `noinspection`
   */

  const storiesFiles = await listStories(options);

  const code = dedent`
  import { setup } from 'storybook/internal/preview/runtime';

    import { createBrowserChannel } from 'storybook/internal/channels';
    import { addons } from 'storybook/preview-api';
    import { PreviewWeb, composeConfigs } from 'storybook/preview-api';

    // Set up the channel
    const channel = createBrowserChannel({ page: 'preview' });
    addons.setChannel(channel);
    window.__STORYBOOK_ADDONS_CHANNEL__ = channel;
    window.__STORYBOOK_SERVER_CHANNEL__ = window.CONFIG_TYPE === 'DEVELOPMENT' ? channel : undefined;

  setup();
 
  import { isPreview } from 'storybook/internal/csf';

      // Set up story loading
    const importers = ${genObjectFromRawEntries(
      storiesFiles.map((file) => {
        const relativePath = relative(process.cwd(), file);
        return [
          relativePath.startsWith('../') ? relativePath : `./${relativePath}`,
          genDynamicImport(normalize(file)),
        ];
      })
    )};

    async function importFn(path) {
      return await importers[path]();
    }

  ${isCsf4 ? previewFileImport : imports.join('\n')}
  ${getPreviewAnnotationsFunction}

  window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);
  
  window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;
  
  ${generateHMRHandler()};
  `.trim();
  return code;
}

export async function generateModernIframeScriptCodeFromPreviews(options: {
  previewAnnotations: (PreviewAnnotation | undefined)[];
  projectRoot: string;
  frameworkName: string;
  isCsf4: boolean;
}) {}
function hash(value: string) {
  return value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}
