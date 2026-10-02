// The census layer
//
// - Every JSX element in the tree is resolved to DS or not DS
// - Elements are counted one by one, e.g. a DS Card full of raw divs contributes
//   one DS node and many host nodes
// - Raw `createElement` calls are not supported yet
// - Conditional renders cause element counts on each branch to be weighted
import ts from 'typescript';

import { createNodePathBuilder, elementTag, propNames } from './node-path.ts';
import { ownerKey, ownerName } from './owner.ts';
import { resolveJsxTag } from './resolve.ts';

import type { ModuleGraph } from '../module-graph.ts';
import type {
  CensusResult,
  IdentityResolver,
  IsCountedFile,
  NodeRecord,
  NodeTotals,
  OwnerBucket,
  Resolution,
  UnresolvedElement,
  UsageEdge,
} from '../types.ts';

function emptyTotals(): NodeTotals {
  return { all: 0, host: 0, component: 0, ds: 0, external: 0, local: 0, unresolved: 0 };
}

/**
 * Whether the subtree contains an element the census would count. A
 * non-rendering element (see NON_RENDERING_REACT) is not itself countable, but
 * elements inside it are, so `cond ? <A/> : <Fragment/>` keeps full weight
 * while `cond ? <A/> : <Fragment><B/></Fragment>` halves, exactly matching
 * the equivalent `<>` spellings.
 */
function makeContainsCountableJsx(
  isCountable: (element: ts.JsxElement | ts.JsxSelfClosingElement) => boolean
): (node: ts.Node) => boolean {
  const contains = (node: ts.Node): boolean => {
    if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && isCountable(node)) {
      return true;
    }
    let found = false;
    node.forEachChild(function scan(child): void {
      if (found) return;
      if ((ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) && isCountable(child)) {
        found = true;
        return;
      }
      child.forEachChild(scan);
    });
    return found;
  };
  return contains;
}

const LOGICAL_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

/**
 * React elements that render no UI of their own, only their children:
 * `<React.Fragment>` (`<>`) and `<Ctx.Provider>` or `<Ctx.Consumer>`
 * Counting them would skew component total against DS coverage.
 */
const NON_RENDERING_REACT = new Set(['Fragment', 'Context.Provider', 'Context.Consumer']);

function isNonRenderingIdentity(resolution: Resolution): boolean {
  return (
    resolution.category === 'external' &&
    resolution.module === 'react' &&
    NON_RENDERING_REACT.has(resolution.name)
  );
}

export function censusReactTree(
  graph: ModuleGraph,
  resolver: IdentityResolver,
  isCounted: IsCountedFile,
  includeNodes: boolean
): CensusResult {
  const totals = emptyTotals();
  const perFile = new Map<string, NodeTotals>();
  const components = new Map<
    string,
    { category: 'host' | 'ds' | 'external' | 'local'; count: number }
  >();
  const unresolved: Array<Omit<UnresolvedElement, 'instances'> & { owner: string }> = [];
  const nodeList: Array<Omit<NodeRecord, 'instances'> & { owner: string }> = [];
  const owners = new Map<string, OwnerBucket>();
  const edges: UsageEdge[] = [];

  for (const file of graph.files.values()) {
    // Filtered-out files still walk: their usage sites feed the multiplier
    // graph — a component's instantiation count is a whole-app fact — while
    // only counted files' elements enter any totals.
    const counted = isCounted(file.path);

    const fileTotals = emptyTotals();

    // One builder per file: paths are disambiguated within a file, not across
    // the tree. The builder must see every element that becomes a record
    // exactly once — a strict subset of what `count` counts, since hosts and
    // unresolved tags return without recording, and deliberately so. Its `#n`
    // suffix counts calls, not elements, so feeding it the wider set (or any
    // other traversal) renumbers every colliding path and two censuses stop
    // agreeing on which node is which.
    const nextPath = createNodePathBuilder();

    // Tag resolutions are memoized in the resolver, so asking again inside the
    // halving predicate costs a map lookup.
    const containsCountableJsx = makeContainsCountableJsx((element) => {
      const tag = ts.isJsxElement(element) ? element.openingElement.tagName : element.tagName;
      return !isNonRenderingIdentity(resolveJsxTag(file, tag, resolver));
    });

    const count = (
      tag: ts.JsxTagNameExpression,
      element: ts.JsxElement | ts.JsxSelfClosingElement,
      weight: number
    ): void => {
      const resolution = resolveJsxTag(file, tag, resolver);
      if (isNonRenderingIdentity(resolution)) return;

      const owner = ownerKey(file.path, ownerName(element));
      // A subsetting wrapper (`wrapped-ds`) is a local identity in its own
      // right: usages feed its own owner bucket exactly like any other local
      // component, so the multiplier solver sees them.
      if (resolution.category === 'local' || resolution.category === 'wrapped-ds') {
        edges.push({ from: owner, to: `${resolution.module}#${resolution.name}`, weight });
      }
      if (!counted) return;

      const bucket = owners.get(owner) ?? { totals: emptyTotals(), components: new Map() };
      owners.set(owner, bucket);

      // Every counted element touches the same three tallies — global,
      // per-file, per-owner — together; a helper keeps them from drifting
      // apart, since each is otherwise a separate line easy to forget.
      const add = (key: keyof NodeTotals): void => {
        totals[key] += weight;
        fileTotals[key] += weight;
        bucket.totals[key] += weight;
      };
      // Likewise, a component occurrence is tallied both globally and
      // per-owner, in identical maps of identical shape.
      const addComponent = (
        map: Map<string, { category: 'host' | 'ds' | 'external' | 'local'; count: number }>,
        key: string,
        category: 'host' | 'ds' | 'external' | 'local'
      ): void => {
        const entry = map.get(key) ?? { category, count: 0 };
        entry.count += weight;
        map.set(key, entry);
      };

      add('all');

      if (resolution.category === 'host') {
        add('host');
        addComponent(components, resolution.tag, 'host');
        addComponent(bucket.components, resolution.tag, 'host');
        return;
      }

      add('component');

      if (resolution.category === 'wrapped-ds') {
        // Static aggregates resolve wrapped-ds -> ds: the same element the
        // pre-collapsed `ds` resolution used to produce, keyed by the DS
        // identity the wrapper subsets.
        totals.ds += weight;
        fileTotals.ds += weight;
        const dsKey = `${resolution.ds.module}#${resolution.ds.name}`;
        addComponent(components, dsKey, 'ds');

        // Instance (weighted) aggregates resolve wrapped-ds -> local instead:
        // the wrapper's own usages count as local render-tree nodes, so its
        // owner bucket gets a real usage-derived multiplier (from the edge
        // above) and any local JSX inside the wrapper's own body — slot
        // children included — inherits it rather than flooring at 1.
        bucket.totals.local += weight;
        const localKey = `${resolution.module}#${resolution.name}`;
        addComponent(bucket.components, localKey, 'local');

        if (includeNodes) {
          nodeList.push({
            path: nextPath(element),
            file: file.path,
            line: file.sourceFile.getLineAndCharacterOfPosition(element.getStart()).line + 1,
            tag: elementTag(element),
            category: 'ds',
            module: resolution.ds.module,
            name: resolution.ds.name,
            weight,
            props: propNames(element),
            owner,
          });
        }
        return;
      }

      if (
        resolution.category === 'ds' ||
        resolution.category === 'external' ||
        resolution.category === 'local'
      ) {
        add(resolution.category);
        const key = `${resolution.module}#${resolution.name}`;
        addComponent(components, key, resolution.category);
        addComponent(bucket.components, key, resolution.category);
        if (includeNodes) {
          nodeList.push({
            path: nextPath(element),
            file: file.path,
            line: file.sourceFile.getLineAndCharacterOfPosition(element.getStart()).line + 1,
            tag: elementTag(element),
            category: resolution.category,
            module: resolution.module,
            name: resolution.name,
            weight,
            props: propNames(element),
            owner,
          });
        }
        return;
      }

      // namespace/object resolutions are not renderables; a tag resolving to
      // one is as unresolved as a tag resolving to nothing.
      const reason =
        resolution.category === 'unresolved'
          ? resolution.reason
          : `tag resolves to a ${resolution.category}`;
      add('unresolved');
      const line = file.sourceFile.getLineAndCharacterOfPosition(element.getStart()).line + 1;
      // Raw source text here, where a record's `tag` above is rebuilt from the
      // identifiers. The divergence is deliberate: a record's tag has to agree
      // with its own `path`, which is normalised so reformatting cannot move a
      // node, while this field is long-standing stored output whose spelling is
      // not worth churning for a shape no path is derived from.
      unresolved.push({ file: file.path, line, tag: tag.getText(), weight, reason, owner });
    };

    const walk = (node: ts.Node, weight: number): void => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        count(ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName, node, weight);
      } else if (ts.isConditionalExpression(node)) {
        // Both branches JSX -> each side at half weight; otherwise the JSX
        // side renders whenever anything does and keeps full weight.
        const halve = containsCountableJsx(node.whenTrue) && containsCountableJsx(node.whenFalse);
        const branchWeight = halve ? weight / 2 : weight;
        walk(node.condition, weight);
        walk(node.whenTrue, branchWeight);
        walk(node.whenFalse, branchWeight);
        return;
      } else if (ts.isBinaryExpression(node) && LOGICAL_OPERATORS.has(node.operatorToken.kind)) {
        const halve = containsCountableJsx(node.left) && containsCountableJsx(node.right);
        const branchWeight = halve ? weight / 2 : weight;
        walk(node.left, branchWeight);
        walk(node.right, branchWeight);
        return;
      }
      ts.forEachChild(node, (child) => walk(child, weight));
    };

    walk(file.sourceFile, 1);
    if (fileTotals.all > 0) perFile.set(file.path, fileTotals);
  }

  return {
    totals,
    perFile,
    components,
    unresolved,
    owners,
    edges,
    nodeList: includeNodes ? nodeList : undefined,
  };
}
