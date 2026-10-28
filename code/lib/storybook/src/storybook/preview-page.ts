import './server/hooks.ts';

import { join } from 'pathe';

import type { Storybook } from '@storybook/core';
import {
  getPreviewSources as getCorePreviewSources,
  type PreviewSources,
  type PreviewSourcesInput,
} from '@storybook/core/internal/preview-page';
import { resolvePackageDir } from '@storybook/core/internal/deep/utils/module';

// Named, not `export *`: the bundler drops star re-exports from a package next to local exports.
export {
  EXPORT_ORDER_FILE_PATTERN,
  PREVIEW_MODULE_FILES,
  VITE_PREVIEW_MODULE_IDS,
  appendNamedExportsOrder,
  generatePreviewModules,
  getPreviewDefine,
  getPreviewModuleIds,
  renderPreviewHtml,
} from '@storybook/core/internal/preview-page';
export type {
  PreviewDefineInput,
  PreviewDefineTarget,
  PreviewHmr,
  PreviewHtmlInput,
  PreviewHtmlSlots,
  PreviewModuleName,
  PreviewModules,
  PreviewModulesInput,
  PreviewSources,
  PreviewSourcesInput,
} from '@storybook/core/internal/preview-page';

/** Compute the preview sources with this package's preview runtime and security settings. */
export async function getPreviewSources(
  storybook: Storybook,
  input: Pick<PreviewSourcesInput, 'hmr'>
): Promise<PreviewSources> {
  const security = await storybook.callHook('server:security:extend', undefined);
  return getCorePreviewSources(storybook, {
    ...input,
    previewRuntimePath: getPreviewRuntimePath(),
    insecureIframeMessaging: security?.insecureIframeMessaging,
  });
}

/** Locate the preview runtime inside this `storybook` copy, never the project root's. */
export function getPreviewRuntimePath(): string {
  return join(resolvePackageDir('storybook', import.meta.url), 'dist/core/preview/runtime.js');
}
