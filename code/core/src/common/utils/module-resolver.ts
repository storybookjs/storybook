// `rolldown/experimental` may change in a minor release, so a lint rule keeps its import here.
import * as find from 'empathic/find';
import { dirname } from 'pathe';
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
  const create = (tsconfig: ModuleResolverOptions['tsconfig']) =>
    new ResolverFactory({
      ...options,
      tsconfig,
      conditionNames: options.conditionNames ?? defaultResolveConditionNames,
    });
  const factory = create(options.tsconfig);

  // Since Rolldown 1.1.2, `'auto'` applies a tsconfig only to a file that it includes. The root
  // tsconfig of an Angular project includes no file and declares the `paths` of the project.
  const factoryOfTsconfig = new Map<string, ResolverFactory>();
  const nearestTsconfig = (directory: string) => {
    const configFile = options.tsconfig === 'auto' && find.up('tsconfig.json', { cwd: directory });
    if (configFile && !factoryOfTsconfig.has(configFile)) {
      factoryOfTsconfig.set(configFile, create({ configFile }));
    }
    return configFile ? factoryOfTsconfig.get(configFile) : undefined;
  };

  type Result = { path?: string | null; error?: string | null };
  const unwrap = (result: Result, retried: Result | undefined, specifier: string, from: string) => {
    const path = result.path ?? retried?.path;
    if (path) {
      return path;
    }
    throw new Error(result.error ?? `Cannot resolve module '${specifier}' from '${from}'`);
  };

  return {
    resolveFileSync: (fromFile, specifier) => {
      const result = factory.resolveFileSync(fromFile, specifier);
      const retried = result.path
        ? undefined
        : nearestTsconfig(dirname(fromFile))?.resolveFileSync(fromFile, specifier);
      return unwrap(result, retried, specifier, fromFile);
    },
    resolveSync: (fromDirectory, specifier) => {
      const result = factory.sync(fromDirectory, specifier);
      const retried = result.path
        ? undefined
        : nearestTsconfig(fromDirectory)?.sync(fromDirectory, specifier);
      return unwrap(result, retried, specifier, fromDirectory);
    },
    resolveFile: async (fromFile, specifier) => {
      const result = await factory.resolveFileAsync(fromFile, specifier);
      const retried = result.path
        ? undefined
        : await nearestTsconfig(dirname(fromFile))?.resolveFileAsync(fromFile, specifier);
      return unwrap(result, retried, specifier, fromFile);
    },
  };
}
