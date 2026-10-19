import { type ResolveResult, ResolverFactory } from 'oxc-resolver';

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
  /**
   * Extensions tried in place of the one a specifier ends in, in order, once the file it names
   * does not exist. Like Vite, a file in `node_modules` is never found by an alias.
   */
  extensionAlias?: Record<string, string[]>;
}

export interface ModuleResolver {
  /** Resolves `specifier` as if imported from `fromFile`. Throws when unresolvable. */
  resolveFileSync(fromFile: string, specifier: string): string;
  /** Resolves `specifier` as if imported from a file in `fromDirectory`. Throws when unresolvable. */
  resolveSync(fromDirectory: string, specifier: string): string;
}

/**
 * Resolves a specifier that names TypeScript source by the file it compiles to, as `./button.js`
 * for `button.ts` under `NodeNext`, where no `button.js` exists.
 */
export const typeScriptExtensionAlias: Record<string, string[]> = {
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
};

/**
 * Resolve the same files the preview bundles: the browser build's resolve conditions, trimmed to
 * what oxc-resolver understands.
 *
 * oxc-resolver defaults to no conditions at all, which would make exports maps without an
 * unconditional entry unresolvable.
 */
export const defaultResolveConditionNames = ['storybook', 'import', 'module', 'default'];

export function createModuleResolver({
  extensionAlias,
  ...options
}: ModuleResolverOptions = {}): ModuleResolver {
  const resolveOptions = {
    ...options,
    conditionNames: options.conditionNames ?? defaultResolveConditionNames,
  };
  const factory = new ResolverFactory(resolveOptions);
  const aliased = extensionAlias && factory.cloneWithOptions({ ...resolveOptions, extensionAlias });

  const resolve = (
    resolveWith: (resolver: ResolverFactory) => ResolveResult,
    specifier: string,
    from: string
  ) => {
    const result = resolveWith(factory);
    if (result.path) {
      return result.path;
    }
    const alias = aliased && resolveWith(aliased).path;
    if (alias && !alias.split(/[\\/]/).includes('node_modules')) {
      return alias;
    }
    throw new Error(result.error ?? `Cannot resolve module '${specifier}' from '${from}'`);
  };

  return {
    resolveFileSync: (fromFile, specifier) =>
      resolve((resolver) => resolver.resolveFileSync(fromFile, specifier), specifier, fromFile),
    resolveSync: (fromDirectory, specifier) =>
      resolve((resolver) => resolver.sync(fromDirectory, specifier), specifier, fromDirectory),
  };
}
