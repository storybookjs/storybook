import { getFrameworkName, loadPreviewOrConfigFile } from 'storybook/internal/common';
import type { Options, PreviewAnnotation } from 'storybook/internal/types';

import { processPreviewAnnotation } from './utils/process-preview-annotation';
import { virtualAddonSetupFile, virtualStoriesFile } from './virtual-file-names';

export async function generateModernIframeScriptCode(options: Options, projectRoot: string) {
  const { presets, configDir } = options;
  const frameworkName = await getFrameworkName(options);

  const previewOrConfigFile = await loadPreviewOrConfigFile({ configDir });
  const previewAnnotations = await presets.apply<PreviewAnnotation[]>(
    'previewAnnotations',
    [],
    options
  );
  const previewAnnotationURLs = [...previewAnnotations, previewOrConfigFile]
    .filter(Boolean)
    .map((path) => processPreviewAnnotation(path, projectRoot));

  // This is pulled out to a variable because it is reused in both the initial page load
  // and the HMR handler.  We don't use the hot.accept callback params because only the changed
  // modules are provided, the rest are null.  We can just re-import everything again in that case.
  const getPreviewAnnotationsFunction = `
  const getProjectAnnotations = async (hmrPreviewAnnotationModules = []) => {
    const configs = await Promise.all([${previewAnnotationURLs
      .map(
        (previewAnnotation, index) =>
          // Prefer the updated module from an HMR update, otherwise import the original module
          `hmrPreviewAnnotationModules.at(${index}) ?? import('${previewAnnotation}')`
      )
      .join(',\n')}])
    return composeConfigs(configs);
  }`;

  // eslint-disable-next-line @typescript-eslint/no-shadow
  const generateHMRHandler = (frameworkName: string): string => {
    // Web components are not compatible with HMR, so disable HMR, reload page instead.
    if (frameworkName === '@storybook/web-components-vite') {
      return `
      if (import.meta.hot) {
        import.meta.hot.decline();
      }`.trim();
    }

    return `
    if (import.meta.hot) {
      import.meta.hot.accept('${virtualStoriesFile}', (newModule) => {
      // importFn has changed so we need to patch the new one in
      window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn: newModule.importFn });
      });

    import.meta.hot.accept(${JSON.stringify(previewAnnotationURLs)}, (previewAnnotationModules) => {
      ${getPreviewAnnotationsFunction}
      // getProjectAnnotations has changed so we need to patch the new one in
      window.__STORYBOOK_PREVIEW__.onGetProjectAnnotationsChanged({ getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules) });
    });
  }`.trim();
  };

  /**
   * This code is largely taken from https://github.com/storybookjs/storybook/blob/d1195cbd0c61687f1720fefdb772e2f490a46584/builders/builder-webpack4/src/preview/virtualModuleModernEntry.js.handlebars
   * Some small tweaks were made to `getProjectAnnotations` (since `import()` needs to be resolved asynchronously)
   * and the HMR implementation has been tweaked to work with Vite.
   * @todo Inline variable and remove `noinspection`
   */
  const code = `
  import { composeConfigs, PreviewWeb, ClientApi } from 'storybook/internal/preview-api';
  import '${virtualAddonSetupFile}';
  import { importFn } from '${virtualStoriesFile}';
  
    ${getPreviewAnnotationsFunction}

    window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);
    
    window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;
    
    ${generateHMRHandler(frameworkName)};
    `.trim();
  return code;
}
