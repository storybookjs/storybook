import { mcpServerHandler } from './mcp-handler.ts';
import type { PresetProperty } from 'storybook/internal/types';
import { AddonOptions, type AddonOptionsInput } from './types.ts';
import * as v from 'valibot';
import { isManifestAvailable } from './tools/is-manifest-available.ts';
import htmlTemplate from './template.html';

export const experimental_devServer: PresetProperty<
	'experimental_devServer'
> = async (app, options) => {
	const addonOptions = v.parse(AddonOptions, {
		toolsets: (options as AddonOptionsInput).toolsets ?? {},
	});

	app!.post('/mcp', (req, res, next) =>
		mcpServerHandler({
			req,
			res,
			next,
			options,
			addonOptions,
		}),
	);

	const shouldRedirect = await isManifestAvailable(options);

	app!.get('/mcp', async (req, res) => {
		const acceptHeader = req.headers['accept'] || '';

		if (acceptHeader.includes('text/html')) {
			// Browser request - send HTML with redirect
			res.writeHead(200, { 'Content-Type': 'text/html' });

			const html = htmlTemplate.replace(
				'{{REDIRECT_META}}',
				shouldRedirect
					? // redirect the user to the component manifest page after 10 seconds
						'<meta http-equiv="refresh" content="10;url=/manifests/components.html" />'
					: // ... or hide the message about redirection
						'<style>#redirect-message { display: none; }</style>',
			);
			res.end(html);
		} else {
			// Non-browser request (API, curl, etc.) - send plain text
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end(
				'Storybook MCP server successfully running via @storybook/addon-mcp',
			);
		}
	});
	return app;
};
