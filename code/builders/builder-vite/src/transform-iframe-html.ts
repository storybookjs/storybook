import { getFrameworkName, getProjectRoot, normalizeStories } from 'storybook/internal/common';
import type { DocsOptions, Options, TagsOptions } from 'storybook/internal/types';

import { genDynamicImport, genObjectFromRawEntries } from 'knitwork';
import { dirname, normalize, relative } from 'pathe';
import dedent from 'ts-dedent';

import { listStories } from './list-stories';

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
    frameworkName,
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
  const storiesFiles = await listStories(options);

  // Generate the bootstrapping script

  const mainScript = dedent`
    import { createBrowserChannel } from 'storybook/internal/channels';
    import { addons } from 'storybook/preview-api';
    import { setup } from 'storybook/internal/preview/runtime';
    import { PreviewWeb } from 'storybook/preview-api';

    // Set up the channel
    const channel = createBrowserChannel({ page: 'preview' });
    addons.setChannel(channel);
    window.__STORYBOOK_ADDONS_CHANNEL__ = channel;
    window.__STORYBOOK_SERVER_CHANNEL__ = window.CONFIG_TYPE === 'DEVELOPMENT' ? channel : undefined;

    // Initialize Storybook
    setup();
    
    // Set up story loading
    const importers = ${genObjectFromRawEntries(
      storiesFiles.map((file) => {
        const relativePath = relative(process.cwd(), file);
        return [
          relativePath.startsWith('../') ? relativePath : `./${relativePath}`,
          genDynamicImport(normalize(file)),
        ];
      })
    )};

    async function importFn(path) {
      return await importers[path]();
    }

    // Initialize preview
    const preview = window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb();
    window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || preview.storyStore;
    
    preview.onStoriesChanged({ importFn });

  `.trim();

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
