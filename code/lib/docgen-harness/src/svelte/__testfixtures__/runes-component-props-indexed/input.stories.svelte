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

{#snippet sharedFooter()}
  <small>Shared footer</small>
{/snippet}

{#snippet modalTemplate(args)}
  <Modal {...args}>
    {#snippet content()}
      <p>Template content</p>
    {/snippet}
  </Modal>
{/snippet}

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

<Story name="Footer From Args" exportName="FooterFromArgs" args={{ id: 'modal-footer-from-snippet', open: true, footer: sharedFooter }} />

<Story name="Footer As Attribute" exportName="FooterAsAttribute" args={{ id: 'modal-footer-attr', open: true }}>
  {#snippet template(args)}
    <Modal footer={sharedFooter} {...args} />
  {/snippet}
</Story>

<Story name="Explicit Template" exportName="ExplicitTemplate" template={modalTemplate} args={{ id: 'modal-explicit-template', open: true }} />

<Story name="Args Inside Snippet" exportName="ArgsInsideSnippet" args={{ id: 'modal-args-inside', open: true, error: 'Inline error' }}>
  {#snippet template(args)}
    <Modal {...args}>
      {#snippet content()}
        <p>{args.error}</p>
      {/snippet}
    </Modal>
  {/snippet}
</Story>

<Story name="Args In Value" exportName="ArgsInValue" args={{ id: 'modal-args-in-value', open: true, error: 'code args.open done' }} />
