<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  import type { Validator } from './types.ts';

  type Props = {
    /** CSS class string. */
    class?: string;
    /** Input element reference. */
    input?: HTMLInputElement;
    /** Current input value. */
    value?: string;
    /** Font family choice. */
    font?: 'mono' | 'normal';
    /** Value change callback. */
    onchange?: (v: string, valid: boolean) => void;
    /** Validation function or functions. */
    validate?: Validator | Validator[];
  } & Omit<HTMLInputAttributes, 'onchange' | 'oninput'>;

  let {
    class: className = '',
    input = $bindable(),
    value = $bindable(''),
    type = 'text',
    font = 'normal',
    onchange,
    validate,
    ...rest
  }: Props = $props();

  function isValid(nextValue: string): boolean {
    const validators = Array.isArray(validate) ? validate : validate ? [validate] : [];
    return validators.every((validator) => validator(nextValue));
  }
</script>

<input
  bind:this={input}
  bind:value
  class={className}
  {type}
  data-font={font}
  oninput={() => onchange?.(value, isValid(value))}
  {...rest}
/>
