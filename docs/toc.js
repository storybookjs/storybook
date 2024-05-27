module.exports = {
  toc: [
    {
      pathSegment: 'get-started',
      title: 'Get started',
      type: 'heading',
      children: [
        {
          pathSegment: 'why-storybook',
          title: 'Why Storybook?',
          type: 'link',
          description: 'Learn why Storybook can help you build better UIs',
        },
        {
          pathSegment: 'install',
          title: 'Install',
          type: 'link',
          description: 'Install the Storybook package in your project',
        },
        {
          pathSegment: '',
          title: 'Frameworks',
          type: 'menu',
          children: [
            {
              pathSegment: 'angular',
              title: 'Angular',
              type: 'link',
            },
            {
              pathSegment: 'nextjs',
              title: 'Next.js',
              type: 'link',
            },
            {
              pathSegment: 'react-vite',
              title: 'React & Vite',
              type: 'link',
            },
            {
              pathSegment: 'react-webpack5',
              title: 'React & Webpack',
              type: 'link',
            },
            {
              pathSegment: 'sveltekit',
              title: 'SvelteKit',
              type: 'link',
            },
            {
              pathSegment: 'svelte-vite',
              title: 'Svelte & Vite',
              type: 'link',
            },
            {
              pathSegment: 'svelte-webpack5',
              title: 'Svelte & Webpack',
              type: 'link',
            },
            {
              pathSegment: 'vue3-vite',
              title: 'Vue & Vite',
              type: 'link',
            },
            {
              pathSegment: 'vue3-webpack5',
              title: 'Vue & Webpack',
              type: 'link',
            },
            {
              pathSegment: 'web-components-vite',
              title: 'Web components & Vite',
              type: 'link',
            },
            {
              pathSegment: 'web-components-webpack5',
              title: 'Web components & Webpack',
              type: 'link',
            },
          ],
        },
        {
          pathSegment: 'whats-a-story',
          title: "What's a story?",
          type: 'link',
          description: 'Learn how to save component examples as stories',
        },
        {
          pathSegment: 'browse-stories',
          title: 'Browse stories',
          type: 'link',
          description: 'Learn how to explore your stories within Storybook',
        },
        {
          pathSegment: 'setup',
          title: 'Setup',
          type: 'link',
          description:
            'Write your first story & adjust Storybook configuration for your environment',
        },
        {
          pathSegment: 'conclusion',
          title: 'Conclusion',
          type: 'link',
          description: 'Take your Storybook skills to the next level',
        },
      ],
    },
    {
      pathSegment: 'writing-stories',
      title: 'Stories',
      type: 'heading',
      children: [
        {
          pathSegment: 'args',
          title: 'Args',
          type: 'link',
        },
        {
          pathSegment: 'parameters',
          title: 'Parameters',
          type: 'link',
        },
        {
          pathSegment: 'decorators',
          title: 'Decorators',
          type: 'link',
        },
        {
          pathSegment: 'play-function',
          title: 'Play function',
          type: 'link',
        },
        {
          pathSegment: 'loaders',
          title: 'Loaders',
          type: 'link',
        },
        {
          pathSegment: 'tags',
          title: 'Tags',
          type: 'link',
        },
        {
          pathSegment: 'naming-components-and-hierarchy',
          title: 'Naming components and hierarchy',
          type: 'link',
        },
        {
          pathSegment: '',
          title: 'Mocking data and modules',
          type: 'menu',
          children: [
            {
              pathSegment: 'mocking-modules',
              title: 'Modules',
              type: 'link',
            },
            {
              pathSegment: 'mocking-network-requests',
              title: 'Network requests',
              type: 'link',
            },
            {
              pathSegment: 'mocking-providers',
              title: 'Providers',
              type: 'link',
            },
          ],
        },
        {
          pathSegment: 'build-pages-with-storybook',
          title: 'Build pages and screens',
          type: 'link',
        },
        {
          pathSegment: 'stories-for-multiple-components',
          title: 'Stories for multiple components',
          type: 'link',
        },
        {
          pathSegment: 'typescript',
          title: 'Writing stories in TypeScript',
          type: 'link',
        },
      ],
    },
    {
      pathSegment: 'writing-docs',
      title: 'Docs',
      type: 'heading',
      children: [
        {
          pathSegment: 'autodocs',
          title: 'Autodocs',
          type: 'link',
        },
        {
          pathSegment: 'mdx',
          title: 'MDX',
          type: 'link',
        },
        {
          pathSegment: 'doc-blocks',
          title: 'Doc blocks',
          type: 'link',
        },
        {
          pathSegment: 'build-documentation',
          title: 'Preview and build docs',
          type: 'link',
        },
      ],
    },
    {
      pathSegment: 'writing-tests',
      title: 'Testing',
      type: 'heading',
      children: [
        {
          pathSegment: 'test-runner',
          title: 'Test runner',
          type: 'link',
        },
        {
          pathSegment: 'visual-testing',
          title: 'Visual tests',
          type: 'link',
        },
        {
          pathSegment: 'accessibility-testing',
          title: 'Accessibility tests',
          type: 'link',
        },
        {
          pathSegment: 'interaction-testing',
          title: 'Interaction tests',
          type: 'link',
        },
        {
          pathSegment: 'test-coverage',
          title: 'Test coverage',
          type: 'link',
        },
        {
          pathSegment: '',
          title: 'Snapshot testing',
          type: 'menu',
          children: [
            {
              pathSegment: 'snapshot-testing',
              title: 'Write',
              type: 'link',
            },
            {
              pathSegment: 'storyshots-migration-guide',
              title: 'Storyshots migration guide',
              type: 'link',
            },
          ],
        },
        {
          pathSegment: '',
          title: 'Import stories in tests',
          type: 'menu',
          children: [
            {
              pathSegment: 'stories-in-end-to-end-tests',
              title: 'End-to-end tests',
              type: 'link',
            },
            {
              pathSegment: 'stories-in-unit-tests',
              title: 'Unit tests',
              type: 'link',
            },
          ],
        },
      ],
    },
    {
      pathSegment: 'sharing',
      title: 'Sharing',
      type: 'heading',
      children: [
        {
          pathSegment: 'publish-storybook',
          title: 'Publish',
          type: 'link',
        },
        {
          pathSegment: 'embed',
          title: 'Embed',
          type: 'link',
        },
        {
          pathSegment: 'design-integrations',
          title: 'Design integrations',
          type: 'link',
        },
        {
          pathSegment: 'storybook-composition',
          title: 'Composition',
          type: 'link',
        },
        {
          pathSegment: 'package-composition',
          title: 'Package Composition',
          type: 'link',
        },
      ],
    },
    {
      pathSegment: 'essentials',
      title: 'Essential addons',
      type: 'heading',
      children: [
        {
          pathSegment: 'actions',
          title: 'Actions',
          type: 'link',
        },
        {
          pathSegment: 'backgrounds',
          title: 'Backgrounds',
          type: 'link',
        },
        {
          pathSegment: 'controls',
          title: 'Controls',
          type: 'link',
        },
        {
          pathSegment: 'highlight',
          title: 'Highlight',
          type: 'link',
        },
        {
          pathSegment: 'interactions',
          title: 'Interactions',
          type: 'link',
        },
        {
          pathSegment: 'measure-and-outline',
          title: 'Measure & Outline',
          type: 'link',
        },
        // {
        //   pathSegment: 'themes',
        //   title: 'Themes',
        //   type: 'link',
        // },
        {
          pathSegment: 'toolbars-and-globals',
          title: 'Toolbars & globals',
          type: 'link',
        },
        {
          pathSegment: 'viewport',
          title: 'Viewport',
          type: 'link',
        },
        
      ],
    },
    {
      pathSegment: 'addons',
      title: 'Addons',
      type: 'heading',
      children: [
        {
          pathSegment: 'install-addons',
          title: 'Install',
          type: 'link',
        },
        {
          pathSegment: 'writing-addons',
          title: 'Write',
          type: 'link',
        },
        {
          pathSegment: 'configure-addons',
          title: 'Configure addons',
          type: 'link',
        },
        {
          pathSegment: 'writing-presets',
          title: 'Write a preset',
          type: 'link',
        },
        {
          pathSegment: 'integration-catalog',
          title: 'Add to catalog',
          type: 'link',
        },
        {
          pathSegment: 'addon-types',
          title: 'Types of addons',
          type: 'link',
        },
        {
          pathSegment: 'addon-knowledge-base',
          title: 'Knowledge base',
          type: 'link',
        },
        {
          pathSegment: 'addons-api',
          title: 'Addon API',
          type: 'link',
        },
        {
          pathSegment: 'addon-migration-guide',
          title: 'Migrate addons to 8.0',
          type: 'link',
        },
      ],
    },
    {
      pathSegment: 'configure',
      title: 'Configure',
      type: 'heading',
      children: [
        {
          pathSegment: 'styling-and-css',
          title: 'Styling and CSS',
          type: 'link',
        },
        {
          pathSegment: 'upgrading',
          title: 'Upgrading',
          type: 'link',
        },
        {
          pathSegment: 'telemetry',
          title: 'Telemetry',
          type: 'link',
        },
        {
          pathSegment: '',
          title: 'Integration',
          type: 'menu',
          children: [
            {
              pathSegment: 'frameworks',
              title: 'Frameworks',
              type: 'link',
            },
            {
              pathSegment: 'frameworks-feature-support',
              title: 'Feature support for frameworks',
              type: 'link',
            },
            {
              pathSegment: 'compilers',
              title: 'Compilers',
              type: 'link',
            },
            {
              pathSegment: 'typescript',
              title: 'TypeScript',
              type: 'link',
            },
            {
              pathSegment: 'images-and-assets',
              title: 'Images and assets',
              type: 'link',
            },
          ],
        },
        {
          pathSegment: 'story-rendering',
          title: 'Story rendering',
          type: 'link',
        },
        {
          pathSegment: 'story-layout',
          title: 'Story Layout',
          type: 'link',
        },
        {
          pathSegment: '',
          title: 'User interface',
          type: 'menu',
          children: [
            {
              pathSegment: 'features-and-behavior',
              title: 'Features and behavior',
              type: 'link',
            },
            {
              pathSegment: 'theming',
              title: 'Theming',
              type: 'link',
            },
            {
              pathSegment: 'sidebar-and-urls',
              title: 'Sidebar & URLS',
              type: 'link',
            },
            {
              pathSegment: 'storybook-addons',
              title: 'Storybook Addons',
              type: 'link',
            },
          ],
        },
        {
          pathSegment: 'environment-variables',
          title: 'Environment variables',
          type: 'link',
        },
      ],
    },
    {
      pathSegment: 'builders',
      title: 'Builders',
      type: 'heading',
      children: [
        {
          pathSegment: 'vite',
          title: 'Vite',
          type: 'link',
        },
        {
          pathSegment: 'webpack',
          title: 'Webpack',
          type: 'link',
        },
        {
          pathSegment: 'builder-api',
          title: 'API',
          type: 'link',
        },
      ],
    },
    {
      pathSegment: 'api',
      title: 'API',
      type: 'heading',
      children: [
        {
          title: 'main.js|ts configuration',
          pathSegment: '',
          type: 'menu',
          children: [
            {
              title: 'Overview',
              pathSegment: 'main-config',
              type: 'link',
            },
            {
              title: 'framework',
              pathSegment: 'main-config-framework',
              type: 'link',
            },
            {
              title: 'stories',
              pathSegment: 'main-config-stories',
              type: 'link',
            },
            {
              title: 'addons',
              pathSegment: 'main-config-addons',
              type: 'link',
            },
            {
              title: 'babel',
              pathSegment: 'main-config-babel',
              type: 'link',
            },
            {
              title: 'babelDefault',
              pathSegment: 'main-config-babel-default',
              type: 'link',
            },
             {
              title: 'build',
              pathSegment: 'main-config-build',
              type: 'link',
            },
            {
              title: 'core',
              pathSegment: 'main-config-core',
              type: 'link',
            },
            {
              title: 'docs',
              pathSegment: 'main-config-docs',
              type: 'link',
            },
            {
              title: 'env',
              pathSegment: 'main-config-env',
              type: 'link',
            },
            {
              title: 'features',
              pathSegment: 'main-config-features',
              type: 'link',
            },
            {
              title: 'indexers',
              pathSegment: 'main-config-indexers',
              type: 'link',
            },
            {
              title: 'logLevel',
              pathSegment: 'main-config-log-level',
              type: 'link',
            },
            {
              title: 'managerHead',
              pathSegment: 'main-config-manager-head',
              type: 'link',
            },
            {
              title: 'previewAnnotations',
              pathSegment: 'main-config-preview-annotations',
              type: 'link',
            },
            {
              title: 'previewBody',
              pathSegment: 'main-config-preview-body',
              type: 'link',
            },
            {
              title: 'previewHead',
              pathSegment: 'main-config-preview-head',
              type: 'link',
            },
            {
              title: 'refs',
              pathSegment: 'main-config-refs',
              type: 'link',
            },
            {
              title: 'staticDirs',
              pathSegment: 'main-config-static-dirs',
              type: 'link',
            },
            {
              title: 'swc',
              pathSegment: 'main-config-swc',
              type: 'link',
            },
            {
              title: 'typescript',
              pathSegment: 'main-config-typescript',
              type: 'link',
            },
            {
              title: 'viteFinal',
              pathSegment: 'main-config-vite-final',
              type: 'link',
            },
            {
              title: 'webpackFinal',
              pathSegment: 'main-config-webpack-final',
              type: 'link',
            },
          ],
        },
        {
          pathSegment: 'csf',
          title: 'Component Story Format (CSF)',
          type: 'link',
        },
        {
          pathSegment: 'arg-types',
          title: 'ArgTypes',
          type: 'link',
        },
        {
          pathSegment: 'parameters',
          title: 'Parameters',
          type: 'link',
        },
        {
          title: 'Doc blocks',
          pathSegment: '',
          type: 'menu',
          children: [
            {
              pathSegment: 'doc-block-argtypes',
              title: 'ArgTypes',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-canvas',
              title: 'Canvas',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-colorpalette',
              title: 'ColorPalette',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-controls',
              title: 'Controls',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-description',
              title: 'Description',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-icongallery',
              title: 'IconGallery',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-markdown',
              title: 'Markdown',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-meta',
              title: 'Meta',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-primary',
              title: 'Primary',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-source',
              title: 'Source',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-stories',
              title: 'Stories',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-story',
              title: 'Story',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-subtitle',
              title: 'Subtitle',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-title',
              title: 'Title',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-typeset',
              title: 'Typeset',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-unstyled',
              title: 'Unstyled',
              type: 'link',
            },
            {
              pathSegment: 'doc-block-useof',
              title: 'useOf',
              type: 'link',
            },
          ],
        },
        {
          title: 'Portable stories',
          pathSegment: '',
          type: 'menu',
          children: [
            // Unpublished for now
            // {
            //   pathSegment: 'portable-stories-jest',
            //   title: 'Jest',
            //   type: 'link',
            // },
            {
              pathSegment: 'portable-stories-playwright',
              title: 'Playwright',
              type: 'link',
            },
            // Unpublished for now
            // {
            //   pathSegment: 'portable-stories-vitest',
            //   title: 'Vitest',
            //   type: 'link',
            // },
          ],
        },
        
        {
          pathSegment: 'new-frameworks',
          title: 'Frameworks',
          type: 'link',
        },
        {
          pathSegment: 'cli-options',
          title: 'CLI options',
          type: 'link',
        },
      ],
    },
    {
      pathSegment: 'contribute',
      title: 'Contribute',
      type: 'heading',
      children: [
        {
          pathSegment: 'RFC',
          title: 'RFC Process',
          type: 'link',
        },
        {
          pathSegment: 'code',
          title: 'Code',
          type: 'link',
        },
        {
          pathSegment: '',
          title: 'Documentation',
          type: 'menu',
          children: [
            {
              pathSegment: 'documentation-updates',
              title: 'Content',
              type: 'link',
            },
            {
              pathSegment: 'new-snippets',
              title: 'Code snippets',
              type: 'link',
            },
          ],
        },
        {
          pathSegment: 'framework',
          title: 'Framework',
          type: 'link',
        },
        {
          pathSegment: 'how-to-reproduce',
          title: 'Reproduce',
          type: 'link',
        },
        {
          pathSegment: 'roadmap',
          title: 'Roadmap',
          type: 'link',
        },
      ],
    },
    {
      title: 'FAQ',
      pathSegment: 'faq',
      type: 'link',
    },
    {
      pathSegment: 'migration-guide',
      title: 'Migrate to 8.0',
      type: 'heading',
      children: [
        {
          title: 'Migrate from 6.x to 8.0',
          pathSegment: 'from-older-version',
          type: 'link',
        },
      ],
    },
  ],
};
