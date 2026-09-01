// How a JSX element is addressed in the node census.
//
// The format is `<declaration>/<Tag>[i]/<Tag>[i]…`, where `i` indexes element
// siblings only. It deliberately carries no line or character offsets: a node
// that moved down a file because something was inserted above it keeps the same
// path — with the `#n` caveat below — which is what lets a reader separate a
// genuinely new node from a relocated one.
//
// Fragments are transparent — they render nothing, so wrapping a subtree in one
// must not renumber it. Member expressions keep their dotted source text; the
// resolved identity travels beside the path in the record's module/name.
//
// Known shapes this does not chain through:
//
// - JSX reached through a non-JSX node — a `.map()` callback, an attribute value
//   — starts a fresh chain instead of nesting under its container, so a mapped
//   `<li>` reads `List/li[0]`, not `List/ul[0]/li[0]`. Looking through child
//   expressions but not attribute ones is the only correct widening, and telling
//   the two apart is real work; looking through both would let
//   `<div icon={<A/>} />` claim a containment that does not exist. The damage is
//   one link, not a subtree: `List/li[0]/Card[0]` below it still nests.
// - A fragment-rooted set of siblings all index `[0]`, since there is no element
//   container to number them within. They stay distinct by tag, or by `#n`.
// - A class component is named by its nearest named declaration, which is
//   `render` rather than the class.
// - The `#n` suffix that separates otherwise-identical paths is positional — it
//   counts visit order within the file — so inserting a twin ahead of its
//   siblings shifts every later suffix down, which is the very fragility that
//   dropping offsets was meant to remove. The scheme survives that because the
//   alternatives are worse (prop signatures cannot separate two identically
//   propped buttons; hashing source text would make a prop edit read as a new
//   node) and because nothing here diffs path sets in code. The three shapes
//   above sharpen it, since each one manufactures the collisions `#n` breaks.
//
// So the contract is uniqueness within a file, and nothing more. Do not treat
// path equality across two censuses as node identity: with `#n` in play a set
// difference will report a moved node as new. Deciding new-versus-moved is the
// judge's job, weighing both node lists against the diff.
import ts from 'typescript';

type JsxNode = ts.JsxElement | ts.JsxSelfClosingElement;

function isJsxNode(node: ts.Node): node is JsxNode {
  return ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node);
}

/**
 * The dotted tag name, built from the identifiers rather than sliced out of the
 * source, so comments and line breaks inside a member expression stay out of the
 * path. Reformatting must not move a node.
 */
function tagText(name: ts.JsxTagNameExpression): string {
  if (ts.isIdentifier(name)) return name.text;
  if (name.kind === ts.SyntaxKind.ThisKeyword) return 'this';
  if (ts.isJsxNamespacedName(name)) return `${name.namespace.text}:${name.name.text}`;
  return `${tagText(name.expression)}.${name.name.text}`;
}

/** The tag as written, for either element spelling. */
export function elementTag(element: JsxNode): string {
  return tagText(ts.isJsxElement(element) ? element.openingElement.tagName : element.tagName);
}

/**
 * Attribute names in source order; a spread contributes the literal `...`.
 *
 * Sliced from source rather than rebuilt like `tagText`, and deliberately so:
 * these are descriptive payload for the judge, not part of a path, so trivia in
 * a namespaced name cannot move a node. The asymmetry is a choice, not an
 * oversight.
 */
export function propNames(element: JsxNode): string[] {
  const attributes = ts.isJsxElement(element)
    ? element.openingElement.attributes
    : element.attributes;
  return attributes.properties.map((property) =>
    ts.isJsxAttribute(property) ? property.name.getText() : '...'
  );
}

/** The element children of a container, with fragments spliced in place. */
function elementChildren(container: ts.JsxElement | ts.JsxFragment): JsxNode[] {
  return container.children.flatMap((child) => {
    if (ts.isJsxFragment(child)) return elementChildren(child);
    return isJsxNode(child) ? [child] : [];
  });
}

/** The nearest enclosing JSX container, looking through fragments. */
function containerOf(element: JsxNode): ts.JsxElement | undefined {
  let node: ts.Node | undefined = element.parent;
  while (node !== undefined && ts.isJsxFragment(node)) node = node.parent;
  return node !== undefined && ts.isJsxElement(node) ? node : undefined;
}

const NAMED_DECLARATIONS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.PropertyAssignment,
  ts.SyntaxKind.PropertyDeclaration,
]);

/** The nearest named declaration around the element, or `<module>` for none. */
function declarationName(element: JsxNode): string {
  for (let node: ts.Node | undefined = element.parent; node !== undefined; node = node.parent) {
    if (!NAMED_DECLARATIONS.has(node.kind)) continue;
    const name = (node as { name?: ts.Node }).name;
    if (name !== undefined && ts.isIdentifier(name)) return name.text;
  }
  return '<module>';
}

/** The path for one element, before repeats are disambiguated. */
function basePath(element: JsxNode): string {
  const segments: string[] = [];
  for (let node: JsxNode | undefined = element; node !== undefined; node = containerOf(node)) {
    const container = containerOf(node);
    // `indexOf` cannot miss: `containerOf` returns a container only by walking
    // up from `node` through fragments, and `elementChildren` walks back down
    // the same fragments, so `node` is always in the list.
    const index = container === undefined ? 0 : elementChildren(container).indexOf(node);
    segments.unshift(`${elementTag(node)}[${index}]`);
  }
  return `${declarationName(element)}/${segments.join('/')}`;
}

/**
 * A path builder for one file. Call the result once per element, in a traversal
 * order that a later run over the same file will reproduce.
 *
 * Both obligations are load-bearing, because repeats are disambiguated by a
 * positional `#n` suffix: two roots of one declaration (`cond ? <A/> : <A/>`)
 * would otherwise share a path, and a colliding path answers no question. Visit
 * an element twice, skip one, or walk in a different order than the run being
 * compared against, and the suffixes stop lining up.
 */
export function createNodePathBuilder(): (element: JsxNode) => string {
  const seen = new Map<string, number>();
  return (element) => {
    const base = basePath(element);
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    return occurrence === 1 ? base : `${base}#${occurrence}`;
  };
}
