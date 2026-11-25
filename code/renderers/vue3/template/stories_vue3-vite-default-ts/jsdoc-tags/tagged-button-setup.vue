<script setup lang="ts">
/**
 * Component docblock description.
 *
 * @summary Component summary
 * @describe Component describe text
 * @import import { TaggedButtonSetup } from '@example/tagged-button-setup';
 * @deprecated Component deprecated note
 * @example <TaggedButtonSetup label="Component example" />
 * @since 1.0.0
 */
defineOptions({ name: 'TaggedButtonSetup' });

withDefaults(
  defineProps<{
    /**
     * The button text.
     *
     * @deprecated Use the default slot instead.
     */
    label?: string;
    /**
     * The button size.
     *
     * @default 'medium'
     */
    size?: 'small' | 'medium' | 'large';
    /**
     * A prop that docgen should hide.
     *
     * @ignore
     */
    internalId?: string;
    /**
     * Called when the button is clicked.
     *
     * @param event The click event.
     * @returns Nothing.
     */
    onClick?: (event: MouseEvent) => void;
    /**
     * The button style.
     *
     * @example <TaggedButtonSetup variant="primary" />
     * @since 1.0.0
     */
    variant?: 'primary' | 'secondary';
  }>(),
  { size: 'medium' }
);
</script>

<template>
  <button type="button" :data-size="size" @click="onClick">
    <slot>{{ label }}</slot>
  </button>
</template>
