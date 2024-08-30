<script context="module">

    import { Story, Template } from '../src/index';

    /**
     * Testing tags parsing in the addon's indexer.
     * - In the sidebar, only the _"With Dev"_ story should be visible.
     * - In docs, only the _"With Autodocs"_ story should be visible.
     */
    export const meta ={
      title: 'Tags',
      parameters: {
        controls: { disable: true },
      },
      tags: ['meta-first', '!meta-second', '!meta-third'],
    };
  </script>
  
  <Template let:context>
    <h1>Tags:</h1>
    <pre><code>{JSON.stringify(context.tags, null, 2)}</code></pre>
  </Template>

  <Story name="No Story Tags" />

  <Story name="With story tag" tags={['story-first']} />
  
  <Story name="With story tag, meta disabled" tags={['story-first', '!meta-first']} />
  
  <Story name="With story tag, meta enabled" tags={['story-first', 'meta-second']} />
  
