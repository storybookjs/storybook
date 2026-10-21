import { mcpServerHandler } from './mcp-handler.ts';
import type { PresetPropertyFn, StorybookConfigRaw } from 'storybook/internal/types';
import { AddonOptions, type AddonOptionsInput } from './types.ts';
import * as v from 'valibot';
import {
  createLocalDocsAccess,
  getEffectiveToolAvailability,
  getToolAvailability,
  isValidHost,
  loadManifests,
} from 'storybook/internal/core-server';
import { isWebContainer } from 'storybook/internal/common';
import htmlTemplate from './template.html';
import path from 'node:path';
import { extractBearerToken, type ManifestProvider } from './auth/index.ts';
import { resolveCompositionSources } from './auth/resolve-composition-sources.ts';
import { logger } from 'storybook/internal/node-logger';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DEFAULT_MCP_ENDPOINT } from './constants.ts';
import { getStoryIndex } from './utils/get-story-index.ts';

export const previewAnnotations: PresetPropertyFn<'previewAnnotations'> = async (
  existingAnnotations = []
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

  const basePath = options.basePath ?? '/';
  const origin = `http://localhost:${options.port}`;
  const baseUrl = `${origin}${basePath.replace(/\/$/, '')}`;
  logger.debug(`MCP server base URL: ${baseUrl}`);
  const endpoint = addonOptions.endpoint ?? DEFAULT_MCP_ENDPOINT;

  const core = await options.presets.apply('core', {});
  const hostValidation = {
    host: options.host,
    allowedHosts: core?.allowedHosts,
    localAddress: options.localAddress,
    networkAddress: options.networkAddress,
  };

  // Needed for e.g. StackBlitz. Not running on developer machines so skipping validation is ok.
  const skipOriginValidation = isWebContainer();

  // Request middleware rejecting invalid origin or host configuration.
  const rejectDisallowedOrigin = (req: IncomingMessage, res: ServerResponse): boolean => {
    if (skipOriginValidation) {
      return false;
    }

    // MCP clients are not browsers and send no Origin header. We only need to check the Origin
    // of Web clients for DNS rebinding attacks, which browsers will attach for us.
    // See https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http.
    const { origin: requestOrigin } = req.headers;
    if (!requestOrigin) {
      return false;
    }

    // Check host validity.
    try {
      if (isValidHost(new URL(requestOrigin).host, hostValidation)) {
        return false;
      }
    } catch {}

    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Invalid origin');
    return true;
  };

  // When allowedHosts or --host relax origin validation, a web page can still reach this endpoint
  // cross-origin. Requiring application/json makes the browser send a CORS preflight first, which
  // this server never approves, so the request is never sent. Only the type before `;` counts:
  // `text/plain; x=application/json` is still a safelisted type and needs no preflight.
  const rejectNonJsonBody = (req: IncomingMessage, res: ServerResponse): boolean => {
    const mediaType = req.headers['content-type']?.split(';')[0].trim().toLowerCase();
    if (mediaType === 'application/json') {
      return false;
    }

    res.writeHead(415, { 'Content-Type': 'text/plain' });
    res.end('Unsupported Media Type: Content-Type must be application/json');
    return true;
  };

  const { refs, compositionAuth, sources, multiSource } = await resolveCompositionSources(options);

  // Composition (multi-source) is the only remaining consumer of the manifest-provider plumbing:
  // single-source docs tools read the registered docs toolset instead. In docgen-server mode core
  // 404s the local `/manifests/*.json`, so the local source reads this Storybook in-process
  // through the same registration-based access selection the dev server uses when it is not
  // composed — the docgen services when they actually registered, the inline manifests otherwise.
  const rawAvailability = await getToolAvailability(options);
  const localAccess =
    rawAvailability.docgenServer && refs.length > 0
      ? createLocalDocsAccess({
          storyIndex: { getIndex: () => getStoryIndex(options) },
          getManifests: () => loadManifests(options.presets),
        })
      : undefined;

  let createManifestProvider: ((req: IncomingMessage) => ManifestProvider) | undefined;

  if (refs.length > 0) {
    logger.info(`Initialized composition with ${refs.length} remote Storybook(s)`);
    if (compositionAuth.requiresAuth) {
      logger.info(`Auth required for: ${compositionAuth.authUrls.join(', ')}`);
    }

    logger.info(`Sources: ${(sources ?? []).map((s) => s.id).join(', ')}`);

    // Remote sources are fetched over HTTP; the local one is read through `localAccess` when
    // docgen-server mode is on, and over HTTP from this base URL otherwise.
    createManifestProvider = () => compositionAuth.createManifestProvider(baseUrl);
  }

  const manifestAccessFor = (req: IncomingMessage) => ({
    manifestProvider: createManifestProvider?.(req),
    localAccess,
  });

  // Serve .well-known/oauth-protected-resource for MCP auth
  app!.get('/.well-known/oauth-protected-resource', (_req, res) => {
    const wellKnown = compositionAuth.buildWellKnown(`${baseUrl}${endpoint}`);
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
    if (compositionAuth.requiresAuth && !token) {
      res.writeHead(401, {
        'Content-Type': 'text/plain',
        'WWW-Authenticate': compositionAuth.buildWwwAuthenticate(baseUrl),
      });
      res.end('401 - Unauthorized');
      return true;
    }
    return false;
  };

  app!.post(endpoint, (req, res) => {
    if (rejectDisallowedOrigin(req, res)) return;
    if (requireAuth(req, res)) return;
    if (rejectNonJsonBody(req, res)) return;

    return mcpServerHandler({
      req,
      res,
      options,
      addonOptions,
      origin,
      baseUrl,
      endpoint,
      sources,
      ...manifestAccessFor(req),
      compositionAuth,
    });
  });

  // Same gates the MCP server uses to register these tools, so the page can't
  // claim a tool is available when it isn't (and vice versa).
  const {
    moduleGraphSupported,
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
    if (rejectDisallowedOrigin(req, res)) return;
    if (!req.headers['accept']?.includes('text/html')) {
      if (requireAuth(req, res)) return;

      return mcpServerHandler({
        req,
        res,
        options,
        addonOptions,
        origin,
        baseUrl,
        endpoint,
        sources,
        ...manifestAccessFor(req),
        compositionAuth,
      });
    }

    // Browser request - send HTML
    res.writeHead(200, { 'Content-Type': 'text/html' });

    let docsNotice = '';
    if (!docsHasManifests) {
      // Manifests come from the React frameworks, angular-vite and vue3-vite. If the feature is
      // already on and there is still no manifest, the framework is the reason, not the config.
      docsNotice = docsFeatureEnabled
        ? `<div class="toolset-notice">
				This toolset requires a components manifest, which your framework does not generate. On <code>@storybook/vue3-vite</code>, also enable <code>docgenServer</code>.
				<a target="_blank" href="https://storybook.js.org/docs/ai/mcp/overview#framework-support">See which frameworks are supported</a>
			</div>`
        : `<div class="toolset-notice">
				This toolset requires a components manifest, which is generated by the React frameworks, <code>@storybook/angular-vite</code> and <code>@storybook/vue3-vite</code>. Enable the <code>componentsManifest</code> feature, plus <code>docgenServer</code> on <code>@storybook/vue3-vite</code>.
				<a target="_blank" href="https://storybook.js.org/docs/ai/mcp/overview#framework-support">Learn how to enable it</a>
			</div>`;
    } else if (!docsFeatureEnabled) {
      docsNotice = `<div class="toolset-notice">
				This toolset requires enabling the component manifest feature.
				<a target="_blank" href="https://github.com/storybookjs/storybook/tree/next/code/addons/mcp">Learn how to enable it</a>
			</div>`;
    }

    const testNoticeLines = [
      !testSupported &&
        `This toolset requires Storybook 10.3.0+ with <code>@storybook/addon-vitest</code>. <a target="_blank" href="https://storybook.js.org/docs/writing-tests/integrations/vitest-addon#install-and-set-up">Learn how to set it up</a>`,
      !a11yEnabled &&
        `Add <code>@storybook/addon-a11y</code> for accessibility testing. <a target="_blank" href="https://storybook.js.org/docs/writing-tests/accessibility-testing">Learn more</a>`,
    ].filter(Boolean);
    const testNotice = testNoticeLines.length
      ? `<div class="toolset-notice">${testNoticeLines.join('<br>')}</div>`
      : '';

    const a11yBadge = a11yEnabled
      ? ' <span class="toolset-status enabled">+ accessibility</span>'
      : '';

    // `stories-find-by-component` also needs the dependency graph, so it shows its own badge.
    // When the whole `dev` toolset is turned off via addon options every dev tool is
    // disabled regardless of its own gate, so explain that instead of the per-tool reason.
    const devNoticeLines = !isDevEnabled
      ? [`The <code>dev</code> toolset is disabled via addon options.`]
      : [
          !moduleGraphSupported &&
            `<code>stories-find-by-component</code> requires a dev server with a builder that supports the module graph (Vite or Webpack 5).`,
        ].filter(Boolean);
    const devNotice = devNoticeLines.length
      ? `<div class="toolset-notice">${devNoticeLines.join('<br>')}</div>`
      : '';

    const html = htmlTemplate
      .replaceAll('{{DEV_STATUS}}', isDevEnabled ? 'enabled' : 'disabled')
      .replaceAll(
        '{{STORIES_BY_COMPONENT_STATUS}}',
        isDevEnabled && moduleGraphSupported ? 'enabled' : 'disabled'
      )
      .replace('{{DEV_NOTICE}}', devNotice)
      .replaceAll('{{DOCS_STATUS}}', isDocsEnabled ? 'enabled' : 'disabled')
      .replace('{{DOCS_NOTICE}}', docsNotice)
      .replaceAll('{{TEST_STATUS}}', isTestEnabled ? 'enabled' : 'disabled')
      .replace('{{TEST_NOTICE}}', testNotice)
      .replace(
        '{{MANIFEST_DEBUGGER_LINK}}',
        rawAvailability.docsEnabled
          ? `<p>View the <a href="${basePath}manifests/components.html">component manifest debugger</a>.</p>`
          : ''
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
