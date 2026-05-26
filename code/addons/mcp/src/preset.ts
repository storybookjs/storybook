import { mcpServerHandler } from './mcp-handler.ts';
import type { PresetPropertyFn, StorybookConfigRaw } from 'storybook/internal/types';
import { AddonOptions, type AddonOptionsInput } from './types.ts';
import * as v from 'valibot';
import { getManifestStatus } from './tools/is-manifest-available.ts';
import { getAddonVitestConstants } from './tools/run-story-tests.ts';
import { isAddonA11yEnabled } from './utils/is-addon-a11y-enabled.ts';
import htmlTemplate from './template.html';
import path from 'node:path';
import {
	CompositionAuth,
	STORYBOOK_MCP_PROXY_HEADER,
	extractBearerToken,
	isStorybookMcpProxyRequest as hasStorybookMcpProxyHeader,
	type ComposedRef,
	type ManifestProvider,
} from './auth/index.ts';
import { logger } from 'storybook/internal/node-logger';
import type { Source } from '@storybook/mcp';
import { DISPLAY_REVIEW_EVENT, REQUEST_REVIEW_EVENT } from './constants.ts';
import { getReviewState } from './review-state-store.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';

const DEFAULT_MCP_ENDPOINT = '/mcp';
const STORYBOOK_MCP_PROXY_HEADER_KEY = STORYBOOK_MCP_PROXY_HEADER.toLowerCase();

export const previewAnnotations: PresetPropertyFn<'previewAnnotations'> = async (
	existingAnnotations = [],
) => {
	return [...existingAnnotations, path.join(import.meta.dirname, 'preview.js')];
};

export const experimental_devServer: PresetPropertyFn<
	'experimental_devServer',
	StorybookConfigRaw,
	AddonOptionsInput
> = async (app, options) => {
	// There is no error handling here. This can make the whole storybook app crash with:
	// ValiError: Invalid type: Expected boolean but received "false"
	const addonOptions = v.parse(AddonOptions, {
		endpoint: options.endpoint,
		toolsets: options.toolsets ?? {},
	});
	const features = await options.presets.apply('features', {});
	const changeDetectionEnabled = features?.changeDetection ?? false;

	const origin = `http://localhost:${options.port}`;
	const endpoint = addonOptions.endpoint ?? DEFAULT_MCP_ENDPOINT;

	// Replay the cached review state to any Storybook tab that mounts or
	// refreshes after the agent already pushed. The tab emits
	// `request-review`; we re-emit the cached state so it converges.
	// The cache is the module singleton shared with the display-review tool.
	//
	// Older Storybooks (≤10.3) don't pass `options.channel` to dev-server
	// presets — the rest of addon-mcp still works without channel replay,
	// so guard rather than crash.
	if (changeDetectionEnabled) {
		if (options.channel?.on) {
			options.channel.on(REQUEST_REVIEW_EVENT, () => {
				const state = getReviewState();
				if (state) {
					options.channel?.emit?.(DISPLAY_REVIEW_EVENT, state);
				}
			});
		} else {
			logger.info(
				'[addon-mcp] options.channel is unavailable on this Storybook version; review-state replay disabled.',
			);
		}
	}

	// Get composed Storybook refs from config
	const refs = await getRefsFromConfig(options);
	const compositionAuth = new CompositionAuth();

	// Build sources and manifest provider
	let sources: Source[] | undefined;
	let createManifestProvider: ((req: IncomingMessage) => ManifestProvider) | undefined;

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
		createManifestProvider = (req) =>
			compositionAuth.createManifestProvider(origin, {
				requiresOwnMcpForUnauthenticatedRequests: isStorybookMcpProxyHttpRequest(req),
			});
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

	const requireAuth = (req: IncomingMessage, res: ServerResponse): boolean => {
		const token = extractBearerToken(req.headers['authorization']);
		if (compositionAuth.requiresAuth && !token && !isStorybookMcpProxyHttpRequest(req)) {
			res.writeHead(401, {
				'Content-Type': 'text/plain',
				'WWW-Authenticate': compositionAuth.buildWwwAuthenticate(origin),
			});
			res.end('401 - Unauthorized');
			return true;
		}
		return false;
	};

	app!.post(endpoint, (req, res) => {
		if (requireAuth(req, res)) return;

		return mcpServerHandler({
			req,
			res,
			options,
			addonOptions,
			endpoint,
			sources,
			manifestProvider: createManifestProvider?.(req),
			compositionAuth,
		});
	});

	const manifestStatus = await getManifestStatus(options);
	const addonVitestConstants = await getAddonVitestConstants();
	const a11yEnabled = await isAddonA11yEnabled(options);

	const isDevEnabled = addonOptions.toolsets?.dev ?? true;
	const isDocsEnabled = manifestStatus.available && (addonOptions.toolsets?.docs ?? true);
	const isTestEnabled = !!addonVitestConstants && (addonOptions.toolsets?.test ?? true);

	app!.get(endpoint, (req, res) => {
		if (!req.headers['accept']?.includes('text/html')) {
			if (requireAuth(req, res)) return;

			return mcpServerHandler({
				req,
				res,
				options,
				addonOptions,
				endpoint,
				sources,
				manifestProvider: createManifestProvider?.(req),
				compositionAuth,
			});
		}

		// Browser request - send HTML
		res.writeHead(200, { 'Content-Type': 'text/html' });

		let docsNotice = '';
		if (!manifestStatus.hasManifests) {
			docsNotice = `<div class="toolset-notice">
				This toolset is only supported in React-based setups.
			</div>`;
		} else if (!manifestStatus.hasFeatureFlag) {
			docsNotice = `<div class="toolset-notice">
				This toolset requires enabling the component manifest feature.
				<a target="_blank" href="https://github.com/storybookjs/mcp/tree/main/packages/addon-mcp#docs-tools-experimental">Learn how to enable it</a>
			</div>`;
		}

		const testNoticeLines = [
			!addonVitestConstants &&
				`This toolset requires Storybook 10.3.0+ with <code>@storybook/addon-vitest</code>. <a target="_blank" href="https://storybook.js.org/docs/writing-tests/test-addon">Learn how to set it up</a>`,
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
			.replaceAll('{{DEV_STATUS}}', isDevEnabled ? 'enabled' : 'disabled')
			.replaceAll('{{DOCS_STATUS}}', isDocsEnabled ? 'enabled' : 'disabled')
			.replace('{{DOCS_NOTICE}}', docsNotice)
			.replaceAll('{{TEST_STATUS}}', isTestEnabled ? 'enabled' : 'disabled')
			.replace('{{TEST_NOTICE}}', testNotice)
			.replace(
				'{{MANIFEST_DEBUGGER_LINK}}',
				manifestStatus.available
					? '<p>View the <a href="/manifests/components.html">component manifest debugger</a>.</p>'
					: '',
			)
			.replace('{{A11Y_BADGE}}', a11yBadge);
		res.end(html);
	});
	return app;
};

export const features: PresetPropertyFn<'features'> = async (existingFeatures) => {
	return {
		...existingFeatures,
		componentsManifest: true,
	};
};

function isStorybookMcpProxyHttpRequest(req: IncomingMessage): boolean {
	const headerValue =
		req.headers[STORYBOOK_MCP_PROXY_HEADER_KEY] ?? req.headers[STORYBOOK_MCP_PROXY_HEADER];
	return hasStorybookMcpProxyHeader(headerValue);
}

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
