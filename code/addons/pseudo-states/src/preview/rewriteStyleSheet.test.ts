import { describe, expect, it, vi } from 'vitest';

import { rewriteStyleSheet } from './rewriteStyleSheet.ts';
import { splitSelectors } from './splitSelectors.ts';

function splitRules(cssText: string): string[] {
  let ruleStart: number | undefined;
  let depth = 0;
  const rules: string[] = [];
  const chars = [...cssText];
  chars.forEach((c, i) => {
    if (c === '{') {
      depth++;
    } else if (c === '}') {
      if (--depth === 0) {
        rules.push(cssText.substring(ruleStart!, i + 1));
        ruleStart = undefined;
      }
    } else if (ruleStart === undefined && c !== ' ' && c !== '\n') {
      ruleStart = i;
    }
  });
  return rules;
}

abstract class Rule {
  constructor(readonly cssText: string) {}

  selectorText?: string;

  static parse(cssText: string): Rule {
    if (cssText.trim().startsWith('@')) {
      return new GroupingRule(cssText);
    }

    const innerCssText = cssText.substring(cssText.indexOf('{') + 1, cssText.lastIndexOf('}'));
    return innerCssText.includes('{') ? new NestedStyleRule(cssText) : new StyleRule(cssText);
  }

  getSelectors(): string[] {
    return this.selectorText ? splitSelectors(this.selectorText) : [];
  }

  toString() {
    return this.cssText;
  }
}

class StyleRule extends Rule {
  __processed = false;

  __pseudoStatesRewrittenCount = 0;

  constructor(cssText: string) {
    super(cssText);
    if (cssText.trim().startsWith('@')) {
      throw new Error('StyleRule cannot start with @');
    }
    this.selectorText = cssText.substring(0, cssText.indexOf(' {'));
  }
}

class GroupingRule extends Rule {
  cssRules: Rule[];

  constructor(cssText: string) {
    super(cssText);
    const innerCssText = cssText.substring(cssText.indexOf('{') + 1, cssText.lastIndexOf('}'));
    this.cssRules = splitRules(innerCssText).map((x) => Rule.parse(x));
  }

  deleteRule(index: number) {
    this.cssRules.splice(index, 1);
  }

  insertRule(cssText: string, index: number) {
    this.cssRules.splice(index, 0, Rule.parse(cssText));
  }
}

class NestedStyleRule extends GroupingRule {
  constructor(cssText: string) {
    super(cssText);
    this.selectorText = cssText.substring(0, cssText.indexOf(' {'));
  }
}

class Sheet {
  cssRules: Rule[];

  constructor(cssText: string) {
    this.cssRules = splitRules(cssText).map((x) => Rule.parse(x));
  }

  deleteRule(index: number) {
    this.cssRules.splice(index, 1);
  }

  insertRule(cssText: string, index: number) {
    this.cssRules.splice(index, 0, Rule.parse(cssText));
  }
}

describe('rewriteStyleSheet', () => {
  it('returns true if a rule was rewritten', () => {
    const sheet = new Sheet('a:hover { color: red }');
    expect(rewriteStyleSheet(sheet as any)).toEqual(true);
  });

  it('returns true if a nested rule was rewritten', () => {
    const sheet = new Sheet('@layer foo { a:hover { color: red } }');
    expect(rewriteStyleSheet(sheet as any)).toEqual(true);
  });

  it('returns false if no rules were rewritten', () => {
    const sheet = new Sheet(`
      a { color: red }
      @layer foo {
        a { color: red }
      }
    `);
    expect(rewriteStyleSheet(sheet as any)).toEqual(false);
  });

  it('does not create additional rules', () => {
    const sheet = new Sheet('a:hover { color: red }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules.length).toEqual(1);
  });

  it('does not remove original selector', () => {
    const sheet = new Sheet('a:hover { color: red }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].getSelectors()).toContain('a:hover');
  });

  it('adds alternative selector targeting the element directly', () => {
    const sheet = new Sheet('a:hover { color: red }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].getSelectors()).toContain('a.pseudo-hover');
  });

  it('adds alternative selector targeting an ancestor', () => {
    const sheet = new Sheet('a:hover { color: red }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].getSelectors()).toContain('.pseudo-hover-all a');
  });

  it('does not add unexpected selectors', () => {
    const sheet = new Sheet('a:hover { color: red }');
    rewriteStyleSheet(sheet as any);
    expect(
      sheet.cssRules[0]
        .getSelectors()
        .filter((x) => !['a:hover', 'a.pseudo-hover', '.pseudo-hover-all a'].includes(x))
    ).toEqual([]);
  });

  it('does not add invalid selector where .pseudo-<class> would be appended to ::-webkit-* pseudo-element', () => {
    const sheet = new Sheet('::-webkit-foo-bar:hover { border-color: transparent; }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].getSelectors()).not.toContain('::-webkit-foo-bar.pseudo-hover');
    expect(sheet.cssRules[0].getSelectors()).toContain('.pseudo-hover-all ::-webkit-foo-bar');
  });

  it('does not add invalid selector where .pseudo-<class> would be appended to ::-moz-* pseudo-element', () => {
    const sheet = new Sheet('::-moz-foo-bar-baz:hover { border-color: transparent; }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].getSelectors()).not.toContain('::-moz-foo-bar-baz.pseudo-hover');
    expect(sheet.cssRules[0].getSelectors()).toContain('.pseudo-hover-all ::-moz-foo-bar-baz');
  });

  it('does not add invalid selector where .pseudo-<class> would be appended to ::-ms-* pseudo-element', () => {
    const sheet = new Sheet('::-ms-foo:hover { border-color: transparent; }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].getSelectors()).not.toContain('::-ms-foo.pseudo-hover');
    expect(sheet.cssRules[0].getSelectors()).toContain('.pseudo-hover-all ::-ms-foo');
  });

  it('adds alternative selector when .pseudo-<class> would not be appended to pseudo-element', () => {
    const sheet = new Sheet('div:hover::-webkit-scrollbar-thumb { border-color: transparent; }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].getSelectors()).toContain('div.pseudo-hover::-webkit-scrollbar-thumb');
  });

  it('only skips direct replacements that belong to an excluded pseudo-element', () => {
    const sheet = new Sheet(
      '::-webkit-scrollbar-thumb:hover .button:focus { border-color: transparent; }'
    );
    rewriteStyleSheet(sheet as any);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain('::-webkit-scrollbar-thumb:hover .button.pseudo-focus');
    expect(selectors).not.toContain('::-webkit-scrollbar-thumb.pseudo-hover .button.pseudo-focus');
    expect(selectors).toContain(
      '.pseudo-hover-all.pseudo-focus-all ::-webkit-scrollbar-thumb .button'
    );
  });

  it('does not add invalid selector where .pseudo-<class> would be appended to ::part()', () => {
    const sheet = new Sheet('::part(foo bar):hover { border-color: transparent; }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].getSelectors()).not.toContain('::part(foo bar).pseudo-hover');
    expect(sheet.cssRules[0].getSelectors()).toContain('.pseudo-hover-all ::part(foo bar)');
  });

  it('adds alternative selector when .pseudo-<class> would not be appended to ::part()', () => {
    const sheet = new Sheet('custom-elt:hover::part(foo bar) { border-color: transparent; }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].getSelectors()).toContain('custom-elt.pseudo-hover::part(foo bar)');
  });

  it('does not replace :is() with :is(*)', () => {
    const sheet = new Sheet(':is():hover { color: red }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].getSelectors()).toContain('.pseudo-hover-all :is()');
  });

  it('adds alternative selector for each pseudo selector', () => {
    const sheet = new Sheet('a:hover, a:focus { color: red }');
    rewriteStyleSheet(sheet as any);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain('a.pseudo-hover');
    expect(selectors).toContain('a.pseudo-focus');
    expect(selectors).toContain('.pseudo-hover-all a');
    expect(selectors).toContain('.pseudo-focus-all a');
  });

  it('keeps non-pseudo selectors as-is', () => {
    const sheet = new Sheet('a.class, a:hover, a:focus, a#id { color: red }');
    rewriteStyleSheet(sheet as any);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain('a.class');
    expect(selectors).toContain('a#id');
  });

  it('does not duplicate selectors on subsequent rewrites', () => {
    const sheet = new Sheet('a:hover { color: red }');
    rewriteStyleSheet(sheet as any);
    rewriteStyleSheet(sheet as any);
    const selectors = sheet.cssRules[0].getSelectors();
    selectors.splice(selectors.indexOf('a.pseudo-hover'), 1);
    expect(selectors).not.toContain('a.pseudo-hover');
  });

  it('does not mutate a rewritten rule again on subsequent rewrites', () => {
    const sheet = new Sheet('a:hover { color: red }');
    const deleteRule = vi.spyOn(sheet, 'deleteRule');
    const insertRule = vi.spyOn(sheet, 'insertRule');

    rewriteStyleSheet(sheet as any);
    rewriteStyleSheet(sheet as any);

    expect(deleteRule).toHaveBeenCalledOnce();
    expect(insertRule).toHaveBeenCalledOnce();
  });

  it('supports combined pseudo selectors', () => {
    const sheet = new Sheet('a:hover:focus { color: red }');
    rewriteStyleSheet(sheet as any);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain('a.pseudo-hover.pseudo-focus');
    expect(selectors).toContain('.pseudo-hover-all.pseudo-focus-all a');
  });

  it('supports combined pseudo selectors with classes', () => {
    const sheet = new Sheet('.hiOZqY:hover { color: red }');
    rewriteStyleSheet(sheet as any);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain('.hiOZqY:hover');
    expect(selectors).toContain('.hiOZqY.pseudo-hover');
    expect(selectors).toContain('.pseudo-hover-all .hiOZqY');
  });

  it('supports ":host"', () => {
    const sheet = new Sheet(':host(:hover) { color: red }');
    rewriteStyleSheet(sheet as any);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain(':host(:hover)');
    expect(selectors).toContain(':host(.pseudo-hover)');
    expect(selectors).toContain(':host(.pseudo-hover-all)');
  });

  it('supports ":host" with classes', () => {
    const sheet = new Sheet(':host(.a:hover) .c { color: red }');
    rewriteStyleSheet(sheet as any);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain(':host(.a:hover) .c');
    expect(selectors).toContain(':host(.a.pseudo-hover) .c');
    expect(selectors).toContain(':host(.a.pseudo-hover-all) .c');
  });

  it('supports ":host" with state selectors in descendant selector', () => {
    const sheet = new Sheet(':host(.a) .b:hover { color: red }');
    rewriteStyleSheet(sheet as any);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain(':host(.a) .b:hover');
    expect(selectors).toContain(':host(.a) .b.pseudo-hover');
    expect(selectors).toContain(':host(.a.pseudo-hover-all) .b');
  });

  it('supports ":host" with state selectors in :host and descendant selector', () => {
    const sheet = new Sheet(':host(.a:focus) .b:hover { color: red }');
    rewriteStyleSheet(sheet as any);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain(':host(.a:focus) .b:hover');
    expect(selectors).toContain(':host(.a.pseudo-focus) .b.pseudo-hover');
    expect(selectors).toContain(':host(.a.pseudo-focus-all.pseudo-hover-all) .b');
  });

  it('supports ":host-context"', () => {
    const sheet = new Sheet(':host-context(:hover) { color: red }');
    rewriteStyleSheet(sheet as any, true);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain(':host-context(:hover)');
    expect(selectors).toContain(':host-context(.pseudo-hover)');
    expect(selectors).toContain(':host(.pseudo-hover-all)');
  });

  it('supports ":host-context" with classes', () => {
    const sheet = new Sheet(':host-context(.a:hover) .b { color: red }');
    rewriteStyleSheet(sheet as any, true);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain(':host-context(.a:hover) .b');
    expect(selectors).toContain(':host-context(.a.pseudo-hover) .b');
    expect(selectors).toContain(':host-context(.a).pseudo-hover-all .b');
  });

  it('supports ":host-context" with state selectors in descendant selector', () => {
    const sheet = new Sheet(':host-context(.a) .b:hover { color: red }');
    rewriteStyleSheet(sheet as any, true);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain(':host-context(.a) .b:hover');
    expect(selectors).toContain(':host-context(.a) .b.pseudo-hover');
    expect(selectors).toContain(':host-context(.a).pseudo-hover-all .b');
  });

  it('supports ":host-context" with state selectors in :host-context and descendant selector', () => {
    const sheet = new Sheet(':host-context(.a:focus) .b:hover { color: red }');
    rewriteStyleSheet(sheet as any, true);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain(':host-context(.a:focus) .b:hover');
    expect(selectors).toContain(':host-context(.a.pseudo-focus) .b.pseudo-hover');
    expect(selectors).toContain(':host-context(.a).pseudo-focus-all.pseudo-hover-all .b');
  });

  it('supports "::slotted"', () => {
    const sheet = new Sheet('::slotted(:hover) { color: red }');
    rewriteStyleSheet(sheet as any, true);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain('::slotted(:hover)');
    expect(selectors).toContain('::slotted(.pseudo-hover)');
    expect(selectors).toContain(':host(.pseudo-hover-all) ::slotted(*)');
  });

  it('supports "::slotted" with classes', () => {
    const sheet = new Sheet('.a > slot::slotted(.b:hover) { color: red }');
    rewriteStyleSheet(sheet as any, true);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain('.a > slot::slotted(.b:hover)');
    expect(selectors).toContain('.a > slot::slotted(.b.pseudo-hover)');
    expect(selectors).toContain(':host(.pseudo-hover-all) .a > slot::slotted(.b)');
  });

  it('supports ":not"', () => {
    const sheet = new Sheet(':not(:hover) { color: red }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].selectorText).toEqual(
      ':not(:hover), :not(.pseudo-hover), :not(.pseudo-hover-all *)'
    );
  });

  it('supports ":not" in shadow DOM', () => {
    const sheet = new Sheet(':not(:hover) { color: red }');
    rewriteStyleSheet(sheet as any, true);
    expect(sheet.cssRules[0].selectorText).toEqual(
      ':not(:hover), :not(.pseudo-hover), :not(:host(.pseudo-hover-all) *)'
    );
  });

  it('supports complex use of ":not"', () => {
    const sheet = new Sheet('foo:focus:not(:hover, .bar:active) .baz { color: red }');
    rewriteStyleSheet(sheet as any);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain('foo:focus:not(:hover, .bar:active) .baz');
    expect(selectors).toContain('foo.pseudo-focus:not(.pseudo-hover, .bar.pseudo-active) .baz');
    expect(selectors).toContain(
      '.pseudo-focus-all foo:not(.pseudo-hover-all *, .pseudo-active-all .bar) .baz'
    );
  });

  it('supports complex use of ":not" in shadow DOM', () => {
    const sheet = new Sheet('foo:focus:not(:hover, .bar:active) .baz { color: red }');
    rewriteStyleSheet(sheet as any, true);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain('foo:focus:not(:hover, .bar:active) .baz');
    expect(selectors).toContain('foo.pseudo-focus:not(.pseudo-hover, .bar.pseudo-active) .baz');
    expect(selectors).toContain(
      ':host(.pseudo-focus-all) foo:not(:host(.pseudo-hover-all) *, :host(.pseudo-active-all) .bar) .baz'
    );
  });

  it('supports ":not" inside ":host"', () => {
    const sheet = new Sheet(':host(.foo:not(:hover)) .baz:active { color: red }');
    rewriteStyleSheet(sheet as any, true);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain(':host(.foo:not(:hover)) .baz:active');
    expect(selectors).toContain(':host(.foo:not(.pseudo-hover)) .baz.pseudo-active');
    expect(selectors).toContain(':host(.foo:not(.pseudo-hover-all).pseudo-active-all) .baz');
  });

  it('supports ":not" inside and outside of ":host"', () => {
    const sheet = new Sheet(':host(.foo:not(:hover)) .baz:not(:active) { color: red }');
    rewriteStyleSheet(sheet as any, true);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain(':host(.foo:not(:hover)) .baz:not(:active)');
    expect(selectors).toContain(':host(.foo:not(.pseudo-hover)) .baz:not(.pseudo-active)');
    expect(selectors).toContain(
      ':host(.foo:not(.pseudo-hover-all)) .baz:not(:host(.pseudo-active-all) *)'
    );
  });

  it('supports ":has"', () => {
    const sheet = new Sheet(':has(:hover) { color: red }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].cssText).toEqual(
      ':has(:hover), :has(.pseudo-hover), .pseudo-hover-all :has(*) { color: red }'
    );
  });

  it('keeps child-combinator pseudo-state selectors valid', () => {
    const sheet = new Sheet('.ds-card > :focus-visible { outline: none }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].cssText).toEqual(
      '.ds-card > :focus-visible, .ds-card > .pseudo-focus-visible, .pseudo-focus-visible-all .ds-card > * { outline: none }'
    );
  });

  it('keeps pseudo-state selectors valid inside ":has" child combinators', () => {
    const sheet = new Sheet('.ds-card:has(> :focus-visible) { outline: 4px solid blue }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].cssText).toEqual(
      '.ds-card:has(> :focus-visible), .ds-card:has(> .pseudo-focus-visible), .pseudo-focus-visible-all .ds-card:has(> *) { outline: 4px solid blue }'
    );
  });

  it('supports ":has" inside and outside of ":not"', () => {
    const sheet = new Sheet(':has(:not(:hover, :has(:focus), :has(:active))) { color: red }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].cssText).toEqual(
      ':has(:not(:hover, :has(:focus), :has(:active))), :has(:not(.pseudo-hover, :has(.pseudo-focus), :has(.pseudo-active))), :has(:not(.pseudo-hover-all *, .pseudo-focus-all :has(*), .pseudo-active-all :has(*))) { color: red }'
    );
  });

  it('supports combinators nested inside pseudo-classes with parameters', () => {
    const sheet = new Sheet(':has(span > :hover) { color: red }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].cssText).toEqual(
      ':has(span > :hover), :has(span > .pseudo-hover), .pseudo-hover-all :has(span > *) { color: red }'
    );
  });

  it('skips escaped pseudo-selectors "\\:hover"', () => {
    const sheet = new Sheet('a\\:hover { color: red }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules.length).toEqual(1);
    expect(sheet.cssRules[0].cssText).toEqual('a\\:hover { color: red }');
    expect(sheet.cssRules[0].selectorText).toEqual('a\\:hover');
  });

  it('supports "\\\\:hover"', () => {
    const sheet = new Sheet('.btn\\\\:hover { color: red }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].cssText).toEqual(
      '.btn\\\\:hover, .btn\\\\.pseudo-hover, .pseudo-hover-all .btn\\\\ { color: red }'
    );
  });

  it('supports selectors with escaped and unescaped pseudo-selectors', () => {
    const sheet = new Sheet('.foo\\:hover\\:red:hover { color: red }');
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].cssText).toEqual(
      '.foo\\:hover\\:red:hover, .foo\\:hover\\:red.pseudo-hover, .pseudo-hover-all .foo\\:hover\\:red { color: red }'
    );
  });

  it('skips pseudo-selectors preceded by any odd number of backslashes', () => {
    const sheet = new Sheet(String.raw`.btn\\\:hover { color: red }`);
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].cssText).toEqual(String.raw`.btn\\\:hover { color: red }`);
  });

  it('rewrites pseudo-selectors preceded by any even number of backslashes', () => {
    const sheet = new Sheet(String.raw`.btn\\\\:hover { color: red }`);
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].getSelectors()).toContain(String.raw`.btn\\\\.pseudo-hover`);
  });

  it('keeps rewritten selector lists within browser limits', () => {
    const selectors = Array.from({ length: 1500 }, (_, index) => `.item-${index}:hover`);
    const sheet = new Sheet(`${selectors.join(', ')} { color: red }`);

    rewriteStyleSheet(sheet as unknown as CSSStyleSheet);

    const rewrittenSelectors = sheet.cssRules.flatMap((rule) => rule.getSelectors());
    expect(sheet.cssRules).toHaveLength(2);
    expect(sheet.cssRules.every((rule) => rule.getSelectors().length <= 4000)).toBe(true);
    expect(rewrittenSelectors).toHaveLength(4500);
    expect(rewrittenSelectors).toContain('.item-1499:hover');
    expect(rewrittenSelectors).toContain('.item-1499.pseudo-hover');
    expect(rewrittenSelectors).toContain('.pseudo-hover-all .item-1499');
  });

  it('preserves the original rule when a replacement cannot be inserted', () => {
    const selectors = Array.from({ length: 1500 }, (_, index) => `.item-${index}:hover`);
    const sheet = new Sheet(`${selectors.join(', ')} { color: red }`);
    const originalInsertRule = sheet.insertRule.bind(sheet);
    vi.spyOn(sheet, 'insertRule')
      .mockImplementationOnce(originalInsertRule)
      .mockImplementationOnce(() => {
        throw new DOMException('The replacement is too large', 'HierarchyRequestError');
      });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(rewriteStyleSheet(sheet as unknown as CSSStyleSheet)).toBe(false);
    expect(sheet.cssRules).toHaveLength(1);
    expect(sheet.cssRules[0].getSelectors()).toEqual(selectors);

    consoleError.mockRestore();
  });

  it('preserves a rule when no replacement selectors are generated', () => {
    const sheet = new Sheet('.pseudo-hover:hover { color: red }');

    expect(rewriteStyleSheet(sheet as unknown as CSSStyleSheet)).toBe(false);
    expect(sheet.cssRules).toHaveLength(1);
    expect(sheet.cssRules[0].cssText).toBe('.pseudo-hover:hover { color: red }');
  });

  it('keeps existing .pseudo- selectors when rewriting a mixed list', () => {
    const sheet = new Sheet('.pseudo-hover:hover, .foo:hover { color: red }');
    rewriteStyleSheet(sheet as unknown as CSSStyleSheet);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain('.pseudo-hover:hover');
    expect(selectors).toContain('.foo:hover');
    expect(selectors).toContain('.foo.pseudo-hover');
  });

  it('does not interpret $& in rewritten selector text', () => {
    const sheet = new Sheet('[data-label="$&"]:hover { color: red }');
    rewriteStyleSheet(sheet as unknown as CSSStyleSheet);
    const selectors = sheet.cssRules[0].getSelectors();
    expect(selectors).toContain('[data-label="$&"]:hover');
    expect(selectors).toContain('[data-label="$&"].pseudo-hover');
  });

  it('override correct rules with media query present', () => {
    const sheet = new Sheet(
      `@media (max-width: 790px) {
        .test {
          background-color: green;
        }
      }
      .test {
        background-color: blue;
      }
      .test:hover {
        background-color: red;
      }
      .test2:hover {
        background-color: white;
      }`
    );
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].cssText).toContain('@media (max-width: 790px)');
    expect(sheet.cssRules[1].getSelectors()).toContain('.test');
    expect(sheet.cssRules[2].getSelectors()).toContain('.test:hover');
    expect(sheet.cssRules[2].getSelectors()).toContain('.test.pseudo-hover');
    expect(sheet.cssRules[2].getSelectors()).toContain('.pseudo-hover-all .test');
    expect(sheet.cssRules[3].getSelectors()).toContain('.test2:hover');
    expect(sheet.cssRules[3].getSelectors()).toContain('.test2.pseudo-hover');
    expect(sheet.cssRules[3].getSelectors()).toContain('.pseudo-hover-all .test2');
  });

  it('rewrites rules inside "@media"', () => {
    const sheet = new Sheet(
      `@media (max-width: 790px) {
        test:hover {
          background-color: green;
        }
      }`
    );
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[0].cssText).toContain('@media (max-width: 790px)');
    const selectors = (sheet.cssRules[0] as GroupingRule).cssRules[0].getSelectors();
    expect(selectors).toContain('test:hover');
    expect(selectors).toContain('test.pseudo-hover');
    expect(selectors).toContain('.pseudo-hover-all test');
  });

  it('rewrites rules inside "@layer"', () => {
    const sheet = new Sheet(
      `@layer base {
        test:hover {
          background-color: green;
        }
      }`
    );
    rewriteStyleSheet(sheet as any);
    const selectors = (sheet.cssRules[0] as GroupingRule).cssRules[0].getSelectors();
    expect(selectors).toContain('test:hover');
    expect(selectors).toContain('test.pseudo-hover');
    expect(selectors).toContain('.pseudo-hover-all test');
  });

  it('handles multiple group rules', () => {
    const sheet = new Sheet(
      `@media (max-width: 790px) {
        test:hover {
          background-color: green;
        }
      }
      @media (max-width: 100px) {
        test2:hover {
          background-color: red;
        }
      }`
    );
    rewriteStyleSheet(sheet as any);
    expect((sheet.cssRules[0] as GroupingRule).cssRules[0].getSelectors()).toContain(
      'test.pseudo-hover'
    );
    expect((sheet.cssRules[1] as GroupingRule).cssRules[0].getSelectors()).toContain(
      'test2.pseudo-hover'
    );
  });

  it('handles nested group rules', () => {
    const sheet = new Sheet(
      `@layer base {
        test:hover {
          background-color: green;
        }
        @media (max-width: 790px) {
          @layer base {
            test:hover {
              background-color: green;
            }
          }
        }
      }`
    );
    rewriteStyleSheet(sheet as any);
    const layer = sheet.cssRules[0] as GroupingRule;
    expect(layer.cssRules[0].getSelectors()).toContain('test.pseudo-hover');
    const media = layer.cssRules[1] as GroupingRule;
    const innerLayer = media.cssRules[0] as GroupingRule;
    expect(innerLayer.cssRules[0].getSelectors()).toContain('test.pseudo-hover');
  });

  console.warn = () => {}; // suppress printing warnings about rewrite limit

  it('can rewrite 1000 rules in a sheet', () => {
    const sheet = new Sheet(Array(1000).fill('a:hover { color: red }').join('\n'));
    rewriteStyleSheet(sheet as any);
    for (let i = 0; i < 1000; i++) {
      expect(sheet.cssRules[i].getSelectors()).toContain('a.pseudo-hover');
    }
  });

  it('skips rewriting rules beyond the first 1000', () => {
    const sheet = new Sheet(Array(1001).fill('a:hover { color: red }').join('\n'));
    rewriteStyleSheet(sheet as any);
    expect(sheet.cssRules[1000].getSelectors()).not.toContain('a.pseudo-hover');
  });

  it('can rewrite 1000 rules in a sheet with group rules', () => {
    const sheet = new Sheet(Array(1000).fill('@layer foo { a:hover { color: red } }').join('\n'));
    rewriteStyleSheet(sheet as any);
    for (let i = 0; i < 1000; i++) {
      expect((sheet.cssRules[i] as GroupingRule).cssRules[0].getSelectors()).toContain(
        'a.pseudo-hover'
      );
    }
  });

  it('counts both a rewritten style rule and its nested rules toward the limit', () => {
    const sheet = new Sheet(Array(501).fill('a:hover { b:hover { color: red } }').join('\n'));

    rewriteStyleSheet(sheet as any);
    rewriteStyleSheet(sheet as any);

    expect(sheet.cssRules[499].getSelectors()).toContain('a.pseudo-hover');
    expect(sheet.cssRules[500].getSelectors()).not.toContain('a.pseudo-hover');
  });

  it('does not rewrite nested rules after the outer rule reaches the limit', () => {
    const sheet = new Sheet(
      [...Array(999).fill('a:hover { color: red }'), 'b:hover { c:hover { color: red } }'].join(
        '\n'
      )
    );

    rewriteStyleSheet(sheet as any);

    const finalRule = sheet.cssRules[999] as NestedStyleRule;
    expect(finalRule.getSelectors()).toContain('b.pseudo-hover');
    expect(finalRule.cssRules[0].getSelectors()).not.toContain('c.pseudo-hover');
  });
});
