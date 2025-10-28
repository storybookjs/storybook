import { mcpServerHandler } from './mcp-handler.ts';
import type { PresetProperty } from 'storybook/internal/types';

export const experimental_devServer: PresetProperty<
	'experimental_devServer'
> = (app, options) => {
	app!.use('/mcp', (req, res, next) =>
		mcpServerHandler(req, res, next, options),
	);
	return app;
};
