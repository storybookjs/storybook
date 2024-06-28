// Hi, João!

module.exports = {
  coreFrameworks: ['react', 'vue', 'angular', 'web-components'],
  communityFrameworks: ['ember', 'html', 'svelte', 'preact'],
  featureGroups: [
    {
      name: 'Essentials',
      features: [
        {
          name: 'Actions',
          unsupported: [],
          path: 'essentials/actions',
        },
        {
          name: 'Backgrounds',
          unsupported: [],
          path: 'essentials/backgrounds',
        },
        {
          name: 'Docs',
          unsupported: [],
          path: 'writing-docs/introduction',
        },
        {
          name: 'Viewport',
          unsupported: [],
          path: 'essentials/viewport',
        },
        {
          name: 'Controls',
          supported: ['react', 'vue', 'angular', 'web-components', 'ember'],
          path: 'essentials/controls',
        },
        {
          name: 'Measure',
          unsupported: [],
          path: 'essentials/measure-and-outline#measure-addon',
        },
        {
          name: 'Outline',
          unsupported: [],
          path: 'essentials/measure-and-outline#outline-addon',
        },
      ],
    },
    {
      name: 'Addons',
      features: [
        {
          name: 'a11y',
          unsupported: [],
        },
        {
          name: 'cssresources',
          unsupported: [],
        },
        {
          name: 'design-assets',
          unsupported: [],
        },
        {
          name: 'events',
          unsupported: ['svelte', 'riot'],
        },
        {
          name: 'google-analytics',
          unsupported: [],
        },
        {
          name: 'graphql',
          supported: ['react', 'angular'],
        },
        {
          name: 'jest',
          unsupported: [],
        },
        {
          name: 'knobs',
          unsupported: [],
        },
        {
          name: 'links',
          unsupported: [],
        },
        {
          name: 'queryparams',
          unsupported: [],
        },
        {
          name: 'Storyshots',
          unsupported: ['ember'],
          path: 'writing-tests/snapshot-testing',
        },
        {
          name: 'storysource',
          unsupported: [],
        },
      ],
    },
    {
      name: 'Docs',
      features: [
        {
          name: 'MDX Stories',
          unsupported: [],
          path: 'api/mdx',
        },
        {
          name: 'CSF Stories',
          unsupported: [],
          path: 'api/csf',
        },
        {
          name: 'storiesOf stories',
          unsupported: [],
          repoPath: 'lib/core/docs/storiesOf.md',
        },
        {
          name: 'Source',
          unsupported: [],
          path: 'writing-docs/doc-block-source',
        },
        {
          name: 'Dynamic source',
          supported: ['react', 'vue', 'angular', 'svelte', 'web-components', 'html'],
          path: 'writing-docs/doc-block-source',
        },
        {
          name: 'Args Table',
          supported: ['react', 'vue', 'angular', 'html', 'ember', 'web-components', 'svelte'],
          path: 'writing-docs/doc-block-argstable',
        },
        {
          name: 'Description',
          supported: ['react', 'vue', 'angular', 'ember', 'web-components'],
          path: 'writing-docs/doc-block-description',
        },
        {
          name: 'Inline stories',
          supported: ['react', 'vue', 'web-components', 'html', 'svelte', 'angular'],
          path: 'writing-docs/docs-page#inline-stories-vs-iframe-stories',
        },
      ],
    },
  ],
};
