<script lang="ts">
  import type { CheckboxRootProps } from './primitive.js';

  type Props = Omit<CheckboxRootProps, 'ref'>;

  let { checked = $bindable(false), class: className, ...restProps }: Props = $props();
</script>

<button class={className} role="checkbox" aria-checked={checked} {...restProps}></button>
