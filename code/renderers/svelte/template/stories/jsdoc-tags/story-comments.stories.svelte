<script module>
  import { defineMeta } from '@storybook/svelte';

  import StoryComments from './story-comments.svelte';

  /**
   * Meta docblock description.
   *
   * @summary Meta summary
   * @import import { StoryComments } from '@example/story-comments';
   * @deprecated Meta deprecated note
   * @example <StoryComments label="Meta example" />
   * @since 1.0.0
   */
  const { Story } = defineMeta({
    component: StoryComments,
    tags: ['autodocs'],
    args: { label: 'Story comments' },
    parameters: {
      // These stories only exist to show their descriptions in Autodocs and the manifests
      chromatic: { disableSnapshot: true },
    },
  });
</script>

<!--
  Story comment description.

  @summary Story summary
  @deprecated Story deprecated note
  @example <StoryComments label="Story example" />
  @since 1.0.0
-->
<Story name="All Tags" />

<!--
  Story comment description that the describe tag replaces.

  @describe Story describe text
-->
<Story name="Describe" />

<!--
  Story comment description that the desc tag replaces.

  @desc Story desc text
-->
<Story name="Desc" />

<!-- A story. @deprecated Use another story. -->
<Story name="Inline Deprecated" />

<!-- A story. Ask @design before you change it. -->
<Story name="At In Prose" />

<!-- Mail me@example.com for help. -->
<Story name="At In Email" />

<!-- Use the `@summary` tag. -->
<Story name="At In Backticks" />

<!--
  A story.
  @summary a story
  Ask @design first.
-->
<Story name="Tag Then Text" />
