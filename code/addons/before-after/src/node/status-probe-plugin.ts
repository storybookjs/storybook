import type { Plugin } from 'vite';

import { logger } from 'storybook/internal/node-logger';

/**
 * Tiny Vite plugin that exposes the current change-detection status snapshot
 * over HTTP at `/_status_/change-detection`. Used by external tooling (the
 * agent-eval harness in `project-documents/questions/appendix/agent-eval/`)
 * so it can read live status state without injecting a client-side probe.
 *
 * The endpoint reads from the shared server-side status store via dynamic
 * import — kept dynamic so this plugin doesn't pull `core-server` into the
 * addon's hot path on every dev-server start.
 *
 * Returns a JSON array shaped:
 *   [{ "storyId": "...", "value": "status-value:modified" }, ...]
 */
export function statusProbePlugin(): Plugin {
  return {
    name: 'storybook:before-after:status-probe',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/_status_/change-detection', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Method not allowed');
          return;
        }
        try {
          // Lazy: only import when probe is hit, so we don't pay the cost on
          // boot and we don't fail to start if the import path resolves
          // differently in some build configuration.
          const { internal_fullStatusStore } = await import('storybook/internal/core-server');
          const all = internal_fullStatusStore.getAll();
          const out: { storyId: string; value: string }[] = [];
          for (const [storyId, byTypeId] of Object.entries(all)) {
            const cd = (byTypeId as Record<string, { value: string } | undefined>)[
              'storybook/change-detection'
            ];
            if (cd && cd.value) out.push({ storyId, value: cd.value });
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(out));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.debug(`[before-after] status-probe failed: ${message}`);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}
