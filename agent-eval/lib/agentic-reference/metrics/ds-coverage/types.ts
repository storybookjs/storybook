import type ts from 'typescript';

import type { ModuleFile, ModuleGraph } from './module-graph.ts';
import type { UsageEdge } from './multipliers.ts';

// `export ... from` alone would re-export the name without binding it locally,
// and CensusResult below needs it in scope too.
export type { UsageEdge };

/**
 * Where a resolved binding was declared. Carried on identities that came out
 * of a local declaration so that member access (`Card.Header`) can consult the
 * declaring module's `Card.Header = …` assignments even after the declaration
 * itself resolved through a styled or subsetting wrapper into something else.
 */
export interface DeclaredAt {
  declaredAt?: { file: ModuleFile; name: string };
}

/**
 * What an element tag ultimately is, after chasing every import, re-export
 * styled wrapper, and subsetting wrapper to its target:
 *
 * - `host`: an intrinsic element, or a chain ending in one (`styled.div`)
 * - `ds`: a component of a package matching the DS pattern
 * - `external`: a component of any other package
 * - `local`: a component the project defines itself
 * - `wrapped-ds`: a local subsetting wrapper around a `ds` component (see
 *   react/resolve.ts). It is a local identity in its own right — usages of
 *   it feed the multiplier graph like any other local component — that also
 *   remembers the `ds` identity it collapses to for the static census. Which
 *   half applies is a per-consumer choice, not baked into the resolution.
 * - `unresolved`: statically unresolvable
 */
export type Identity =
  | ({ category: 'host'; tag: string } & DeclaredAt)
  | ({ category: 'ds'; module: string; name: string } & DeclaredAt)
  | ({ category: 'external'; module: string; name: string } & DeclaredAt)
  | ({ category: 'local'; module: string; name: string } & DeclaredAt)
  | ({
      category: 'wrapped-ds';
      module: string;
      name: string;
      ds: { module: string; name: string };
    } & DeclaredAt)
  | ({ category: 'unresolved'; reason: string; circular?: boolean } & DeclaredAt);

/**
 * An intermediate resolution: an identity, or a value that is not itself a
 * renderable e.g. a module namespace (`import * as Forms`) or an object literal
 * of components.
 *
 * Those intermediate resolutions help chain resolutions from imports all the
 * way to element representations in the framework.
 */
export type Resolution =
  | Identity
  | {
      category: 'namespace';
      module: { kind: 'package'; specifier: string } | { kind: 'file'; path: string };
    }
  | { category: 'object'; file: ModuleFile; node: ts.ObjectLiteralExpression };

/** The identification layer, as seen by a framework implementation. */
export interface IdentityResolver {
  /** Resolve a local name in a file: an import, or a declaration. */
  resolveLocal(file: ModuleFile, name: string): Resolution;
  /** Resolve an export of a graph file, following re-exports and barrels. */
  resolveExport(path: string, exportName: string): Resolution;
  /** Resolve an import of `specifier` from within `file`. */
  resolveModule(file: ModuleFile, specifier: string, exportName: string): Resolution;
  /** Project a member (`Dialog.Root`, `Forms.Input`, `Card.Header`) out of a resolution. */
  memberOf(resolution: Resolution, property: string): Resolution;
  /** Resolve a name bound by a destructuring pattern. */
  resolveDestructured(
    file: ModuleFile,
    declaration: ts.VariableDeclaration,
    path: string[],
    name: string
  ): Resolution;
  /** Analyze a declaration or expression node via the framework, memoized. */
  analyzeDeclaration(file: ModuleFile, node: ts.Node, name: string): Resolution;
}

/**
 * The framework's half of the identification layer: what a local *declaration*
 * ultimately renders. This is where styled wrappers, memo/forwardRef, and
 * subsetting wrappers live — all framework idioms the shared layer cannot know.
 */
export type DeclarationAnalyzer = (
  file: ModuleFile,
  node: ts.Node,
  name: string,
  resolver: IdentityResolver
) => Resolution;

/** Weighted node totals; conditional branches make these fractional. */
export interface NodeTotals {
  all: number;
  host: number;
  /** ds + external + local + unresolved. */
  component: number;
  ds: number;
  external: number;
  local: number;
  unresolved: number;
}

/** Per-owner slice of the census: what one top-level declaration's JSX contributes. */
export interface OwnerBucket {
  totals: NodeTotals;
  components: Map<string, { category: 'host' | 'ds' | 'external' | 'local'; count: number }>;
}

export interface UnresolvedElement {
  file: string;
  line: number;
  tag: string;
  weight: number;
  /** weight × the owner's instantiation multiplier: estimated rendered copies. */
  instances: number;
  reason: string;
}

/**
 * One counted component element, addressed by a path that survives relocation.
 *
 * `path` is the enclosing declaration's name followed by the JSX ancestor chain,
 * each segment `Tag[i]` where `i` indexes element siblings only. It carries no
 * offsets, so a node that moved down a file keeps its path — which is what lets
 * a reader separate "new" from "moved". See react/node-path.ts for the format.
 *
 * Host elements are absent: the metric is about component choices. Unresolved
 * elements are absent too — they are already reported in `unresolvedElements`,
 * and a node whose identity is unknown cannot be judged.
 *
 * Records are the UNWEIGHTED census: `category` and identity are the static
 * resolution (a subsetting wrapper's call site reads as the DS component it
 * subsets), and `weight` is the conditional-render fraction of the one source
 * element — never an instantiation count. Instance weighting lives only in the
 * report's `instances` aggregates; the ds-misuse judge consumes these records
 * and must see each source element exactly once.
 */
export interface NodeRecord {
  path: string;
  file: string;
  line: number;
  /** The tag as written, including dots: `Card.Header`. Whitespace normalised. */
  tag: string;
  category: 'ds' | 'external' | 'local';
  module: string;
  name: string;
  weight: number;
  /** Prop names only, never values: enough to check a guideline, small enough to ship. */
  props: string[];
}

export interface CensusResult {
  totals: NodeTotals;
  perFile: Map<string, NodeTotals>;
  /** Weighted per-identity counts, keyed `<module>#<name>` (hosts by tag). */
  components: Map<string, { category: 'host' | 'ds' | 'external' | 'local'; count: number }>;
  unresolved: Array<Omit<UnresolvedElement, 'instances'> & { owner: string }>;
  /** Buckets for counted files' owners, keyed by ownerKey(). */
  owners: Map<string, OwnerBucket>;
  /** Whole-graph usage edges — counted files or not. */
  edges: UsageEdge[];
  /** Populated only when the census was asked for nodes. */
  nodeList?: Array<NodeRecord & { owner: string }>;
}

/** Whether a file's own JSX counts toward the census. */
export type IsCountedFile = (path: string) => boolean;

/** What a framework plugs into the facade. */
export interface FrameworkImplementation {
  createDeclarationAnalyzer(): DeclarationAnalyzer;
  createCensus(): (
    graph: ModuleGraph,
    resolver: IdentityResolver,
    isCounted: IsCountedFile,
    includeNodes: boolean
  ) => CensusResult;
}

export interface DsCoverageOptions {
  /** Root directory of the project to analyze. */
  projectDir: string;
  /** DS package patterns, e.g. `['@ds/*']` or `['@base-ui/react']`. */
  dsPackages: string[];
  /** Framework name (only 'react' is supported for now). */
  framework?: 'react';
  /**
   * Include globs selecting which files' JSX is counted, picomatch syntax.
   * A file counts when it matches at least one include (every file when the
   * list is empty) and matches no exclude. Uncounted files are still parsed
   * and still resolve.
   *
   * Distinct from the tests/stories/mocks rule in module-graph.ts, which drops
   * files from the graph as well, and does not parse them at all.
   */
  censusInclude?: string[];
  /** Exclude globs; a matching file's JSX is never counted. */
  censusExclude?: string[];
  /**
   * Emit a per-node list alongside the aggregates. Opt-in because the list is
   * one record per counted element and dwarfs the rest of the report, while
   * only the judge that reads individual nodes has any use for it.
   */
  includeNodes?: boolean;
}

export interface DsCoverageReport {
  framework: string;
  dsPackages: string[];
  censusInclude: string[];
  censusExclude: string[];
  files: number;
  parseFailures: string[];
  readFailures: string[];
  nodes: NodeTotals;
  /** ds / all, or null when the tree has no JSX at all. */
  dsShareOfAllNodes: number | null;
  /** ds / component-typed, or null when no component-typed elements exist. */
  dsShareOfComponentNodes: number | null;
  /**
   * The same census, weighted by estimated instantiations: JSX inside a local
   * component counts once per (statically estimated) render of it.
   */
  instances: {
    nodes: NodeTotals;
    dsShareOfAllNodes: number | null;
    dsShareOfComponentNodes: number | null;
    /** Owners whose multiplier ≠ 1, keyed `<file>#<name>`, largest first. */
    multipliers: Record<string, number>;
  };
  /** Per-component attribution, largest count first. */
  components: Record<
    string,
    { category: 'host' | 'ds' | 'external' | 'local'; count: number; instances: number }
  >;
  /** Every element the analyzer could not classify, so 0 is checkable. */
  unresolvedElements: UnresolvedElement[];
  /** Per-file totals for files containing JSX, for spot validation. */
  perFile: Record<string, NodeTotals>;
  /** Present only when `includeNodes` was set. Unweighted — see NodeRecord. */
  nodeList?: NodeRecord[];
}
