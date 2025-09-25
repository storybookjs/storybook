import React from 'react';

export interface ButtonProps {
  /** The text content of the button */
  label: string;

  /** Whether the button is disabled */
  disabled?: boolean;

  /** The size variant of the button */
  size?: 'small' | 'medium' | 'large';

  /** The visual variant of the button */
  variant?: 'primary' | 'secondary' | 'danger';

  /** Callback fired when the button is clicked */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;

  /** Additional CSS classes */
  className?: string;

  /** Whether to show a loading state */
  loading?: boolean;

  /** Icon to display before the label */
  icon?: React.ReactNode;

  /** Custom data attributes */
  'data-testid'?: string;
}

/** A customizable button component with multiple variants and states */
export const Button: React.FC<ButtonProps> = ({
  label,
  disabled = false,
  size = 'medium',
  variant = 'primary',
  onClick,
  className = '',
  loading = false,
  icon,
  'data-testid': testId,
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  const disabledClasses = 'opacity-50 cursor-not-allowed';

  const buttonClasses = [
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    disabled || loading ? disabledClasses : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={onClick}
      data-testid={testId}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {icon && !loading && <span className="mr-2">{icon}</span>}
      {label}
    </button>
  );
};

export default Button;
