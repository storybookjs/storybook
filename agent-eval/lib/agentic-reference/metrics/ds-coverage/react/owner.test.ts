import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { ownerKey, ownerName } from './owner.ts';

/** The owner name computed for every JSX element in `source`, in source order. */
function owners(source: string): Array<string | null> {
  const sourceFile = ts.createSourceFile(
    'test.tsx',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX
  );
  const out: Array<string | null> = [];
  const walk = (node: ts.Node): void => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) out.push(ownerName(node));
    ts.forEachChild(node, walk);
  };
  walk(sourceFile);
  return out;
}

describe('ownerName', () => {
  it('names a function declaration', () => {
    expect(owners('function App() { return <div /> }')).toEqual(['App']);
  });

  it('names a variable declaration, and the right declarator of a list', () => {
    expect(owners('const A = () => <a />, B = () => <b />')).toEqual(['A', 'B']);
  });

  it('names a class declaration by the class, not by render', () => {
    // node-path's declarationName() roots the *path* at `render`; the owner is
    // the identity usages resolve to, which is the class itself.
    expect(owners('class Card { render() { return <div /> } }')).toEqual(['Card']);
  });

  it('names a compound-component assignment by the property', () => {
    // `Card.Header = …` is analyzed by memberOf() under the property name, so
    // usages of <Card.Header/> resolve to `Header`.
    expect(owners('Card.Header = () => <header />')).toEqual(['Header']);
  });

  it('names an anonymous default export `default`, a named one by its name', () => {
    expect(owners('export default function () { return <div /> }')).toEqual(['default']);
    expect(owners('export default function Page() { return <div /> }')).toEqual(['Page']);
    expect(owners('export default () => <div />')).toEqual(['default']);
  });

  it('attributes a nested component to the enclosing top-level declaration', () => {
    // Inner renders as part of Page, so its markup is Page's markup.
    expect(owners('const Page = () => { const Inner = () => <i />; return <div /> }')).toEqual([
      'Page',
      'Page',
    ]);
  });

  it('returns null for loose module-level JSX', () => {
    expect(owners('render(<App />)')).toEqual([null]);
  });
});

describe('ownerKey', () => {
  it('formats declaration and module-bucket keys', () => {
    expect(ownerKey('src/App.tsx', 'App')).toBe('src/App.tsx#App');
    // '<' cannot appear in an identifier, so the bucket cannot collide.
    expect(ownerKey('src/main.tsx', null)).toBe('src/main.tsx#<module>');
  });
});
