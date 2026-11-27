<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface $$Props extends HTMLButtonAttributes {
    label?: string;
  }

  interface $$Events {
    /** Emitted after selection. */
    select: CustomEvent<string>;
  }

  interface $$Slots {
    /** The button content. */
    default: { label: string };
  }

  export let label = 'Select';
  const dispatch = createEventDispatcher<{ select: string }>();
</script>

<!-- @component Button with native attributes, events and slots. -->
<button {...$$restProps} on:click={() => dispatch('select', label)}>
  <slot {label}>{label}</slot>
</button>

<style lang="scss">
  $color: red;
  button {
    color: $color;
    &:hover { color: blue; }
    @for $i from 1 through 3 {
      &:nth-child(#{$i}) { opacity: 0.5; }
    }
  }
</style>
