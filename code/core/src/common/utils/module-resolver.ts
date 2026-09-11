import { ResolverFactory } from 'oxc-resolver';

/**
 * Module resolution options, declared locally so consumers don't depend on the underlying resolver
 * package.
 */
export interface ModuleResolverOptions {
  extensions?: string[];
  mainFields?: string[];
  conditionNames?: string[];
  /** Honor `paths`/`baseUrl` from a tsconfig. `'auto'` walks up from the resolution origin. */
  tsconfig?: 'auto' | { configFile: string };
}

export interface ModuleResolver {
  /** Resolves `specifier` as if imported from `fromFile`. Throws when unresolvable. */
  resolveFileSync(fromFile: string, specifier: string): string;
  /** Resolves `specifier` as if imported from a file in `fromDirectory`. Throws when unresolvable. */
  resolveSync(fromDirectory: string, specifier: string): string;
}

/**
 * Resolve the same files the preview bundles: the browser build's resolve conditions, trimmed to
 * what oxc-resolver understands.
 *
 * oxc-resolver defaults to no conditions at all, which would make exports maps without an
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
  };
}
