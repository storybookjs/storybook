import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    browser: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./entry-preview'],
        entryPoint: './src/entry-preview.ts',
        dts: false,
      },
      {
        exportEntries: ['./entry-preview-docs'],
        entryPoint: './src/entry-preview-docs.ts',
        dts: false,
      },
      {
        exportEntries: ['./csf'],
        entryPoint: './src/svelte-csf/index.ts',
      },
      {
        exportEntries: ['./internal/svelte-csf/create-runtime-stories'],
        entryPoint: './src/svelte-csf/runtime/create-runtime-stories.ts',
      },
      {
        exportEntries: ['./internal/svelte-csf/component-helpers'],
        entryPoint: './src/svelte-csf/runtime/component-helpers.ts',
      },
    ],
    node: [
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
        dts: false,
      },
      {
        exportEntries: ['./internal/docgen-worker'],
        entryPoint: './src/docgen/docgen-worker.ts',
        dts: false,
      },
      {
        exportEntries: ['./internal/svelte-csf/indexer'],
        entryPoint: './src/svelte-csf/indexer/index.ts',
      },
      {
        exportEntries: ['./internal/svelte-csf/vite-plugins'],
        entryPoint: './src/svelte-csf/compiler/plugins.ts',
      },
    ],
  },
  extraOutputs: {
    './internal/PreviewRender.svelte': './static/PreviewRender.svelte',
    './internal/DecoratorHandler.svelte': './static/DecoratorHandler.svelte',
    './internal/AddStorybookIdDecorator.svelte': './static/AddStorybookIdDecorator.svelte',
    './internal/createReactiveProps': './static/createReactiveProps.svelte.js',
    './internal/svelte-csf/Story.svelte': './static/svelte-csf/Story.svelte',
    './internal/svelte-csf/StoriesExtractor.svelte': './static/svelte-csf/StoriesExtractor.svelte',
    './internal/svelte-csf/StoryRenderer.svelte': './static/svelte-csf/StoryRenderer.svelte',
    './internal/svelte-csf/LegacyMeta.svelte': './static/svelte-csf/LegacyMeta.svelte',
    './internal/svelte-csf/LegacyStory.svelte': './static/svelte-csf/LegacyStory.svelte',
    './internal/svelte-csf/LegacyTemplate.svelte': './static/svelte-csf/LegacyTemplate.svelte',
    './internal/svelte-csf/contexts/extractor': './static/svelte-csf/contexts/extractor.svelte.js',
    './internal/svelte-csf/contexts/renderer': './static/svelte-csf/contexts/renderer.svelte.js',
  },
};

export default config;
