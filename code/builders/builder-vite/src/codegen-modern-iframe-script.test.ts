import { describe, expect, it } from 'vitest';

import { generateModernIframeScriptCodeFromPreviews } from './codegen-modern-iframe-script';

const projectRoot = 'projectRoot';

describe('generateModernIframeScriptCodeFromPreviews', () => {
  it('handle one annotation', async () => {
    const result = await generateModernIframeScriptCodeFromPreviews({
      previewAnnotations: ['/user/.storybook/preview'],
      projectRoot,
      frameworkName: 'frameworkName',
      isCsf4: false,
    });
    expect(result).toMatchInlineSnapshot(`
      "import { setup } from 'storybook/internal/preview/runtime';

       import 'virtual:/@storybook/builder-vite/setup-addons.js';

       setup();

       import { composeConfigs, PreviewWeb } from 'storybook/internal/preview-api';
       import { isPreview } from 'storybook/internal/csf';
       import { importFn } from 'virtual:/@storybook/builder-vite/storybook-stories.js';
       
       import * as preview_2408 from "/user/.storybook/preview";
       const getProjectAnnotations = (hmrPreviewAnnotationModules = []) => {
         const configs = [
           hmrPreviewAnnotationModules[0] ?? preview_2408
         ]
         return composeConfigs(configs);
       }

       window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);
       
       window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;
       
       if (import.meta.hot) {
         import.meta.hot.accept('virtual:/@storybook/builder-vite/storybook-stories.js', (newModule) => {
           // importFn has changed so we need to patch the new one in
           window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn: newModule.importFn });
         });
       
         import.meta.hot.accept(["/user/.storybook/preview"], (previewAnnotationModules) => {
           // getProjectAnnotations has changed so we need to patch the new one in
           window.__STORYBOOK_PREVIEW__.onGetProjectAnnotationsChanged({ getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules) });
         });
       };"
    `);
  });

  it('handle one annotation CSF4', async () => {
    const result = await generateModernIframeScriptCodeFromPreviews({
      previewAnnotations: ['/user/.storybook/preview'],
      projectRoot,
      frameworkName: 'frameworkName',
      isCsf4: true,
    });
    expect(result).toMatchInlineSnapshot(`
      "import { setup } from 'storybook/internal/preview/runtime';

       import 'virtual:/@storybook/builder-vite/setup-addons.js';

       setup();

       import { composeConfigs, PreviewWeb } from 'storybook/internal/preview-api';
       import { isPreview } from 'storybook/internal/csf';
       import { importFn } from 'virtual:/@storybook/builder-vite/storybook-stories.js';
       
       import * as preview_2408 from "/user/.storybook/preview";
       const getProjectAnnotations = (hmrPreviewAnnotationModules = []) => {
         const preview = hmrPreviewAnnotationModules[0] ?? preview_2408;
         return preview.default.composed;
       }

       window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);
       
       window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;
       
       if (import.meta.hot) {
         import.meta.hot.accept('virtual:/@storybook/builder-vite/storybook-stories.js', (newModule) => {
           // importFn has changed so we need to patch the new one in
           window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn: newModule.importFn });
         });
       
         import.meta.hot.accept(["/user/.storybook/preview"], (previewAnnotationModules) => {
           // getProjectAnnotations has changed so we need to patch the new one in
           window.__STORYBOOK_PREVIEW__.onGetProjectAnnotationsChanged({ getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules) });
         });
       };"
    `);
  });

  it('handle multiple annotations', async () => {
    const result = await generateModernIframeScriptCodeFromPreviews({
      previewAnnotations: ['/user/previewAnnotations1', '/user/.storybook/preview'],
      projectRoot,
      frameworkName: 'frameworkName',
      isCsf4: false,
    });
    expect(result).toMatchInlineSnapshot(`
      "import { setup } from 'storybook/internal/preview/runtime';

       import 'virtual:/@storybook/builder-vite/setup-addons.js';

       setup();

       import { composeConfigs, PreviewWeb } from 'storybook/internal/preview-api';
       import { isPreview } from 'storybook/internal/csf';
       import { importFn } from 'virtual:/@storybook/builder-vite/storybook-stories.js';
       
       import * as previewAnnotations1_2526 from "/user/previewAnnotations1";
       import * as preview_2408 from "/user/.storybook/preview";
       const getProjectAnnotations = (hmrPreviewAnnotationModules = []) => {
         const configs = [
           hmrPreviewAnnotationModules[0] ?? previewAnnotations1_2526,
           hmrPreviewAnnotationModules[1] ?? preview_2408
         ]
         return composeConfigs(configs);
       }

       window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);
       
       window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;
       
       if (import.meta.hot) {
         import.meta.hot.accept('virtual:/@storybook/builder-vite/storybook-stories.js', (newModule) => {
           // importFn has changed so we need to patch the new one in
           window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn: newModule.importFn });
         });
       
         import.meta.hot.accept(["/user/previewAnnotations1","/user/.storybook/preview"], (previewAnnotationModules) => {
           // getProjectAnnotations has changed so we need to patch the new one in
           window.__STORYBOOK_PREVIEW__.onGetProjectAnnotationsChanged({ getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules) });
         });
       };"
    `);
  });

  it('handle multiple annotations CSF4', async () => {
    const result = await generateModernIframeScriptCodeFromPreviews({
      previewAnnotations: ['/user/previewAnnotations1', '/user/.storybook/preview'],
      projectRoot,
      frameworkName: 'frameworkName',
      isCsf4: true,
    });
    expect(result).toMatchInlineSnapshot(`
      "import { setup } from 'storybook/internal/preview/runtime';

       import 'virtual:/@storybook/builder-vite/setup-addons.js';

       setup();

       import { composeConfigs, PreviewWeb } from 'storybook/internal/preview-api';
       import { isPreview } from 'storybook/internal/csf';
       import { importFn } from 'virtual:/@storybook/builder-vite/storybook-stories.js';
       
       import * as preview_2408 from "/user/.storybook/preview";
       const getProjectAnnotations = (hmrPreviewAnnotationModules = []) => {
         const preview = hmrPreviewAnnotationModules[0] ?? preview_2408;
         return preview.default.composed;
       }

       window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);
       
       window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;
       
       if (import.meta.hot) {
         import.meta.hot.accept('virtual:/@storybook/builder-vite/storybook-stories.js', (newModule) => {
           // importFn has changed so we need to patch the new one in
           window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn: newModule.importFn });
         });
       
         import.meta.hot.accept(["/user/.storybook/preview"], (previewAnnotationModules) => {
           // getProjectAnnotations has changed so we need to patch the new one in
           window.__STORYBOOK_PREVIEW__.onGetProjectAnnotationsChanged({ getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules) });
         });
       };"
    `);
  });
});
