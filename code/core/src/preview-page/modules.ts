import { STORY_HOT_UPDATED } from '@storybook/core/internal/core-events';

import { dedent } from 'ts-dedent';

import type { PreviewHmr, PreviewModuleName } from './constants.ts';

/** Generated source of the preview modules a builder serves under their module ids. */
export type PreviewModules = Record<Exclude<PreviewModuleName, 'importFn'>, string>;

/** Describe the preview modules to generate. */
export interface PreviewModulesInput {
  hmr: PreviewHmr;
  ids: Record<PreviewModuleName, string>;
  /** Absolute annotation paths; the user preview, when present, is last. */
  previewAnnotations: string[];
  previewRuntimePath: string;
  /** Reload the page instead of hot-updating the preview. */
  declineHmr: boolean;
}

const ADDON_SETUP = dedent`
  import { createBrowserChannel } from 'storybook/internal/channels';
  import { addons } from 'storybook/preview-api';

  const channel = createBrowserChannel({ page: 'preview' });
  addons.setChannel(channel);

  if (window.CONFIG_TYPE === 'DEVELOPMENT') {
    window.__STORYBOOK_SERVER_CHANNEL__ = channel;
  }
`;

const HOT = { vite: 'import.meta.hot', webpack: 'import.meta.webpackHot' } as const;

/** Generate the preview entry, its channel setup, and the project annotations composition. */
export function generatePreviewModules(input: PreviewModulesInput): PreviewModules {
  return {
    entry: generateEntry(input),
    addonSetup: ADDON_SETUP,
    projectAnnotations: generateProjectAnnotations(input),
  };
}

function generateEntry({ hmr, ids, previewRuntimePath, declineHmr }: PreviewModulesInput): string {
  const hot = HOT[hmr];
  // Vite pre-bundles the runtime through this import; Webpack pages load it before the entry.
  const runtime =
    hmr === 'vite' ? `import { setup } from ${JSON.stringify(previewRuntimePath)};\n` : '';
  const hotUpdated =
    hmr === 'vite'
      ? `${hot}.on('vite:afterUpdate', () => {
    window.__STORYBOOK_PREVIEW__.channel.emit('${STORY_HOT_UPDATED}');
  });`
      : `${hot}.addStatusHandler((status) => {
    if (status === 'idle') {
      window.__STORYBOOK_PREVIEW__.channel.emit('${STORY_HOT_UPDATED}');
    }
  });`;
  const storiesChanged =
    hmr === 'vite'
      ? `(newModule) => {
    window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn: newModule.importFn });
  }`
      : `() => {
    window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn });
  }`;
  const hmrHandler = declineHmr
    ? `if (${hot}) {
  ${hot}.decline();
}`
    : `if (${hot}) {
  ${hotUpdated}

  ${hot}.accept(${JSON.stringify(ids.importFn)}, ${storiesChanged});
}`;

  return `${runtime}import ${JSON.stringify(ids.addonSetup)};
${hmr === 'vite' ? '\nsetup();\n\n' : ''}import { PreviewWeb } from 'storybook/preview-api';
import { importFn } from ${JSON.stringify(ids.importFn)};
import { getProjectAnnotations } from ${JSON.stringify(ids.projectAnnotations)};

window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);
window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;

${hmrHandler}
`;
}

function generateProjectAnnotations({ hmr, previewAnnotations }: PreviewModulesInput): string {
  const hot = HOT[hmr];
  const names = previewAnnotations.map((_, index) => `previewAnnotations${index}`);
  const imports = previewAnnotations
    .map((path, index) => `import * as ${names[index]} from ${JSON.stringify(path)};`)
    .join('\n');
  // Vite hands the updated modules to the callback; Webpack rebinds the namespace imports.
  const accept =
    hmr === 'vite'
      ? `(modules) => {
    modules.forEach((module, index) => {
      if (module) hmrModules[index] = module;
    });
    window.__STORYBOOK_PREVIEW__?.onGetProjectAnnotationsChanged({ getProjectAnnotations });
  }`
      : `() => {
    window.__STORYBOOK_PREVIEW__?.onGetProjectAnnotationsChanged({ getProjectAnnotations });
  }`;

  return `import { composeConfigs } from 'storybook/preview-api';
${imports ? `\n${imports}\n` : ''}
const hmrModules = [];

export function getProjectAnnotations() {
  const modules = [${names.join(', ')}].map((module, index) => hmrModules[index] ?? module);
  const preview = modules[modules.length - 1]?.default;
  // A CSF factories preview composes the other annotations itself.
  if (preview?._tag === 'Preview') {
    return preview.composeWith(modules.slice(0, -1));
  }
  return composeConfigs(modules);
}

if (${hot}) {
  ${hot}.accept(${JSON.stringify(previewAnnotations)}, ${accept});
}
`;
}
