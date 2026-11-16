// `rolldown/experimental` may change in a minor release, so a lint rule keeps its import here.
import { ResolverFactory } from 'rolldown/experimental';

/**
 * Module resolution options, declared locally so consumers don't depend on the underlying resolver
 * package.
 */
export interface ModuleResolverOptions {
  extensions?: string[];
  mainFields?: string[];
  conditionNames?: string[];
  /** Extensions to try in place of a written one, such as `{ '.js': ['.ts', '.js'] }`. */
  extensionAlias?: Record<string, string[]>;
  /** Honor `paths`/`baseUrl` from a tsconfig. `'auto'` walks up from the resolution origin. */
  tsconfig?: 'auto' | { configFile: string };
  /** Paths to try in place of a specifier or its prefix, such as `{ '@': ['/project/src'] }`. */
  alias?: Record<string, string[]>;
  /** package.json fields that redirect files of that package, such as `[['browser']]`. */
  aliasFields?: string[][];
}

export interface ModuleResolver {
  /** Resolves `specifier` as if imported from `fromFile`. Throws when unresolvable. */
  resolveFileSync(fromFile: string, specifier: string): string;
  /** Resolves `specifier` as if imported from a file in `fromDirectory`. Throws when unresolvable. */
  resolveSync(fromDirectory: string, specifier: string): string;
  /** Resolves `specifier` as if imported from `fromFile`. Rejects when unresolvable. */
  resolveFile(fromFile: string, specifier: string): Promise<string>;
}

/**
 * Resolve the same files the preview bundles: the browser build's resolve conditions, trimmed to
 * what Rolldown's resolver understands.
 *
 * The resolver defaults to no conditions at all, which would make exports maps without an
 * unconditional entry unresolvable.
 */
export const defaultResolveConditionNames = ['storybook', 'import', 'module', 'default'];

export function createModuleResolver(options: ModuleResolverOptions = {}): ModuleResolver {
  const factory = new ResolverFactory({
    ...options,
    conditionNames: options.conditionNames ?? defaultResolveConditionNames,
  });

  const unwrap = (
    result: { path?: string | null; error?: string | null },
    specifier: string,
    from: string
  ) => {
    if (result.path) {
      return result.path;
    }
    throw new Error(result.error ?? `Cannot resolve module '${specifier}' from '${from}'`);
  };

  return {
    resolveFileSync: (fromFile, specifier) =>
      unwrap(factory.resolveFileSync(fromFile, specifier), specifier, fromFile),
    resolveSync: (fromDirectory, specifier) =>
      unwrap(factory.sync(fromDirectory, specifier), specifier, fromDirectory),
    resolveFile: async (fromFile, specifier) =>
      unwrap(await factory.resolveFileAsync(fromFile, specifier), specifier, fromFile),
  };
}
