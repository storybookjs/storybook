<script lang="ts">
import { defineComponent, type PropType } from 'vue';

/**
 * Component docblock description.
 *
 * @summary Component summary
 * @describe Component describe text
 * @import import { TaggedButton } from '@example/tagged-button';
 * @deprecated Component deprecated note
 * @example <TaggedButton label="Component example" />
 * @since 1.0.0
 */
export default defineComponent({
  name: 'TaggedButton',
  props: {
    /**
     * The button text.
     *
     * @deprecated Use the default slot instead.
     */
    label: { type: String },
    /**
     * The button size.
     *
     * @default 'medium'
     */
    size: { type: String as PropType<'small' | 'medium' | 'large'> },
    /**
     * A prop that docgen should hide.
     *
     * @ignore
     */
    internalId: { type: String },
    /**
     * Called when the button is clicked.
     *
     * @param event The click event.
     * @returns Nothing.
     */
    onClick: { type: Function as PropType<(event: MouseEvent) => void> },
    /**
     * The button style.
     *
     * @example <TaggedButton variant="primary" />
     * @since 1.0.0
     */
    variant: { type: String as PropType<'primary' | 'secondary'> },
  },
});
</script>

<template>
  <button type="button" :data-size="size" @click="onClick">
    <slot>{{ label }}</slot>
  </button>
</template>
