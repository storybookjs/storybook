// How much of the app's UI comes from a design system.
//
// `analyzeDsCoverage` binds three layers together:
// * module-graph.ts: what files exist, what they import and export (framework-agnostic)
// * identify.ts:     which export names belong to the DS or not, following re-exports, barrel files,
//                    and wrappers to the target (framework-agnostic with framework plugins)
// * react/census.ts: how many component instances are DS names (react implementation)
import fs from 'node:fs';

import { share } from '../../../utils/math.ts';

import { createResolver } from './identify.ts';
import { buildModuleGraph } from './module-graph.ts';
import { solveMultipliers } from './multipliers.ts';
import { createPackageMatcher } from './package-pattern.ts';
import { createPathFilter } from './path-filter.ts';
import { censusReactTree } from './react/census.ts';
import { analyzeReactDeclaration } from './react/resolve.ts';
import type {
  CensusResult,
  DsCoverageOptions,
  DsCoverageReport,
  FrameworkImplementation,
  NodeTotals,
} from './types.ts';

const FRAMEWORKS: Record<'react', FrameworkImplementation> = {
  react: {
    createDeclarationAnalyzer: () => analyzeReactDeclaration,
    createCensus: () => censusReactTree,
  },
};

const NODE_KEYS: Array<keyof NodeTotals> = [
  'all',
  'host',
  'component',
  'ds',
  'external',
  'local',
  'unresolved',
];

function sortedComponents(
  census: CensusResult,
  componentInstances: Map<string, number>
): DsCoverageReport['components'] {
  const entries = [...census.components.entries()].sort(
    (a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])
  );
  return Object.fromEntries(
    entries.map(([key, entry]) => [
      key,
      // Every key in `components` is threaded through some owner's bucket
      // (see react/census.ts), so the fold below always has an entry for
      // it; the fallback only degrades a broken invariant to the static
      // count instead of silently under-reporting 0 instances.
      { ...entry, instances: componentInstances.get(key) ?? entry.count },
    ])
  );
}

/**
 * Measures the DS share of a source tree. Uses import patterns
 * (e.g. `['@ds/*']`) to distinguish DS code from the rest.
 */
export function analyzeDsCoverage(options: DsCoverageOptions): DsCoverageReport {
  const framework = FRAMEWORKS[options.framework ?? 'react'];
  if (!framework) {
    throw new Error(`Unsupported framework: ${options.framework}`);
  }

  if (!fs.existsSync(options.projectDir)) {
    throw new Error(`Project directory does not exist: ${options.projectDir}`);
  }
  if (!fs.statSync(options.projectDir).isDirectory()) {
    throw new Error(`Project directory is not a directory: ${options.projectDir}`);
  }

  const censusInclude = options.censusInclude ?? [];
  const censusExclude = options.censusExclude ?? [];
  const graph = buildModuleGraph(options.projectDir);
  const isDsPackage = createPackageMatcher(options.dsPackages);
  const resolver = createResolver(graph, isDsPackage, framework.createDeclarationAnalyzer());
  // We use the projectDir as a working directory to resolve relative paths in filters.
  const isCounted = createPathFilter(censusInclude, censusExclude, options.projectDir);
  const includeNodes = options.includeNodes ?? false;
  const census = framework.createCensus()(graph, resolver, isCounted, includeNodes);

  const multipliers = solveMultipliers(census.edges);
  const multiplierOf = (owner: string): number => multipliers.get(owner) ?? 1;

  const instanceNodes: NodeTotals = {
    all: 0,
    host: 0,
    component: 0,
    ds: 0,
    external: 0,
    local: 0,
    unresolved: 0,
  };
  const componentInstances = new Map<string, number>();
  for (const [owner, bucket] of census.owners) {
    const factor = multiplierOf(owner);
    for (const key of NODE_KEYS) instanceNodes[key] += bucket.totals[key] * factor;
    for (const [component, entry] of bucket.components) {
      componentInstances.set(
        component,
        (componentInstances.get(component) ?? 0) + entry.count * factor
      );
    }
  }

  return {
    framework: options.framework ?? 'react',
    dsPackages: options.dsPackages,
    censusInclude,
    censusExclude,
    files: [...graph.files.keys()].filter(isCounted).length,
    parseFailures: graph.parseFailures,
    readFailures: graph.readFailures,
    nodes: census.totals,
    dsShareOfAllNodes: share(census.totals.ds, census.totals.all),
    dsShareOfComponentNodes: share(census.totals.ds, census.totals.component),
    instances: {
      nodes: instanceNodes,
      dsShareOfAllNodes: share(instanceNodes.ds, instanceNodes.all),
      dsShareOfComponentNodes: share(instanceNodes.ds, instanceNodes.component),
      multipliers: Object.fromEntries(
        [...multipliers]
          .filter(([, value]) => value !== 1)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      ),
    },
    components: sortedComponents(census, componentInstances),
    unresolvedElements: census.unresolved.map(({ owner, ...element }) => ({
      ...element,
      instances: element.weight * multiplierOf(owner),
    })),
    perFile: Object.fromEntries(census.perFile),
    // Unweighted by design: the ds-misuse judge reads these records, and it
    // must see each source element exactly once, in its static identity.
    // Instance weighting stays confined to the `instances` aggregates above.
    ...(includeNodes
      ? { nodeList: (census.nodeList ?? []).map(({ owner: _owner, ...record }) => record) }
      : {}),
  };
}
