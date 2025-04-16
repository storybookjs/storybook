import { getFrameworkName, getProjectRoot, normalizeStories } from 'storybook/internal/common';
import type { DocsOptions, Options, TagsOptions } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { generateModernIframeScriptCode } from './codegen-modern-iframe-script';

export async function transformIframeHtml(html: string, options: Options) {
  // Batch fetch all preset data
  const [
    build,
    frameworkOptions,
    headHtmlSnippet,
    bodyHtmlSnippet,
    logLevel,
    docsOptions,
    tagsOptions,
    coreOptions,
    stories,
  ] = await Promise.all([
    options.presets.apply('build'),
    options.presets.apply<Record<string, any> | null>('frameworkOptions'),
    options.presets.apply<string | undefined>('previewHead'),
    options.presets.apply<string | undefined>('previewBody'),
    options.presets.apply('logLevel', undefined),
    options.presets.apply<DocsOptions>('docs'),
    options.presets.apply<TagsOptions>('tags'),
    options.presets.apply('core'),
    options.presets.apply('stories', [], options).then((s) =>
      normalizeStories(s, {
        configDir: options.configDir,
        workingDir: process.cwd(),
      }).map((specifier) => ({
        ...specifier,
        importPathMatcher: specifier.importPathMatcher.source,
      }))
    ),
    getFrameworkName(options),
  ]);

  const projectRoot = getProjectRoot();

  const mainScript = (await generateModernIframeScriptCode(options, projectRoot)).trim();

  // Replace all placeholders in the template
  return (
    html
      // Replace configuration placeholders
      .replace('[CONFIG_TYPE HERE]', options.configType || '')
      .replace('[LOGLEVEL HERE]', logLevel || '')
      .replace(`'[FRAMEWORK_OPTIONS HERE]'`, JSON.stringify(frameworkOptions))
      .replace(
        `('OTHER_GLOBLALS HERE');`,
        build?.test?.disableBlocks ? 'window["__STORYBOOK_BLOCKS_EMPTY_MODULE__"] = {};' : ''
      )
      .replace(`'[CHANNEL_OPTIONS HERE]'`, JSON.stringify(coreOptions?.channelOptions || {}))
      .replace(`'[FEATURES HERE]'`, JSON.stringify(options.features || {}))
      .replace(`'[STORIES HERE]'`, JSON.stringify(stories || {}))
      .replace(`'[DOCS_OPTIONS HERE]'`, JSON.stringify(docsOptions || {}))
      .replace(`'[TAGS_OPTIONS HERE]'`, JSON.stringify(tagsOptions || {}))
      // Replace HTML snippets
      .replace('<!-- [HEAD HTML SNIPPET HERE] -->', headHtmlSnippet || '')
      .replace('<!-- [BODY HTML SNIPPET HERE] -->', bodyHtmlSnippet || '')
      // Replace script placeholders with a single consolidated script
      .replace(
        '<!-- [STORYBOOK_INIT_SCRIPTS HERE] -->',
        dedent`
        <script type="module">
          ${mainScript}
        </script>
      `
      )
  );
}
