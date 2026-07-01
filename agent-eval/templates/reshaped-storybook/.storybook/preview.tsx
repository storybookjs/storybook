import type { Preview } from '@storybook/react-vite';
import React from 'react';
import { Reshaped } from 'reshaped';
import 'reshaped/themes/slate/theme.css';

const preview: Preview = {
	decorators: [
		(Story) => (
			<Reshaped theme="slate">
				<Story />
			</Reshaped>
		),
	],
	parameters: {
		options: {
			storySort: {
				order: ['Summary', 'Conversation', 'Build', 'Typecheck', 'Lint', 'Source'],
			},
		},
	},
};

export default preview;
