import React from 'react';
import './card.css';

interface CardProps {
	/**
	 * Card title
	 */
	title: string;
	/**
	 * Image URL
	 */
	imageUrl: string;
	/**
	 * Image alt text
	 */
	imageAlt?: string;
	/**
	 * Text content
	 */
	content: string;
	/**
	 * Action button text
	 */
	actionText: string;
	/**
	 * Action button click handler
	 */
	onClick: () => void;
}

/**
 * Card component with title, image, content, and action button
 */
export const Card = ({ title, imageUrl, imageAlt, content, actionText, onClick }: CardProps) => {
	return (
		<div className="storybook-card">
			<h3 className="storybook-card__title">{title}</h3>
			<img src={imageUrl} alt={imageAlt || title} className="storybook-card__image" />
			<p className="storybook-card__content">{content}</p>
			<button type="button" className="storybook-card__button" onClick={onClick}>
				{actionText}
			</button>
		</div>
	);
};
