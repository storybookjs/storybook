import { describe, expect, it } from 'vitest';

import { generateModernIframeScriptCodeFromPreviews } from './codegen-modern-iframe-script';

describe('generateModernIframeScriptCodeFromPreviews', () => {
  it('handle one annotation', async () => {
    const result = await generateModernIframeScriptCodeFromPreviews({
      frameworkName: 'frameworkName',
    });
    expect(result).toMatchInlineSnapshot(`
      "import { setup } from 'storybook/internal/preview/runtime';

      import 'virtual:/@storybook/builder-vite/setup-addons.js';

      setup();

      import { PreviewWeb } from 'storybook/preview-api';
      import { importFn } from 'virtual:/@storybook/builder-vite/storybook-stories.js';
      import { getProjectAnnotations } from 'virtual:/@storybook/builder-vite/project-annotations.js';
        
      window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);

      window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;

      if (import.meta.hot) {
        import.meta.hot.on('vite:afterUpdate', () => {
          window.__STORYBOOK_PREVIEW__.channel.emit('storyHotUpdated');
        });

        import.meta.hot.accept('virtual:/@storybook/builder-vite/storybook-stories.js', (newModule) => {
          // importFn has changed so we need to patch the new one in
          window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn: newModule.importFn });
        });
      };"
    `);
  });

  it('handle one annotation CSF4', async () => {
    const result = await generateModernIframeScriptCodeFromPreviews({
      frameworkName: 'frameworkName',
    });
    expect(result).toMatchInlineSnapshot(`
      "import { setup } from 'storybook/internal/preview/runtime';

      import 'virtual:/@storybook/builder-vite/setup-addons.js';

      setup();

      import { PreviewWeb } from 'storybook/preview-api';
      import { importFn } from 'virtual:/@storybook/builder-vite/storybook-stories.js';
      import { getProjectAnnotations } from 'virtual:/@storybook/builder-vite/project-annotations.js';
        
      window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);

      window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;

      if (import.meta.hot) {
        import.meta.hot.on('vite:afterUpdate', () => {
          window.__STORYBOOK_PREVIEW__.channel.emit('storyHotUpdated');
        });

        import.meta.hot.accept('virtual:/@storybook/builder-vite/storybook-stories.js', (newModule) => {
          // importFn has changed so we need to patch the new one in
          window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn: newModule.importFn });
        });
      };"
    `);
  });

  it('handle multiple annotations', async () => {
    const result = await generateModernIframeScriptCodeFromPreviews({
      frameworkName: 'frameworkName',
    });
    expect(result).toMatchInlineSnapshot(`
      "import { setup } from 'storybook/internal/preview/runtime';

      import 'virtual:/@storybook/builder-vite/setup-addons.js';

      setup();

      import { PreviewWeb } from 'storybook/preview-api';
      import { importFn } from 'virtual:/@storybook/builder-vite/storybook-stories.js';
      import { getProjectAnnotations } from 'virtual:/@storybook/builder-vite/project-annotations.js';
        
      window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);

      window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;

      if (import.meta.hot) {
        import.meta.hot.on('vite:afterUpdate', () => {
          window.__STORYBOOK_PREVIEW__.channel.emit('storyHotUpdated');
        });

        import.meta.hot.accept('virtual:/@storybook/builder-vite/storybook-stories.js', (newModule) => {
          // importFn has changed so we need to patch the new one in
          window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn: newModule.importFn });
        });
      };"
    `);
  });

  it('handle multiple annotations CSF4', async () => {
    const result = await generateModernIframeScriptCodeFromPreviews({
      frameworkName: 'frameworkName',
    });
    expect(result).toMatchInlineSnapshot(`
      "import { setup } from 'storybook/internal/preview/runtime';

      import 'virtual:/@storybook/builder-vite/setup-addons.js';

      setup();

      import { PreviewWeb } from 'storybook/preview-api';
      import { importFn } from 'virtual:/@storybook/builder-vite/storybook-stories.js';
      import { getProjectAnnotations } from 'virtual:/@storybook/builder-vite/project-annotations.js';
        
      window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);

      window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;

      if (import.meta.hot) {
        import.meta.hot.on('vite:afterUpdate', () => {
          window.__STORYBOOK_PREVIEW__.channel.emit('storyHotUpdated');
        });

        import.meta.hot.accept('virtual:/@storybook/builder-vite/storybook-stories.js', (newModule) => {
          // importFn has changed so we need to patch the new one in
          window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn: newModule.importFn });
        });
      };"
    `);
  });
});
