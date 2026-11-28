<!--
@component
Component docblock description.

@summary Component summary
@describe Component describe text
@import import { TaggedButton } from '@example/tagged-button';
@deprecated Component deprecated note
@example <TaggedButton label="Component example" />
@since 1.0.0
-->
<script lang="ts">
  interface Props {
    /**
     * The button text.
     *
     * @deprecated Use `children` instead.
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
    onclick?: (event: MouseEvent) => void;
    /**
     * The button style.
     *
     * @example <TaggedButton variant="primary" />
     * @since 1.0.0
     */
    variant?: 'primary' | 'secondary';
  }

  const { label, size = 'medium', onclick }: Props = $props();
</script>

<button type="button" data-size={size} {onclick}>{label}</button>
