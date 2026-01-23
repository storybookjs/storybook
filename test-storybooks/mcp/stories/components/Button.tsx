import React from 'react';
import './button.css';

interface ButtonProps {
	/**
	 * Is this the principal call to action on the page?
	 */
	primary?: boolean;
	/**
	 * What background color to use
	 */
	backgroundColor?: string;
	/**
	 * How large should the button be?
	 */
	size?: 'small' | 'medium' | 'large';
	/**
	 * Button contents
	 */
	label: string;
	/**
	 * Optional click handler
	 */
	onClick?: () => void;
}

/**
 * Primary UI component for user interaction
 *
 * @import import { Button } from '@my-org/my-component-library';
 * @summary A customizable button component for user interactions.
 */
export const Button = ({
	primary = false,
	size = 'medium',
	backgroundColor,
	label,
	...props
}: ButtonProps) => {
	const mode = primary
		? 'storybook-button--primary'
		: 'storybook-button--secondary';
	const truncatedLabel =
		label.length > 30 ? `${label.substring(0, 30)}...` : label;
	return (
		<button
			type="button"
			className={['storybook-button', `storybook-button--${size}`, mode].join(
				' ',
			)}
			style={{ backgroundColor }}
			{...props}
		>
			{truncatedLabel}
		</button>
	);
};
