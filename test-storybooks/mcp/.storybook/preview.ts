import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/,
			},
		},
		a11y: {
			test: 'todo',
		},
	},
	initialGlobals: {
		background: { value: 'light' },
	},
};

export default preview;
