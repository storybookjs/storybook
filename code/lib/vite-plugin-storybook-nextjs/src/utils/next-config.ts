import { type NextConfigComplete, normalizeConfig } from 'next/dist/server/config-shared.js';
import nextServerConfig from 'next/dist/server/config.js';

const loadConfig: typeof nextServerConfig =
  // biome-ignore lint/suspicious/noExplicitAny: CJS support
  (nextServerConfig as any).default || nextServerConfig;

const TURBOPACK_RUST_REACT_COMPILER_ERROR =
  '`experimental.turbopackRustReactCompiler` is only supported with Turbopack.';

export async function loadNextConfig(
  phase: Parameters<typeof loadConfig>[0],
  dir: string
): Promise<NextConfigComplete> {
  let nextConfig: NextConfigComplete;

  try {
    nextConfig = await loadConfig(phase, dir);
  } catch (error) {
    if (!isTurbopackRustReactCompilerError(error)) {
      throw error;
    }

    return loadNormalizedNextConfig(phase, dir);
  }

  if (isResolvedNextConfig(nextConfig)) {
    return nextConfig;
  }

  return loadNormalizedNextConfig(phase, dir, nextConfig);
}

async function loadNormalizedNextConfig(
  phase: Parameters<typeof loadConfig>[0],
  dir: string,
  cachedRawConfigModule?: unknown
): Promise<NextConfigComplete> {
  const rawConfigModule =
    cachedRawConfigModule ?? (await loadConfig(phase, dir, { rawConfig: true }));
  const rawConfig = interopDefault(rawConfigModule);
  const normalizedConfig = await normalizeConfig(phase, rawConfig);
  const { turbopackRustReactCompiler: _turbopackRustReactCompiler, ...experimental } =
    normalizedConfig.experimental ?? {};

  return loadConfig(phase, dir, {
    customConfig: {
      ...normalizedConfig,
      experimental,
    },
  });
}

function isResolvedNextConfig(config: NextConfigComplete): boolean {
  return typeof config.configFileName === 'string';
}

function isTurbopackRustReactCompilerError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith(TURBOPACK_RUST_REACT_COMPILER_ERROR);
}

function interopDefault(module: unknown): unknown {
  if (typeof module === 'object' && module !== null && 'default' in module) {
    return (module as { default: unknown }).default ?? module;
  }

  return module;
}
