import type { IncomingMessage, ServerResponse } from 'node:http';

import { isWebContainer } from '@storybook/core/internal/common';
import { logger } from '@storybook/core/internal/node-logger';
import { createLocalDocsAccess } from '@storybook/core/internal/services';
import { loadManifests } from '@storybook/core/internal/story-index';
import type { ServerApp } from '@storybook/core/internal/types';
import {
  getEffectiveToolAvailability,
  getToolAvailability,
  isValidHost,
} from 'storybook/internal/server';

import * as v from 'valibot';

import { extractBearerToken, type ManifestProvider } from '../auth/index.ts';
import { resolveCompositionSources } from '../auth/resolve-composition-sources.ts';
import { DEFAULT_MCP_ENDPOINT } from '../constants.ts';
import { mcpServerHandler } from '../mcp-handler.ts';
import htmlTemplate from '../template.html';
import { AddonOptions, type AddonOptionsInput, type McpServerOptions } from '../types.ts';

/** Serve the MCP endpoint, its landing page, and OAuth metadata on the dev server. */
export async function mountMcpServer(
  app: ServerApp,
  options: McpServerOptions & AddonOptionsInput
): Promise<ServerApp> {
  // Unhandled on purpose: invalid addon options must fail startup.
  const addonOptions = v.parse(AddonOptions, {
    endpoint: options.endpoint,
    toolsets: options.toolsets ?? {},
  });

  const origin = `http://localhost:${options.port}`;
  const endpoint = addonOptions.endpoint ?? DEFAULT_MCP_ENDPOINT;

  const hostValidation = {
    host: options.host,
    allowedHosts: options.core?.allowedHosts,
    localAddress: options.localAddress,
    networkAddress: options.networkAddress,
  };

  // Web containers such as StackBlitz never run on a developer machine.
  const skipOriginValidation = isWebContainer();

  const rejectDisallowedOrigin = (req: IncomingMessage, res: ServerResponse): boolean => {
    if (skipOriginValidation) {
      return false;
    }

    // MCP clients send no Origin; browsers always do, which is what DNS rebinding needs.
    const { origin: requestOrigin } = req.headers;
    if (!requestOrigin) {
      return false;
    }

    try {
      if (isValidHost(new URL(requestOrigin).host, hostValidation)) {
        return false;
      }
    } catch {}

    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Invalid origin');
    return true;
  };

  // A non-safelisted type forces a CORS preflight this server never approves; only the type
  // before `;` counts.
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

  // Composed docgen-server Storybooks 404 the local manifests, so read this one in-process.
  const rawAvailability = await getToolAvailability(options);
  const localAccess =
    rawAvailability.docgenServer && refs.length > 0
      ? createLocalDocsAccess({
          storyIndex: { getIndex: options.getIndex },
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

    createManifestProvider = () => compositionAuth.createManifestProvider(origin);
  }

  const manifestAccessFor = (req: IncomingMessage) => ({
    manifestProvider: createManifestProvider?.(req),
    localAccess,
  });

  app.get('/.well-known/oauth-protected-resource', (_req, res) => {
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

  app.post(endpoint, (req, res) => {
    if (rejectDisallowedOrigin(req, res)) return;
    if (requireAuth(req, res)) return;
    if (rejectNonJsonBody(req, res)) return;

    return mcpServerHandler({
      req,
      res,
      options,
      addonOptions,
      endpoint,
      sources,
      ...manifestAccessFor(req),
      compositionAuth,
    });
  });

  // The MCP server registers tools behind the same gates, so the page cannot drift from them.
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

  app.get(endpoint, (req, res) => {
    if (rejectDisallowedOrigin(req, res)) return;
    if (!req.headers['accept']?.includes('text/html')) {
      if (requireAuth(req, res)) return;

      return mcpServerHandler({
        req,
        res,
        options,
        addonOptions,
        endpoint,
        sources,
        ...manifestAccessFor(req),
        compositionAuth,
      });
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });

    let docsNotice = '';
    if (!docsHasManifests) {
      // With the feature already on, a missing manifest means the framework cannot produce one.
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

    // A disabled `dev` toolset overrides each dev tool's own gate, so explain that instead.
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
          ? '<p>View the <a href="/manifests/components.html">component manifest debugger</a>.</p>'
          : ''
      )
      .replace('{{A11Y_BADGE}}', a11yBadge);
    res.end(html);
  });
  return app;
}
