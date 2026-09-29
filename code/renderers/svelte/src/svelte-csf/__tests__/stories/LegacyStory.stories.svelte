<script context="module" lang="ts">
  import { Story, Template, type StoryProps } from '@storybook/addon-svelte-csf';
  import { expect, within } from 'storybook/test';

  import LegacyStory from './LegacyStory.svelte';

  /**
   * Description set explicitly in the comment above export const meta.
   *
   * Multiline supported. And also Markdown syntax:
   *
   * * **Bold**,
   * * _Italic_,
   * * `Code`.
   */
  export const meta = {
    title: 'LegacyStory',
    component: LegacyStory,
    args: {
      rounded: false,
    },
    tags: ['autodocs'],
  };

  let count = 0;

  function handleClick() {
    count += 1;
  }

  const play: StoryProps['play'] = async (context) => {
    const { canvasElement, step } = context;
    const canvas = within(canvasElement);
    await step("The container renders it's contents", async () => {
      expect(await canvas.findByRole('button')).toBeInTheDocument();
    });
  };
</script>

<Template let:args>
  <LegacyStory {...args} on:click={handleClick} on:click>
    You clicked: {count}
  </LegacyStory>
</Template>

<Story name="Default" autodocs {play} />

<Story name="Rounded" args={{ rounded: true }} />

<Story name="Square" source args={{ rounded: false }} />

<!-- Dynamic snippet should be disabled for this story -->
<Story name="As Children">Static story</Story>

<Story
  name="TemplateLiterals"
  source={`
    <LegacyStory rounded={false} />
  `}
  args={{ rounded: false }}
>
  Test
</Story>
