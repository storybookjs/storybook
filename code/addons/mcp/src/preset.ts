import { mcpServerHandler } from './mcp-handler.ts';
import type { PresetPropertyFn } from 'storybook/internal/types';
import { AddonOptions } from './types.ts';
import * as v from 'valibot';
import { getManifestStatus } from './tools/is-manifest-available.ts';
import { getAddonVitestConstants } from './tools/run-story-tests.ts';
import { isAddonA11yEnabled } from './utils/is-addon-a11y-enabled.ts';
import htmlTemplate from './template.html';
import path from 'node:path';

export const previewAnnotations: PresetPropertyFn<'previewAnnotations'> = async (
	existingAnnotations = [],
) => {
	return [...existingAnnotations, path.join(import.meta.dirname, 'preview.js')];
};

export const experimental_devServer: PresetPropertyFn<'experimental_devServer'> = async (
	app,
	options,
) => {
	// There is no error handling here. This can make the whole storybook app crash with:
	// ValiError: Invalid type: Expected boolean but received "false"
	const addonOptions = v.parse(AddonOptions, {
		toolsets: 'toolsets' in options ? options.toolsets : {},
		experimentalFormat: 'experimentalFormat' in options ? options.experimentalFormat : 'markdown',
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
	const addonVitestConstants = await getAddonVitestConstants();
	const a11yEnabled = await isAddonA11yEnabled(options);

	const isDevEnabled = addonOptions.toolsets?.dev ?? true;
	const isDocsEnabled = manifestStatus.available && (addonOptions.toolsets?.docs ?? true);
	const isTestEnabled = !!addonVitestConstants && (addonOptions.toolsets?.test ?? true);

	app!.get('/mcp', (req, res) => {
		if (!req.headers['accept']?.includes('text/html')) {
			return mcpServerHandler({ req, res, options, addonOptions });
		}

		// Browser request - send HTML with redirect
		res.writeHead(200, { 'Content-Type': 'text/html' });

		let docsNotice = '';
		if (!manifestStatus.hasManifests) {
			docsNotice = `<div class="toolset-notice">
				This toolset is only supported in React-based setups.
			</div>`;
		} else if (!manifestStatus.hasFeatureFlag) {
			docsNotice = `<div class="toolset-notice">
				This toolset requires enabling the experimental component manifest feature.
				<a target="_blank" href="https://github.com/storybookjs/mcp/tree/main/packages/addon-mcp#docs-tools-experimental">Learn how to enable it</a>
			</div>`;
		}

		const testNoticeLines = [
			!addonVitestConstants &&
				`This toolset requires <code>@storybook/addon-vitest</code>. <a target="_blank" href="https://storybook.js.org/docs/writing-tests/test-addon">Learn how to set it up</a>`,
			!a11yEnabled &&
				`Add <code>@storybook/addon-a11y</code> for accessibility testing. <a target="_blank" href="https://storybook.js.org/docs/writing-tests/accessibility-testing">Learn more</a>`,
		].filter(Boolean);
		const testNotice = testNoticeLines.length
			? `<div class="toolset-notice">${testNoticeLines.join('<br>')}</div>`
			: '';

		const a11yBadge = a11yEnabled
			? ' <span class="toolset-status enabled">+ accessibility</span>'
			: '';

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
			.replace('{{DOCS_NOTICE}}', docsNotice)
			.replaceAll('{{TEST_STATUS}}', isTestEnabled ? 'enabled' : 'disabled')
			.replace('{{TEST_NOTICE}}', testNotice)
			.replace('{{A11Y_BADGE}}', a11yBadge);
		res.end(html);
	});
	return app;
};
