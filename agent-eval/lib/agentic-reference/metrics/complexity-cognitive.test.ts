import { describe, expect, it } from 'vitest';

import { cognitiveForSource } from './complexity-cognitive.ts';

function scoreOf(source: string, name: string, filename = 'a.ts'): number | undefined {
  return cognitiveForSource(filename, source).find((entry) => entry.name === name)?.complexity;
}

describe('cognitiveForSource', () => {
  it('charges nothing for entering a function', () => {
    expect(scoreOf('function a(){ return 1; }', 'a')).toBe(0);
  });

  it('charges 1 for a single if', () => {
    expect(scoreOf('function a(x){ if (x) return 1; return 0; }', 'a')).toBe(1);
  });

  it('charges nesting: a nested if costs more than a flat one', () => {
    const source = 'function a(x,y){ if (x) { if (y) { return 1; } } return 0; }';
    // outer if +1 (depth 0), inner if +1+1 (depth 1) = 3
    expect(scoreOf(source, 'a')).toBe(3);
  });

  it('charges three levels of nesting cumulatively', () => {
    const source = 'function a(x,y,z){ if (x) { if (y) { if (z) { return 1; } } } return 0; }';
    // +1, +2, +3 = 6
    expect(scoreOf(source, 'a')).toBe(6);
  });

  it('charges a switch once regardless of case count', () => {
    const source = `function a(n){
      switch (n) { case 1: return 'one'; case 2: return 'two'; default: return 'lots'; }
    }`;
    expect(scoreOf(source, 'a')).toBe(1);
  });

  it('charges else and else-if without a nesting penalty', () => {
    const source = `function a(x){
      if (x === 1) return 1;
      else if (x === 2) return 2;
      else return 3;
    }`;
    // if +1, else-if +1, else +1 = 3, all flat
    expect(scoreOf(source, 'a')).toBe(3);
  });

  it('charges a run of like operators once', () => {
    expect(scoreOf('function a(b,c,d){ if (b && c && d) return 1; return 0; }', 'a')).toBe(2);
  });

  it('charges each distinct operator run separately', () => {
    expect(scoreOf('function a(b,c,d){ if (b && c || d) return 1; return 0; }', 'a')).toBe(3);
  });

  it('charges loops and catch with nesting', () => {
    const source = `function a(items){
      for (const item of items) { try { use(item); } catch (e) { report(e); } }
    }`;
    // for +1 (depth 0), catch +1+1 (depth 1) = 3
    expect(scoreOf(source, 'a')).toBe(3);
  });

  it('charges a ternary', () => {
    expect(scoreOf('function a(x){ return x ? 1 : 0; }', 'a')).toBe(1);
  });

  it('matches the white paper sumOfPrimes example', () => {
    const source = `function sumOfPrimes(max) {
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
    }`;
    // for +1, nested for +2, if +3, labelled continue +1 = 7
    expect(scoreOf(source, 'sumOfPrimes')).toBe(7);
  });

  it('scores nested functions separately and counts their nesting', () => {
    const source = `function outer(x) {
      if (x) {}
      const inner = (y) => { if (y) { if (y > 1) {} } };
      return inner;
    }`;
    expect(scoreOf(source, 'outer')).toBe(1);
    // The arrow is measured on its own, from depth 0.
    expect(scoreOf(source, 'inner')).toBe(3);
  });

  it('absorbs an inline callback one nesting level deep, per the lambda rule', () => {
    const source = 'function process(items){ items.forEach((item) => { if (item) use(item); }); }';
    // the forEach lambda increments nesting, so the if costs 1 + 1
    expect(cognitiveForSource('a.ts', source)).toEqual([{ name: 'process', complexity: 2 }]);
  });

  it('keeps a top-level callback, with nothing to absorb into, as a unit', () => {
    const source = "test('x', () => { if (a) { if (b) c(); } });";
    // measured on its own from depth 0: if +1, nested if +2
    expect(cognitiveForSource('a.ts', source)).toEqual([{ name: '<anonymous>', complexity: 3 }]);
  });

  it('returns [] for non-script files', () => {
    expect(cognitiveForSource('a.md', '# hi')).toEqual([]);
  });

  it('returns [] rather than throwing on unparseable input', () => {
    expect(() => cognitiveForSource('a.ts', 'function ( { { {')).not.toThrow();
  });

  it('does not charge a function for merely existing, unlike cyclomatic', () => {
    // Three trivial helpers: cyclomatic would total 3, cognitive totals 0.
    const source = 'const a = () => 1;\nconst b = () => 2;\nconst c = () => 3;\n';
    const total = cognitiveForSource('a.ts', source).reduce((sum, e) => sum + e.complexity, 0);
    expect(total).toBe(0);
  });
});
