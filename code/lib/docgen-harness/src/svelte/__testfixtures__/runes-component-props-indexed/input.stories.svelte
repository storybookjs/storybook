<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Modal from './Modal.svelte';

  /**
   * Modal fixture component description.
   * Captured from defineMeta comments.
   */
  const { Story } = defineMeta({
    title: 'SvelteFixtures/Modal',
    component: Modal,
  });
</script>

<Story name="Default" args={{ id: 'modal-default', open: true, confirmType: 'secondary' }} />

<!-- Modal story docs with snippet props. -->
<Story name="With Snippets" exportName="WithSnippets" args={{ id: 'modal-snippets', open: true, confirmType: 'primary' }}>
  {#snippet template(args)}
    <Modal {...args}>
      {#snippet content()}
        <p>Body</p>
      {/snippet}
      {#snippet footer()}
        <small>Footer</small>
      {/snippet}
    </Modal>
  {/snippet}
</Story>

<Story name="Content Only" exportName="ContentOnly" args={{ id: 'modal-content-only', open: true }}>
  <p>Only content</p>
</Story>
