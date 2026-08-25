import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import { type Plugin, type UserConfig, normalizePath } from 'vite';

const ENV_KEY = 'STORYBOOK_ANGULAR_BUILDER_OPTIONS_JSON';

/**
 * Collect every ancestor directory of `startDir` (inclusive) that contains a `node_modules` folder,
 * normalized to Vite's forward-slash convention. All are kept rather than stopping at the first
 * because Storybook's cache creates a `node_modules/.cache` in the project directory, which would
 * otherwise shadow the real workspace root (e.g. an Angular workspace, where dependencies live at
 * the root above `projects/<lib>/`).
 */
export const findNodeModulesRoots = (startDir: string): string[] => {
  const roots: string[] = [];
  let dir = resolve(startDir);
  for (;;) {
    if (existsSync(join(dir, 'node_modules'))) {
      roots.push(normalizePath(dir));
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return roots;
};

/**
 * Storybook renders Angular with the JIT compiler, so `@angular/compiler` must be registered before
 * anything compiles a component. Under Vitest, addon-vitest's setup file imports the project
 * annotations early — and on Angular toolchains where the linker no longer AOT-processes libraries
 * like `@angular/common` (PlatformLocation), they fall back to JIT at that point. Importing
 * `@angular/compiler` as a `setupFiles` entry runs early enough (a preview annotation does not), and
 * the bare specifier resolves via Node so the framework needs no extra package export.
 */
const COMPILER_SETUP = '@angular/compiler';

/**
 * Angular build options that influence how stories compile under Vitest.
 * Known keys give autocomplete; the index signature is NOT speculative — it
 * models Angular's genuinely open-ended builder-options surface (the framework's
 * internal type is `Record<string, any>`, and Angular adds builder options
 * across versions). The upstream consumer is real and open-ended.
 */
export interface AngularVitestOptions {
  zoneless?: boolean;
  styles?: string[];
  stylePreprocessorOptions?: { sass?: Record<string, unknown>; loadPaths?: string[] };
  assets?: unknown[];
  sourceMap?: boolean;
  preserveSymlinks?: boolean;
  tsConfig?: string;
  [key: string]: unknown;
}

/**
 * Pure options bridge for standalone `vitest` runs (no parent `storybook dev`).
 * Add to your `vitest.config.ts` `plugins` array alongside `storybookTest`. The
 * env var is set SYNCHRONOUSLY in this factory body — before storybookTest's
 * inline `presets.apply('viteFinal')` reads it — so timing does not depend on
 * Vite plugin-hook ordering. Returns a near-noop plugin only so it lives in the
 * `plugins` array (which is how the addon-vitest postinstall injects it).
 *
 * Does NOT register `@analogjs/vite-plugin-angular`; the framework's own
 * `viteFinal` still injects analog. This only carries Angular build options
 * into the env channel the framework already consumes.
 */
export function storybookAngularVitest(options: AngularVitestOptions = {}): Plugin {
  let serialized: string;
  try {
    serialized = JSON.stringify(options);
  } catch (err) {
    throw new Error(
      `[storybook-angular-vite] storybookAngularVitest received non-serializable options: ${(err as Error).message}`
    );
  }

  const existing = process.env[ENV_KEY];
  if (existing !== undefined) {
    if (existing !== serialized) {
      logger.warn(
        '[storybook-angular-vite] STORYBOOK_ANGULAR_BUILDER_OPTIONS_JSON is already set ' +
          '(likely by the Storybook CLI or the Vitest addon panel). Keeping the existing value; ' +
          'the options passed to storybookAngularVitest() are ignored in this run.'
      );
    }
  } else {
    process.env[ENV_KEY] = serialized;
  }

  return {
    name: 'storybook:angular-vitest-options',
    // Vitest augments Vite's `UserConfig` with `test`; assert the shape here rather than import
    // Vitest's types, which would pull its whole type graph into the framework's d.ts build.
    config: () => ({ test: { setupFiles: [COMPILER_SETUP] } }) as unknown as UserConfig,
    // In an Angular workspace library the Vite dev-server root is `projects/<lib>/`, but
    // `node_modules` (with `@angular/compiler`) lives at the workspace root. Vite only treats
    // `pnpm-workspace.yaml`, `lerna.json`, or a `workspaces` field as workspace-root markers, so a
    // plain Angular workspace resolves the root to the library folder — and the `@angular/compiler`
    // setup file above falls outside `server.fs.allow`, failing to load in the browser with
    // "Failed to fetch dynamically imported module". Allow every ancestor that contains
    // `node_modules`. `configureServer` is required: Vitest builds the browser server's allow-list
    // itself, so entries added via the `config` hook or static config never reach it.
    configureServer(server) {
      // Vitest always populates `fs.allow` today; initialize it defensively so the workspace root
      // is still allowed if that ever changes.
      const fs = server.config.server.fs as { allow?: string[] };
      fs.allow ??= [];
      for (const nodeModulesRoot of findNodeModulesRoots(server.config.root)) {
        if (!fs.allow.includes(nodeModulesRoot)) {
          fs.allow.push(nodeModulesRoot);
        }
      }
    },
  };
}
