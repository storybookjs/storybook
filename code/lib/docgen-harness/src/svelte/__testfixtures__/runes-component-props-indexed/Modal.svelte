<script lang="ts">
  import type { ComponentProps, Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  import Button from './Button.svelte';

  interface Props extends HTMLAttributes<HTMLDialogElement> {
    /** Confirm button variant. */
    confirmType?: ComponentProps<typeof Button>['variant'];
    /** Open state. */
    open?: boolean;
    /** Error message. */
    error?: string;
    /** Dialog id. */
    id: string;
    /** Main content. */
    content?: Snippet;
    /** Footer content. */
    footer?: Snippet;
    /** Cancel callback. */
    onCancelModal?: () => void;
  }

  let {
    confirmType = 'primary',
    open = $bindable(),
    error = $bindable(''),
    id,
    content,
    footer,
    onCancelModal,
    ...rest
  }: Props = $props();
</script>

<dialog {id} open={open} {...rest}>
  {@render content?.()}
  {#if error}
    <p role="alert">{error}</p>
  {/if}
  <footer>
    {@render footer?.()}
    <Button variant={confirmType}>Confirm</Button>
    <button type="button" onclick={onCancelModal}>Cancel</button>
  </footer>
</dialog>
