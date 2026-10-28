import type { PreviewSources } from '@storybook/core/internal/preview-page';

import { toImportFn } from '../to-importFn.ts';

import semver from 'semver';
import webpackModule from 'webpack';

export function getVirtualModuleMapping(
  preview: PreviewSources,
  input: { lazyCompilation: boolean; isProd: boolean }
): Record<string, string> {
  const { virtualModuleIds: ids, modules } = preview;
  // Webpack before 5.101.3 breaks lazy compilation of the story importer without the pipeline.
  const webpackVersion = webpackModule.version ? semver.coerce(webpackModule.version) : null;
  const needPipelinedImport =
    input.lazyCompilation &&
    !input.isProd &&
    !!webpackVersion &&
    semver.lt(webpackVersion, '5.101.3');
  return {
    [ids.entry]: modules.entry,
    [ids.addonSetup]: modules.addonSetup,
    [ids.projectAnnotations]: modules.projectAnnotations,
    [ids.importFn]: toImportFn(preview.stories, { needPipelinedImport }),
  };
}
