import { mcpServerHandler } from './mcp-handler.ts';
import type { PresetProperty } from 'storybook/internal/types';
import { AddonOptions } from './types.ts';
import * as v from 'valibot';

export const experimental_devServer: PresetProperty<
	'experimental_devServer'
> = (app, options) => {
	const addonOptions = v.parse(AddonOptions, {
		toolsets: (options as any).toolsets ?? {},
	});

	app!.use('/mcp', (req, res, next) =>
		mcpServerHandler({
			req,
			res,
			next,
			options,
			addonOptions,
		}),
	);
	return app;
};
