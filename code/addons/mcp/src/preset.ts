import { mcpServerHandler } from './mcp-handler.ts';
import type { PresetProperty } from 'storybook/internal/types';
import { AddonOptions } from './types.ts';
import * as v from 'valibot';
import { isManifestAvailable } from './tools/is-manifest-available.ts';
import htmlTemplate from './template.html';

export const experimental_devServer: PresetProperty<
	'experimental_devServer'
> = async (app, options) => {
	// There is error handling here. The can make the whole storybook app crash with.
	// ValiError: Invalid type: Expected boolean but received "false"
	const addonOptions = v.parse(AddonOptions, {
		toolsets: 'toolsets' in options ? options.toolsets : {},
	});

	app!.post('/mcp', (req, res) =>
		mcpServerHandler({
			req,
			res,
			options,
			addonOptions,
		}),
	);

	const shouldRedirect = await isManifestAvailable(options);

	app!.get('/mcp', (req, res) => {
		if (!req.headers['accept']?.includes('text/html')) {
			return mcpServerHandler({ req, res, options, addonOptions });
		}

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
	});
	return app;
};
