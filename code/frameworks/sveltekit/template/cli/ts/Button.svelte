<script lang="ts">
  import './button.css';

  interface Props {
    /**
     * The variant of the button
     *
     * @default primary
     */
    variant?: 'primary' | 'secondary' | 'flat';
    /** What background color to use */
    backgroundColor?: string;
    /** How large should the button be? */
    size?: 'small' | 'medium' | 'large';
    /** Button contents */
    label: string;
    /** The onclick event handler */
    onclick?: () => void;
  }

  const {
    variant = 'primary',
    backgroundColor,
    size = 'medium',
    label,
    ...props
  }: Props = $props();

  const variantToClass = {
    primary: 'storybook-button--primary',
    secondary: 'storybook-button--secondary',
    flat: '',
  };

  let mode = $derived(variantToClass[variant]);
  let style = $derived(backgroundColor ? `background-color: ${backgroundColor}` : '');
</script>

<button
  type="button"
  class={['storybook-button', `storybook-button--${size}`, mode].join(' ')}
  {style}
  {...props}
>
  {label}
</button>
