import { describe, expect, it } from 'vitest';

import { cognitiveForSource } from './complexity-cognitive.ts';
import { complexityForSource } from './complexity-cyclomatic.ts';
import { jsxCognitiveForSource, jsxCyclomaticForSource } from './complexity-jsx.ts';
import { jsxStructureForSource } from './jsx-structure.ts';

function cyclomaticOf(source: string, name: string, filename = 'a.tsx'): number | undefined {
  return jsxCyclomaticForSource(filename, source).find((entry) => entry.name === name)?.complexity;
}

function cognitiveOf(source: string, name: string, filename = 'a.tsx'): number | undefined {
  return jsxCognitiveForSource(filename, source).find((entry) => entry.name === name)?.complexity;
}

// The variants must be strict supersets: on source with no JSX, every function
// scores exactly what the classic walkers give it. Checked with deep equality,
// so names and ordering are held equal too, not just the totals.
describe('equivalence with the classic metrics on JSX-free source', () => {
  const SOURCES: Record<string, string> = {
    'white paper sumOfPrimes': `function sumOfPrimes(max) {
      let total = 0;
      OUT: for (let i = 1; i <= max; ++i) {
        for (let j = 2; j < i; ++j) {
          if (i % j === 0) {
            continue OUT;
          }
        }
        total += i;
      }
      return total;
    }`,
    'else-if chain': `function grade(x){
      if (x === 1) return 'a';
      else if (x === 2) return 'b';
      else return 'c';
    }`,
    'operator runs': 'function a(b,c,d){ if (b && c || d) return 1; return 0; }',
    'loops and catch': `function a(items){
      for (const item of items) { try { use(item); } catch (e) { report(e); } }
    }`,
    'class members': `class Point {
      constructor(x) { this.x = x; }
      get valid() { return this.x > 0 ? 1 : 0; }
      scale(f) { while (f--) { this.x *= 2; } return this; }
    }`,
    'nested functions': `function outer(x) {
      if (x) {}
      const inner = (y) => { if (y) { if (y > 1) {} } };
      return inner;
    }`,
    'absorbed inline callbacks': `function highest(items) {
      return items.reduce((a, b) => a > b ? a : b, 0);
    }`,
    'generic arrow in .ts': 'const id = <T>(x: T): T => x;',
    'ternary and switch': `function pick(n){
      switch (n) { case 1: return 'one'; default: return n > 0 ? 'some' : 'none'; }
    }`,
  };

  for (const [label, source] of Object.entries(SOURCES)) {
    it(`scores ${label} identically`, () => {
      expect(jsxCyclomaticForSource('a.ts', source)).toEqual(complexityForSource('a.ts', source));
      expect(jsxCognitiveForSource('a.ts', source)).toEqual(cognitiveForSource('a.ts', source));
    });
  }

  it('scores a JSX-free .tsx file identically too', () => {
    const source = 'function a(x){ if (x) return 1; return 0; }';
    expect(jsxCyclomaticForSource('a.tsx', source)).toEqual(complexityForSource('a.tsx', source));
    expect(jsxCognitiveForSource('a.tsx', source)).toEqual(cognitiveForSource('a.tsx', source));
  });
});

describe('jsxCyclomaticForSource', () => {
  it('charges nothing for markup itself: size lives in jsx-structure', () => {
    expect(jsxCyclomaticForSource('a.tsx', 'const C = () => <div><span>hi</span></div>;')).toEqual([
      { name: 'C', complexity: 1 },
    ]);
  });

  it('counts a conditional render through the classic decision core', () => {
    expect(cyclomaticOf('const C = (x) => <div>{x ? <A/> : <B/>}</div>;', 'C')).toBe(2);
  });

  it('counts conditions per operator: |cond| - 1', () => {
    // three && operators between four operands
    expect(cyclomaticOf('const C = (a, b, c) => <div>{a && b && c && <A/>}</div>;', 'C')).toBe(4);
  });

  it('charges a render loop and absorbs its callback into the component', () => {
    const source = 'const C = (items) => <ul>{items.map((item) => <li>{item}</li>)}</ul>;';
    // one entry: base 1 + the map loop; the callback is no unit of its own
    expect(jsxCyclomaticForSource('a.tsx', source)).toEqual([{ name: 'C', complexity: 2 }]);
  });

  it('charges a map with a named callback when it renders inside JSX', () => {
    expect(cyclomaticOf('const C = (items) => <ul>{items.map(renderRow)}</ul>;', 'C')).toBe(2);
  });

  it('does not charge a named-callback map outside JSX, where it is data work', () => {
    expect(cyclomaticOf('function rows(items){ return items.map(renderRow); }', 'rows')).toBe(1);
  });

  it('charges a markup-producing inline callback anywhere, e.g. a returned map', () => {
    const source = 'function rows(items) { return items.map((item) => <li key={item}/>); }';
    expect(jsxCyclomaticForSource('a.tsx', source)).toEqual([{ name: 'rows', complexity: 2 }]);
  });

  it('does not charge an inline callback that builds no markup', () => {
    const source = 'const C = (items) => <div>{items.reduce((a, b) => a + b, 0)}</div>;';
    // reduce is not map-like and its callback is arithmetic, not rendering
    expect(jsxCyclomaticForSource('a.tsx', source)).toEqual([{ name: 'C', complexity: 1 }]);
  });

  it('counts an absorbed handler’s branches toward the component', () => {
    const source = 'const C = (x) => <Button onClick={() => { if (x) f(); }}/>;';
    expect(jsxCyclomaticForSource('a.tsx', source)).toEqual([{ name: 'C', complexity: 2 }]);
  });

  it('returns [] for non-script files', () => {
    expect(jsxCyclomaticForSource('a.md', '# hi')).toEqual([]);
  });

  it('returns [] rather than throwing on unparseable input', () => {
    expect(() =>
      jsxCyclomaticForSource('a.tsx', 'const C = () => <div><span></div>;')
    ).not.toThrow();
  });
});

describe('jsxCognitiveForSource', () => {
  it('charges nothing for a leaf element: width is jsx-structure’s business', () => {
    expect(cognitiveOf('const C = () => <div>hi</div>;', 'C')).toBe(0);
  });

  it('charges a structural element 1 plus its depth', () => {
    expect(cognitiveOf('const C = () => <div><span>hi</span></div>;', 'C')).toBe(1);
  });

  it('charges markup depth cumulatively, like nested ifs', () => {
    // a +1, b +2, c +3, leaf d +0 = 6 — the markup twin of three nested ifs
    expect(cognitiveOf('const C = () => <a><b><c><d>x</d></c></b></a>;', 'C')).toBe(6);
  });

  it('charges a ternary at its markup depth', () => {
    const source = 'const C = (x) => <div><section>{x ? <A/> : <B/>}</section></div>;';
    // div +1; section is a leaf but deepens; ternary at depth 2 costs 3
    expect(cognitiveOf(source, 'C')).toBe(4);
  });

  it('keeps an operator run flat in child position, per the Sonar rule', () => {
    expect(cognitiveOf('const C = (ready) => <div>{ready && <A/>}</div>;', 'C')).toBe(1);
  });

  it('keeps an operator run flat in an attribute value', () => {
    expect(cognitiveOf('const C = (a, b) => <Button disabled={a && b}/>;', 'C')).toBe(1);
  });

  it('charges a run of like operators once', () => {
    expect(cognitiveOf('const C = (a, b) => <div>{a && b && <A/>}</div>;', 'C')).toBe(1);
  });

  it('charges each distinct operator run separately', () => {
    // (a && b) || c: one || run, one && run
    expect(cognitiveOf('const C = (a, b, c) => <div>{a && b || c}</div>;', 'C')).toBe(2);
  });

  it('deepens through fragments without charging them', () => {
    expect(cognitiveOf('const C = () => <><div/><div/></>;', 'C')).toBe(0);
    // the ternary sits one level in, under the fragment
    expect(cognitiveOf('const C = (x) => <>{x ? <A/> : null}</>;', 'C')).toBe(2);
  });

  it('makes an element structural when its markup child sits inside a fragment', () => {
    expect(cognitiveOf('const C = () => <main><><A/></></main>;', 'C')).toBe(1);
  });

  it('charges a render loop like a loop, and absorbs its callback', () => {
    const source = 'const C = (items) => <ul>{items.map((item) => <li/>)}</ul>;';
    // ul is a leaf but deepens; the map call at depth 1 costs 2; one entry
    expect(jsxCognitiveForSource('a.tsx', source)).toEqual([{ name: 'C', complexity: 2 }]);
  });

  it('continues depth into the looped markup through the absorbed callback', () => {
    const source = 'const C = (items) => <ul>{items.map((item) => <li><b/></li>)}</ul>;';
    // map at depth 1 costs 2; the callback deepens once, so li is structural
    // at depth 2 and costs 3
    expect(cognitiveOf(source, 'C')).toBe(5);
  });

  it('charges a named-callback map inside JSX like any loop', () => {
    expect(cognitiveOf('const C = (items) => <ul>{items.map(renderRow)}</ul>;', 'C')).toBe(2);
  });

  it('counts an absorbed handler at its depth inside the tag', () => {
    const source = 'const C = (x) => <Button onClick={() => { if (x) f(); }}/>;';
    // attributes sit one level inside the tag, the lambda deepens once more:
    // the if costs 1 + 2
    expect(jsxCognitiveForSource('a.tsx', source)).toEqual([{ name: 'C', complexity: 3 }]);
  });

  it('compounds statement nesting and markup nesting into one depth', () => {
    const source = `function C(x) {
      if (x) {
        return <div><span>{x > 1 ? 'a' : 'b'}</span></div>;
      }
      return null;
    }`;
    // if +1; div under the if +2; span deepens; ternary at depth 3 +4
    expect(cognitiveOf(source, 'C')).toBe(7);
  });

  it('keeps name-bound functions separate, measured from depth 0', () => {
    const source = `function outer(x) {
      if (x) {}
      const inner = () => <div><span/></div>;
      return inner;
    }`;
    expect(cognitiveOf(source, 'outer')).toBe(1);
    expect(cognitiveOf(source, 'inner')).toBe(1);
  });

  it('returns [] for non-script files', () => {
    expect(jsxCognitiveForSource('a.md', '# hi')).toEqual([]);
  });

  it('returns [] rather than throwing on unparseable input', () => {
    expect(() =>
      jsxCognitiveForSource('a.tsx', 'const C = () => <div><span></div>;')
    ).not.toThrow();
  });
});

// The motivating case: a component whose logic is two trivial branches, but
// whose markup — a conditional render two levels deep, a list render three
// levels deep, seven tags, six live bindings — is where the reading cost is.
describe('a markup-heavy component', () => {
  const source = `const Page = ({ user, items }) => (
    <main>
      <header className="top">
        <h1>Title</h1>
        {user && <span>{user.name}</span>}
      </header>
      <section>
        <ul>
          {items.map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
        </ul>
      </section>
    </main>
  );`;

  it('is nearly invisible to the classic metrics', () => {
    expect(complexityForSource('a.tsx', source)).toEqual([{ name: 'Page', complexity: 2 }]);
    expect(cognitiveForSource('a.tsx', source)).toEqual([{ name: 'Page', complexity: 1 }]);
  });

  it('is priced by the jsx variants as render flow', () => {
    // cyclomatic: base 1 + the && + the map loop
    expect(cyclomaticOf(source, 'Page')).toBe(3);
    // cognitive: main +1, header +2, section +2, && flat +1, map at depth 3 +4
    expect(cognitiveOf(source, 'Page')).toBe(10);
  });

  it('is priced by jsx-structure as markup size', () => {
    expect(jsxStructureForSource('a.tsx', source)).toEqual({
      jsxLength: 7,
      jsxBindings: 6,
      jsxDepthTotal: 4,
      jsxTrees: 1,
    });
  });
});
