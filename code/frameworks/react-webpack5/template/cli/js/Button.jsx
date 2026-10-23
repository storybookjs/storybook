import './button.css';

/**
 * Primary UI component for user interaction
 *
 * @param {object} props
 * @param {boolean} [props.primary=false] Is this the principal call to action on the page?
 * @param {string} [props.backgroundColor] What background color to use
 * @param {'small' | 'medium' | 'large'} [props.size='medium'] How large should the button be?
 * @param {string} props.label Button contents
 * @param {() => void} [props.onClick] Optional click handler
 */
export const Button = ({
  primary = false,
  backgroundColor,
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
