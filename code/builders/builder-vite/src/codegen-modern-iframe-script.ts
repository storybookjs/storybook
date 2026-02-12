import { getFrameworkName } from 'storybook/internal/common';
import { STORY_HOT_UPDATED } from 'storybook/internal/core-events';
import type { Options } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { RESOLVED_VIRTUAL_ID } from './plugins/storybook-project-annotations-plugin';
import { SB_VIRTUAL_FILES } from './virtual-file-names';

export async function generateModernIframeScriptCode(options: Options) {
  const frameworkName = await getFrameworkName(options);

  return generateModernIframeScriptCodeFromPreviews({
    frameworkName,
  });
}

export async function generateModernIframeScriptCodeFromPreviews(options: {
  frameworkName: string;
}) {
  const { frameworkName } = options;

  const generateHMRHandler = (): string => {
    // Web components are not compatible with HMR, so disable HMR, reload page instead.
    if (frameworkName === '@storybook/web-components-vite') {
      return dedent`
      if (import.meta.hot) {
        import.meta.hot.decline();
      }`.trim();
    }

    return dedent`
    if (import.meta.hot) {
      import.meta.hot.on('vite:afterUpdate', () => {
        window.__STORYBOOK_PREVIEW__.channel.emit('${STORY_HOT_UPDATED}');
      });

      import.meta.hot.accept('${SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE}', (newModule) => {
        // importFn has changed so we need to patch the new one in
        window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn: newModule.importFn });
      });
    }`.trim();
  };

  /**
   * This code is largely taken from
   * https://github.com/storybookjs/storybook/blob/d1195cbd0c61687f1720fefdb772e2f490a46584/builders/builder-webpack4/src/preview/virtualModuleModernEntry.js.handlebars
   * Some small tweaks were made to `getProjectAnnotations` (since `import()` needs to be resolved
   * asynchronously) and the HMR implementation has been tweaked to work with Vite.
   *
   * @todo Inline variable and remove `noinspection`
   */
  const code = dedent`
  import { setup } from 'storybook/internal/preview/runtime';
  
  import '${SB_VIRTUAL_FILES.VIRTUAL_ADDON_SETUP_FILE}';
  
  setup();
  
  import { composeConfigs, PreviewWeb } from 'storybook/preview-api';
  import { isPreview } from 'storybook/internal/csf';
  import { importFn } from '${SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE}';
  import { getProjectAnnotations } from '${RESOLVED_VIRTUAL_ID}';
    
  window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);
  
  window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;
  
  ${generateHMRHandler()};
  
  `.trim();
  return code;
}
