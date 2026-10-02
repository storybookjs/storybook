import { createHash } from 'node:crypto';

import { getProjectRoot, normalizeStories } from 'storybook/internal/common';
import type { DocsOptions, Options, TagsOptions } from 'storybook/internal/types';

import { SB_VIRTUAL_FILES } from './virtual-file-names.ts';

export type PreviewHtml = string | undefined;

async function getIframeHtmlReplacements(options: Options): Promise<Array<[string, string]>> {
  const { configType, features, presets } = options;
  const build = await presets.apply('build');
  const frameworkOptions = await presets.apply<Record<string, any> | null>('frameworkOptions');
  const headHtmlSnippet = await presets.apply<PreviewHtml>('previewHead');
  const bodyHtmlSnippet = await presets.apply<PreviewHtml>('previewBody');
  const logLevel = await presets.apply('logLevel', undefined);
  const docsOptions = await presets.apply<DocsOptions>('docs');
  const tagsOptions = await presets.apply<TagsOptions>('tags');

  const coreOptions = await presets.apply('core');
  const stories = normalizeStories(await options.presets.apply('stories', [], options), {
    configDir: options.configDir,
    workingDir: process.cwd(),
  }).map((specifier) => ({
    ...specifier,
    importPathMatcher: specifier.importPathMatcher.source,
  }));

  const otherGlobals = {
    ...(build?.test?.disableBlocks ? { __STORYBOOK_BLOCKS_EMPTY_MODULE__: {} } : {}),
  };

  return [
    ['[CONFIG_TYPE HERE]', configType || ''],
    ['[LOGLEVEL HERE]', logLevel || ''],
    [`'[FRAMEWORK_OPTIONS HERE]'`, JSON.stringify(frameworkOptions)],
    [
      `('OTHER_GLOBALS HERE');`,
      Object.entries(otherGlobals)
        .map(([k, v]) => `window["${k}"] = ${JSON.stringify(v)};`)
        .join(''),
    ],
    [
      `'[CHANNEL_OPTIONS HERE]'`,
      JSON.stringify(coreOptions && coreOptions.channelOptions ? coreOptions.channelOptions : {}),
    ],
    [`'[FEATURES HERE]'`, JSON.stringify(features || {})],
    [`'[STORIES HERE]'`, JSON.stringify(stories || {})],
    [`'[DOCS_OPTIONS HERE]'`, JSON.stringify(docsOptions || {})],
    [`'[TAGS_OPTIONS HERE]'`, JSON.stringify(tagsOptions || {})],
    ['<!-- [HEAD HTML SNIPPET HERE] -->', headHtmlSnippet || ''],
    ['<!-- [BODY HTML SNIPPET HERE] -->', bodyHtmlSnippet || ''],
  ];
}

export async function transformIframeHtml(html: string, options: Options) {
  const transformedHtml = (await getIframeHtmlReplacements(options)).reduce(
    (result, [placeholder, value]) => result.replace(placeholder, value),
    html
  );

  if (options.configType === 'DEVELOPMENT') {
    return transformedHtml.replace(
      'virtual:/@storybook/builder-vite/vite-app.js',
      `/@id/__x00__${SB_VIRTUAL_FILES.VIRTUAL_APP_FILE}`
    );
  }

  return transformedHtml;
}

// Hashes the injected values instead of the final HTML, which also holds the hashed chunk file names
export async function getPreviewConfigHash(options: Options) {
  const replacements = JSON.stringify(await getIframeHtmlReplacements(options));
  return createHash('sha256')
    .update(replacements.replaceAll(getProjectRoot(), '<projectRoot>'))
    .digest('hex');
}
