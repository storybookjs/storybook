import type { Preview } from '@storybook/react-vite';
import React from 'react';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { Reshaped } from 'reshaped';
import 'reshaped/themes/slate/theme.css';

initialize();

const preview: Preview = {
	decorators: [
		(Story) => (
			<Reshaped theme="slate">
				<Story />
			</Reshaped>
		),
	],
	loaders: [mswLoader],
	parameters: {
		options: {
			storySort: {
				order: ['Summary', 'Conversation', 'Build', 'Typecheck', 'Lint', 'Source'],
			},
		},
	},
};

export default preview;
