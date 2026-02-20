import { mcpServerHandler } from './mcp-handler.ts';
import type { PresetPropertyFn } from 'storybook/internal/types';
import { AddonOptions } from './types.ts';
import * as v from 'valibot';
import { getManifestStatus } from './tools/is-manifest-available.ts';
import htmlTemplate from './template.html';
import path from 'node:path';
import { CompositionAuth, extractBearerToken, type ComposedRef } from './auth/index.ts';
import { logger } from 'storybook/internal/node-logger';
import type { Source } from '@storybook/mcp';

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
	});

	const origin = `http://localhost:${options.port}`;

	// Get composed Storybook refs from config
	const refs = await getRefsFromConfig(options);
	const compositionAuth = new CompositionAuth();

	// Build sources and manifest provider only if refs are configured
	let sources: Source[] | undefined;
	let manifestProvider:
		| ((request: Request | undefined, path: string, source?: Source) => Promise<string>)
		| undefined;

	if (refs.length > 0) {
		logger.info(`Initializing composition with ${refs.length} remote Storybook(s)`);
		await compositionAuth.initialize(refs);
		if (compositionAuth.requiresAuth) {
			logger.info(`Auth required for: ${compositionAuth.authUrls.join(', ')}`);
		}

		// Build sources array (local + refs)
		sources = compositionAuth.buildSources();
		logger.info(`Sources: ${sources.map((s) => s.id).join(', ')}`);

		// Create manifest provider that handles multi-source
		manifestProvider = compositionAuth.createManifestProvider(origin);
	}

	// Serve .well-known/oauth-protected-resource for MCP auth
	app!.get('/.well-known/oauth-protected-resource', (_req, res) => {
		const wellKnown = compositionAuth.buildWellKnown(origin);
		if (!wellKnown) {
			res.writeHead(404);
			res.end('Not found');
			return;
		}

		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(wellKnown));
	});

	const requireAuth = (
		req: import('node:http').IncomingMessage,
		res: import('node:http').ServerResponse,
	): boolean => {
		const token = extractBearerToken(req.headers['authorization']);
		if (compositionAuth.requiresAuth && !token) {
			res.writeHead(401, {
				'Content-Type': 'text/plain',
				'WWW-Authenticate': compositionAuth.buildWwwAuthenticate(origin),
			});
			res.end('401 - Unauthorized');
			return true;
		}
		return false;
	};

	app!.post('/mcp', (req, res) => {
		if (requireAuth(req, res)) return;

		return mcpServerHandler({
			req,
			res,
			options,
			addonOptions,
			sources,
			manifestProvider,
			compositionAuth,
		});
	});

	const manifestStatus = await getManifestStatus(options);

	const isDevEnabled = addonOptions.toolsets?.dev ?? true;
	const isDocsEnabled = manifestStatus.available && (addonOptions.toolsets?.docs ?? true);

	app!.get('/mcp', (req, res) => {
		if (!req.headers['accept']?.includes('text/html')) {
			if (requireAuth(req, res)) return;

			return mcpServerHandler({
				req,
				res,
				options,
				addonOptions,
				sources,
				manifestProvider,
				compositionAuth,
			});
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

/**
 * Get composed Storybook refs from Storybook config.
 * See: https://storybook.js.org/docs/sharing/storybook-composition
 */
async function getRefsFromConfig(options: any): Promise<ComposedRef[]> {
	try {
		// Get refs from Storybook presets
		const refs = await options.presets.apply('refs', {});

		if (!refs || typeof refs !== 'object') {
			return [];
		}

		// Convert refs object to array, using the config key as the stable ID
		return Object.entries(refs)
			.map(([key, value]: [string, any]) => ({
				id: key,
				title: value.title || key,
				url: value.url,
			}))
			.filter((ref) => ref.url); // Only include refs with URLs
	} catch {
		return [];
	}
}
