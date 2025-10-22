import type { Plugin } from 'vite';
import { mcpServerHandler } from './mcp-handler';
import type { Options } from 'storybook/internal/types';

// This is a workaround for Storybook not having an API for addons to register server middlewares/handlers
// We can do it through Vite's plugin API instead, which gets added to Storybook's dev server in the end. 😈
export const viteFinal = async (config: any, options: Options) => {
	const mcpHandlerPlugin: Plugin = {
		name: 'storybook:mcp-server',
		configureServer(server) {
			server.middlewares.use('/mcp', (req, res, next) =>
				mcpServerHandler(req, res, next, options),
			);
		},
	};
	return {
		...config,
		plugins: config.plugins.concat(mcpHandlerPlugin),
	};
};
