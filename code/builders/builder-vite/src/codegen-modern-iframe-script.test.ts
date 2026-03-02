import { describe, expect, it } from 'vitest';

import { generateModernIframeScriptCodeFromPreviews } from './codegen-modern-iframe-script';
import { generateAddonSetupCode } from './codegen-set-addon-channel';
import { optimizeViteDeps } from './preset';

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
        import.meta.hot.accept('virtual:/@storybook/builder-vite/storybook-stories.js', (newModule) => {
          // Cancel any running play function before patching in the new importFn
          window.__STORYBOOK_PREVIEW__.channel.emit('storyHotUpdated');
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
        import.meta.hot.accept('virtual:/@storybook/builder-vite/storybook-stories.js', (newModule) => {
          // Cancel any running play function before patching in the new importFn
          window.__STORYBOOK_PREVIEW__.channel.emit('storyHotUpdated');
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
        import.meta.hot.accept('virtual:/@storybook/builder-vite/storybook-stories.js', (newModule) => {
          // Cancel any running play function before patching in the new importFn
          window.__STORYBOOK_PREVIEW__.channel.emit('storyHotUpdated');
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
        import.meta.hot.accept('virtual:/@storybook/builder-vite/storybook-stories.js', (newModule) => {
          // Cancel any running play function before patching in the new importFn
          window.__STORYBOOK_PREVIEW__.channel.emit('storyHotUpdated');
          // importFn has changed so we need to patch the new one in
          window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn: newModule.importFn });
        });
      };"
    `);
  });
});

/**
 * Extract bare package import specifiers from a block of generated JavaScript/TypeScript code.
 * Captures both `import ... from 'pkg'` and `import 'pkg'` forms, excluding:
 *
 * - Relative paths (start with `.`)
 * - Virtual module IDs (start with `virtual:`)
 * - Absolute paths (start with `/`)
 */
function extractPackageImports(code: string): string[] {
  const importRegex = /import\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]/g;
  const specifiers = new Set<string>();
  for (const match of code.matchAll(importRegex)) {
    const specifier = match[1];
    if (
      !specifier.startsWith('.') &&
      !specifier.startsWith('virtual:') &&
      !specifier.startsWith('/')
    ) {
      specifiers.add(specifier);
    }
  }
  return [...specifiers];
}

describe('optimizeDeps coverage for virtual module imports', () => {
  it('every package imported in virtual module code is either in optimizeViteDeps or known to be discovered via entry crawling', async () => {
    // Collect all code generated for virtual modules — Vite's dep scanner never sees
    // the contents of virtual modules, so any package imported there must be
    // pre-bundled explicitly via optimizeViteDeps.
    const iframeCode = await generateModernIframeScriptCodeFromPreviews({ frameworkName: 'test' });
    const addonCode = await generateAddonSetupCode();
    const allVirtualModuleCode = [iframeCode, addonCode].join('\n');

    const packageImports = extractPackageImports(allVirtualModuleCode);

    // These packages are also imported in real source files (preview annotations, renderer
    // previews, addon previews) that ARE added as optimizeDeps entries, so Vite discovers
    // them via entry crawling. No explicit optimizeViteDeps entry is required.
    const discoveredViaEntries = new Set([
      'storybook/preview-api', // Imported in many renderer/addon preview files
      'storybook/internal/channels', // Imported in addon preview files
    ]);

    const notCovered = packageImports.filter(
      (pkg) => !discoveredViaEntries.has(pkg) && !optimizeViteDeps.includes(pkg)
    );

    expect(
      notCovered,
      `The following packages are imported in virtual module code but are NOT covered.\n` +
        `They must be added to optimizeViteDeps in builder-vite/src/preset.ts, OR added to\n` +
        `the discoveredViaEntries set in this test if they appear in real source entry files.\n` +
        `Uncovered: ${notCovered.join(', ')}`
    ).toHaveLength(0);
  });
});
