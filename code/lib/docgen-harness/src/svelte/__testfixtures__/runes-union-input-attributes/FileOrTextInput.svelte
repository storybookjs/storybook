<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<HTMLInputAttributes, 'type'> &
    (
      | {
          /** Input type. */
          type: 'file';
          /** Selected files. */
          files?: FileList;
        }
      | {
          /** Input type. */
          type?: 'text' | 'email';
          files?: undefined;
        }
    );

  let { value = $bindable(), type, files = $bindable(), ...restProps }: Props = $props();
</script>

{#if type === 'file'}
  <input type="file" bind:files {...restProps} />
{:else}
  <input {type} bind:value {...restProps} />
{/if}
