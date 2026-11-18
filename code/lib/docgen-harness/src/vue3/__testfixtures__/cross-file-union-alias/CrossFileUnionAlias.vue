<script setup lang="ts">
// Reproduces #29354: literal-union type aliases imported from another file are
// recorded by name only ("ButtonVariant") - the literals are never unfolded,
// so Controls render a text input instead of options.
import type { ButtonSize, ButtonVariant } from './button-types.ts';

interface Props {
  /** Visual variant, an imported literal-union alias. */
  variant?: ButtonVariant;
  /** Control size, an imported literal-union alias. */
  size?: ButtonSize;
}

withDefaults(defineProps<Props>(), { variant: 'primary', size: 'medium' });
</script>

<template>
  <button :class="[variant, size]"><slot /></button>
</template>
