import { normalizeStories } from 'storybook/internal/common';
import type { DocsOptions, Options, TagsOptions } from 'storybook/internal/types';

export type PreviewHtml = string | undefined;

export async function transformIframeHtml(html: string, options: Options) {
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

  return html
    .replace('[CONFIG_TYPE HERE]', configType || '')
    .replace('[LOGLEVEL HERE]', logLevel || '')
    .replace(`'[FRAMEWORK_OPTIONS HERE]'`, JSON.stringify(frameworkOptions))
    .replace(
      `('OTHER_GLOBLALS HERE');`,
      Object.entries(otherGlobals)
        .map(([k, v]) => `window["${k}"] = ${JSON.stringify(v)};`)
        .join('')
    )
    .replace(
      `'[CHANNEL_OPTIONS HERE]'`,
      JSON.stringify(coreOptions && coreOptions.channelOptions ? coreOptions.channelOptions : {})
    )
    .replace(`'[FEATURES HERE]'`, JSON.stringify(features || {}))
    .replace(`'[STORIES HERE]'`, JSON.stringify(stories || {}))
    .replace(`'[DOCS_OPTIONS HERE]'`, JSON.stringify(docsOptions || {}))
    .replace(`'[TAGS_OPTIONS HERE]'`, JSON.stringify(tagsOptions || {}))
    .replace('<!-- [HEAD HTML SNIPPET HERE] -->', headHtmlSnippet || '')
    .replace('<!-- [BODY HTML SNIPPET HERE] -->', bodyHtmlSnippet || '');
}
