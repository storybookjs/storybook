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

    return loadConfigWithoutTurbopackRustReactCompiler(phase, dir);
  }

  // Next 16.3+ can reuse a rawConfig:true cache entry, which has no Next defaults.
  if (nextConfig.experimental !== undefined) {
    return nextConfig;
  }

  return loadConfigWithoutTurbopackRustReactCompiler(phase, dir, nextConfig);
}

async function loadConfigWithoutTurbopackRustReactCompiler(
  phase: Parameters<typeof loadConfig>[0],
  dir: string,
  cachedRawConfigModule?: NextConfigComplete
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

function isTurbopackRustReactCompilerError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith(TURBOPACK_RUST_REACT_COMPILER_ERROR);
}

function interopDefault<T>(module: T | { default: T }): T {
  return (module as { default?: T }).default ?? (module as T);
}
