import { mcpServerHandler } from './mcp-handler.ts';
import type { PresetProperty } from 'storybook/internal/types';
import { AddonOptions } from './types.ts';
import * as v from 'valibot';
import { getManifestStatus } from './tools/is-manifest-available.ts';
import htmlTemplate from './template.html';

export const experimental_devServer: PresetProperty<
	'experimental_devServer'
> = async (app, options) => {
	// There is no error handling here. This can make the whole storybook app crash with:
	// ValiError: Invalid type: Expected boolean but received "false"
	const addonOptions = v.parse(AddonOptions, {
		toolsets: 'toolsets' in options ? options.toolsets : {},
		experimentalFormat:
			'experimentalFormat' in options ? options.experimentalFormat : 'markdown',
	});

	app!.post('/mcp', (req, res) =>
		mcpServerHandler({
			req,
			res,
			options,
			addonOptions,
		}),
	);

	const manifestStatus = await getManifestStatus(options);

	const isDevEnabled = addonOptions.toolsets?.dev ?? true;
	const isDocsEnabled =
		manifestStatus.available && (addonOptions.toolsets?.docs ?? true);

	app!.get('/mcp', (req, res) => {
		if (!req.headers['accept']?.includes('text/html')) {
			return mcpServerHandler({ req, res, options, addonOptions });
		}

		// Browser request - send HTML with redirect
		res.writeHead(200, { 'Content-Type': 'text/html' });

		let docsNotice = '';
		if (!manifestStatus.hasGenerator) {
			docsNotice = `<div class="toolset-notice">
				This toolset is only supported in React-based setups.
			</div>`;
		} else if (!manifestStatus.hasFeatureFlag) {
			docsNotice = `<div class="toolset-notice">
				This toolset requires enabling the experimental component manifest feature.
				<a target="_blank" href="https://github.com/storybookjs/mcp/tree/main/packages/addon-mcp#docs-tools-experimental">Learn how to enable it</a>
			</div>`;
		}

		const html = htmlTemplate
			.replace(
				'{{REDIRECT_META}}',
				manifestStatus.available
					? // redirect the user to the component manifest page after 10 seconds
						'<meta http-equiv="refresh" content="10;url=/manifests/components.html" />'
					: // ... or hide the message about redirection
						'<style>#redirect-message { display: none; }</style>',
			)
			.replaceAll('{{DEV_STATUS}}', isDevEnabled ? 'enabled' : 'disabled')
			.replaceAll('{{DOCS_STATUS}}', isDocsEnabled ? 'enabled' : 'disabled')
			.replace('{{DOCS_NOTICE}}', docsNotice);
		res.end(html);
	});
	return app;
};
