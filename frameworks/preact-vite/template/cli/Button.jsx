import './button.css';

/**
 * Primary UI component for user interaction
 *
 * @param {object} props
 * @param {string} [props.primary=false] Default is `false`
 * @param {string} [props.backgroundColor]
 * @param {'small' | 'medium' | 'large'} [props.size='medium'] Default is `'medium'`
 * @param {string} props.label
 * @param {function} props.onClick
 */
export const Button = ({
  primary = false,
  backgroundColor = null,
  size = 'medium',
  label,
  ...props
}) => {
  const mode = primary ? 'storybook-button--primary' : 'storybook-button--secondary';
  return (
    <button
      type="button"
      className={['storybook-button', `storybook-button--${size}`, mode].join(' ')}
      style={backgroundColor && { backgroundColor }}
      {...props}
    >
      {label}
    </button>
  );
};
