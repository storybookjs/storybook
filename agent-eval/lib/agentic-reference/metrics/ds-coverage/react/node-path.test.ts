import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { createNodePathBuilder, elementTag, propNames } from './node-path.ts';

type JsxNode = ts.JsxElement | ts.JsxSelfClosingElement;

/** Applies `visit` to every JSX element in `source`, in source order. */
function collect<T>(source: string, visit: (element: JsxNode) => T): T[] {
  const sourceFile = ts.createSourceFile(
    'test.tsx',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX
  );
  const out: T[] = [];
  const walk = (node: ts.Node): void => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) out.push(visit(node));
    ts.forEachChild(node, walk);
  };
  walk(sourceFile);
  return out;
}

/** Every JSX element in `source`, paired with the path built for it. */
function paths(source: string): string[] {
  return collect(source, createNodePathBuilder());
}

describe('createNodePathBuilder', () => {
  it('names the enclosing declaration and indexes element siblings', () => {
    expect(paths('const App = () => <div><A /><B /></div>')).toEqual([
      'App/div[0]',
      'App/div[0]/A[0]',
      'App/div[0]/B[1]',
    ]);
  });

  // Text and expression children are not elements, so they must not advance
  // the index — otherwise adding a label would renumber every sibling.
  it('ignores text and expression children when indexing', () => {
    expect(paths('const App = () => <div>hi {x} <A /></div>')).toEqual([
      'App/div[0]',
      'App/div[0]/A[0]',
    ]);
  });

  // The reason this module exists. Paths carry no offsets, so the only thing an
  // insertion above a node changes is where it sits in the file.
  it('keeps a path when an insertion above pushes the node down the file', () => {
    const body = 'const App = () => <div><A /></div>';
    expect(paths(`const x = 1;\nconst y = 2;\n${body}`)).toEqual(paths(body));
  });

  // The path describes the source. The resolved identity travels beside it.
  it('uses the dotted tag text for member expressions', () => {
    expect(paths('const App = () => <Card.Header />')).toEqual(['App/Card.Header[0]']);
  });

  // Fragments render nothing, so wrapping a subtree in one must not change any
  // path — the census already treats them as non-rendering. One side is pinned
  // to a literal so that two identical regressions cannot pass as agreement.
  it('makes fragments transparent to both segments and indices', () => {
    const without = paths('const App = () => <div><A /><B /></div>');
    expect(without).toEqual(['App/div[0]', 'App/div[0]/A[0]', 'App/div[0]/B[1]']);
    expect(paths('const App = () => <div><><A /><B /></></div>')).toEqual(without);
  });

  // Two root elements in one declaration would otherwise collide, and a
  // colliding path cannot answer "is this new or did it move?".
  it('disambiguates repeated paths within a file', () => {
    expect(paths('const App = () => ok ? <A /> : <A />')).toEqual(['App/A[0]', 'App/A[0]#2']);
  });

  it('falls back to <module> outside any named declaration', () => {
    expect(paths('export default <A />')).toEqual(['<module>/A[0]']);
  });
});

// The four shapes the module header records as known limitations. They are
// pinned because the format is a wire format: a change here silently invalidates
// every committed baseline census file, which is horrible to diagnose after the fact.
describe('createNodePathBuilder documented limitations', () => {
  it('starts a fresh chain for JSX reached through a non-JSX node', () => {
    // The `ul` -> `li` link is lost, but `li` -> `A` below it still nests.
    expect(paths('const App = () => <ul>{items.map((i) => <li><A /></li>)}</ul>')).toEqual([
      'App/ul[0]',
      'App/li[0]',
      'App/li[0]/A[0]',
    ]);
  });

  it('indexes every fragment-rooted sibling at [0]', () => {
    expect(paths('const App = () => <><A /><B /></>')).toEqual(['App/A[0]', 'App/B[0]']);
  });

  it('names a class component by its render method', () => {
    expect(paths('class C { render() { return <div />; } }')).toEqual(['render/div[0]']);
  });

  // The #n suffix is positional, so it is not relocation-stable. A consumer that
  // diffs path sets across two censuses would read Cancel here as the new node.
  it('shifts #n suffixes when a twin is inserted ahead of its siblings', () => {
    const before = 'const App = () => <><Button>Save</Button><Button>Cancel</Button></>';
    const after =
      'const App = () => <><Button>Delete</Button><Button>Save</Button><Button>Cancel</Button></>';
    expect(paths(before)).toEqual(['App/Button[0]', 'App/Button[0]#2']);
    expect(paths(after)).toEqual(['App/Button[0]', 'App/Button[0]#2', 'App/Button[0]#3']);
  });
});

describe('elementTag', () => {
  it('reads the tag off both element spellings', () => {
    expect(collect('const A = () => <Outer><Inner /></Outer>', elementTag)).toEqual([
      'Outer',
      'Inner',
    ]);
  });

  // Built from the identifiers, not sliced out of the source, so that a comment
  // or a line break inside the tag cannot leak into a path. Reformatting a file
  // must not look like the node moved.
  it('leaves source trivia inside a member expression out of the tag', () => {
    expect(collect('const A = () => <Card /* c */ .\n\tHeader />', elementTag)).toEqual([
      'Card.Header',
    ]);
  });
});

describe('propNames', () => {
  it('lists attribute names and marks spreads', () => {
    expect(collect('const A = () => <B variant="x" {...rest} onClick={f} />', propNames)).toEqual([
      ['variant', '...', 'onClick'],
    ]);
  });
});
