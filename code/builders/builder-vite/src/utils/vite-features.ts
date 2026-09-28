import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { UserConfig } from 'vite';
import { version } from 'vite';

// TODO: Remove once support for Vite < 8 is dropped
const shouldUseRolldownOptions = () => {
  try {
    return Number(version.split('.')[0]) >= 8;
  } catch {
    return false;
  }
};

/**
 * Returns the correct bundler options key based on the installed Vite version. Vite 8 renamed
 * `build.rollupOptions` to `build.rolldownOptions`.
 */
// TODO: Remove once support for Vite < 8 is dropped, and use 'rolldownOptions' directly
export const bundlerOptionsKey = shouldUseRolldownOptions() ? 'rolldownOptions' : 'rollupOptions';

export function ensureRolldownOptions(config: UserConfig) {
  if (!shouldUseRolldownOptions()) {
    return;
  }

  config.build ??= {};
  // @ts-expect-error - rolldownOptions will only exist with Vite 8+
  const rolldown = (config.build.rolldownOptions ??= {});
  const output = (rolldown.output ??= {});
  output.strictExecutionOrder = true;
}

// Headroom under the ~1MB response limit.
const MAX_CHUNK_BYTES = 500 * 1024;

export function chunkedPreviewRuntimePath() {
  return join(
    dirname(fileURLToPath(import.meta.resolve('storybook/package.json'))),
    'dist/preview-chunked/runtime.js'
  );
}

type ChunkOutput = {
  strictExecutionOrder?: boolean;
  codeSplitting?:
    | boolean
    | {
        groups?: Array<{ name: string; maxSize?: number; test?: unknown }>;
      };
  manualChunks?:
    | Record<string, string[]>
    | ((id: string, meta: unknown) => string | null | undefined | void);
};

function aliasChunkedPreviewRuntime(config: UserConfig, runtimePath: string) {
  config.resolve ??= {};
  const alias = config.resolve.alias;
  const find = 'storybook/internal/preview/runtime';
  if (Array.isArray(alias)) {
    alias.push({ find, replacement: runtimePath });
    return;
  }
  config.resolve.alias = { ...alias, [find]: runtimePath };
}

function eachOutput(config: UserConfig, useRolldown: boolean, fn: (output: ChunkOutput) => void) {
  config.build ??= {};
  const key = useRolldown ? 'rolldownOptions' : 'rollupOptions';
  const build = config.build as Record<
    string,
    { output?: ChunkOutput | ChunkOutput[] } | undefined
  >;
  const options = (build[key] ??= {});
  if (Array.isArray(options.output)) {
    if (options.output.length === 0) {
      options.output.push({});
    }
    for (const output of options.output) {
      fn(output);
    }
    return;
  }
  options.output ??= {};
  fn(options.output);
}

// The package export is one module, so a size cap cannot split it.
export function applyChunkedPreviewRuntime(
  config: UserConfig,
  useRolldown = shouldUseRolldownOptions()
) {
  aliasChunkedPreviewRuntime(config, chunkedPreviewRuntimePath());

  eachOutput(config, useRolldown, (output) => {
    if (useRolldown) {
      output.strictExecutionOrder = true;
      const splitting = output.codeSplitting;
      const base = splitting && typeof splitting === 'object' ? splitting : {};
      output.codeSplitting = {
        ...base,
        groups: [...(base.groups ?? []), { name: 'sb', maxSize: MAX_CHUNK_BYTES }],
      };
      return;
    }

    if (output.manualChunks && typeof output.manualChunks !== 'function') {
      return;
    }

    const previous = output.manualChunks;
    output.manualChunks = (id, meta) => {
      if (id.includes('preview-chunked')) {
        return basename(id, '.js');
      }
      return previous?.(id, meta);
    };
  });
}
