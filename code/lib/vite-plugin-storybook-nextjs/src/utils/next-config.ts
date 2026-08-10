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
  try {
    return await loadConfig(phase, dir);
  } catch (error) {
    if (!isTurbopackRustReactCompilerError(error)) {
      throw error;
    }
  }

  const rawConfigModule = await loadConfig(phase, dir, { rawConfig: true });
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
