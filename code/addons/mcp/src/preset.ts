import { mcpServerHandler } from './mcp-handler.ts';
import type { PresetPropertyFn, StorybookConfigRaw } from 'storybook/internal/types';
import { AddonOptions, type AddonOptionsInput } from './types.ts';
import * as v from 'valibot';
import {
	getEffectiveToolAvailability,
	getToolAvailability,
} from './utils/get-tool-availability.ts';
import htmlTemplate from './template.html';
import path from 'node:path';
import {
	STORYBOOK_MCP_PROXY_HEADER,
	extractBearerToken,
	isStorybookMcpProxyRequest as hasStorybookMcpProxyHeader,
	type ManifestProvider,
} from './auth/index.ts';
import { resolveCompositionSources } from './auth/resolve-composition-sources.ts';
import { logger } from 'storybook/internal/node-logger';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DEFAULT_MCP_ENDPOINT } from './constants.ts';
import { buildStorybookAiMetadata, type StorybookAiMetadata } from './storybook-ai-metadata.ts';

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

	const origin = `http://localhost:${options.port}`;
	const endpoint = addonOptions.endpoint ?? DEFAULT_MCP_ENDPOINT;

	const { refs, compositionAuth, sources } = await resolveCompositionSources(options);
	let createManifestProvider: ((req: IncomingMessage) => ManifestProvider) | undefined;

	if (refs.length > 0) {
		logger.info(`Initialized composition with ${refs.length} remote Storybook(s)`);
		if (compositionAuth.requiresAuth) {
			logger.info(`Auth required for: ${compositionAuth.authUrls.join(', ')}`);
		}

		logger.info(`Sources: ${(sources ?? []).map((s) => s.id).join(', ')}`);

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

	// Same gates the MCP server uses to register these tools, so the page can't
	// claim a tool is available when it isn't (and vice versa).
	const multiSource = sources?.some((source) => !!source.url) ?? false;
	const rawAvailability = await getToolAvailability(options);
	const {
		moduleGraphSupported,
		changeDetectionEnabled,
		reviewEnabled,
		docsEnabled,
		docsHasManifests,
		docsFeatureEnabled,
		testSupported,
		a11yEnabled,
	} = getEffectiveToolAvailability(rawAvailability, { multiSource });

	const isDevEnabled = addonOptions.toolsets?.dev ?? true;
	const isDocsEnabled = docsEnabled && (addonOptions.toolsets?.docs ?? true);
	const isTestEnabled = testSupported && (addonOptions.toolsets?.test ?? true);

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
		if (!docsHasManifests) {
			docsNotice = `<div class="toolset-notice">
				This toolset is only supported in React-based setups.
			</div>`;
		} else if (!docsFeatureEnabled) {
			docsNotice = `<div class="toolset-notice">
				This toolset requires enabling the component manifest feature.
				<a target="_blank" href="https://github.com/storybookjs/mcp/tree/main/packages/addon-mcp#docs-tools-experimental">Learn how to enable it</a>
			</div>`;
		}

		const testNoticeLines = [
			!testSupported &&
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

		// `get-stories-by-component`, `get-changed-stories`, and `display-review` are gated
		// independently of the `dev` toolset (they need the dependency graph and the change-detection
		// feature flag respectively), so each shows its own badge.
		// When the whole `dev` toolset is turned off via addon options every dev tool is
		// disabled regardless of its own gate, so explain that instead of the per-tool reasons.
		const devNoticeLines = !isDevEnabled
			? [`The <code>dev</code> toolset is disabled via addon options.`]
			: [
					!moduleGraphSupported &&
						`<code>get-stories-by-component</code> requires a dev server with a builder that supports the module graph (e.g. Vite).`,
					!changeDetectionEnabled &&
						`<code>get-changed-stories</code> requires enabling the <code>changeDetection</code> feature flag.`,
					!reviewEnabled &&
						`<code>display-review</code> requires the <code>changeDetection</code> feature flag.`,
				].filter(Boolean);
		const devNotice = devNoticeLines.length
			? `<div class="toolset-notice">${devNoticeLines.join('<br>')}</div>`
			: '';

		const statusWord = (enabled: boolean) => (enabled ? 'enabled' : 'disabled');

		const html = htmlTemplate
			.replaceAll('{{DEV_STATUS}}', isDevEnabled ? 'enabled' : 'disabled')
			.replaceAll(
				'{{STORIES_BY_COMPONENT_STATUS}}',
				statusWord(isDevEnabled && moduleGraphSupported),
			)
			.replaceAll('{{CHANGE_DETECTION_STATUS}}', statusWord(isDevEnabled && changeDetectionEnabled))
			.replaceAll('{{REVIEW_STATUS}}', statusWord(isDevEnabled && reviewEnabled))
			.replace('{{DEV_NOTICE}}', devNotice)
			.replaceAll('{{DOCS_STATUS}}', isDocsEnabled ? 'enabled' : 'disabled')
			.replace('{{DOCS_NOTICE}}', docsNotice)
			.replaceAll('{{TEST_STATUS}}', isTestEnabled ? 'enabled' : 'disabled')
			.replace('{{TEST_NOTICE}}', testNotice)
			.replace(
				'{{MANIFEST_DEBUGGER_LINK}}',
				rawAvailability.docsEnabled
					? '<p>View the <a href="/manifests/components.html">component manifest debugger</a>.</p>'
					: '',
			)
			.replace('{{A11Y_BADGE}}', a11yBadge);
		res.end(html);
	});
	return app;
};

export const experimental_storybookAi = async (
	existingMetadata: StorybookAiMetadata | undefined,
	options: Parameters<typeof buildStorybookAiMetadata>[0],
): Promise<StorybookAiMetadata> => {
	return buildStorybookAiMetadata(options, existingMetadata);
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
