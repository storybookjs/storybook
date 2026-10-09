// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import { html, nothing, render } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import {
  createStoryArgsResolver,
  loadCsf,
  normalizeStoryDeclaration,
  resolveRenderFunction,
} from 'storybook/internal/csf-tools';

import type {
  ManifestClassField,
  ManifestDeclaration,
} from '../component-docgen/manifest/types.ts';
import { parseHtml } from './html-tree.ts';
import { printHtmlTemplate } from './template-print.ts';
import { resolveHtmlTemplate } from './template-scope.ts';

interface AttributeCase {
  attrs: readonly AttributeSlot[];
  source: string;
}

interface AttributeSlot {
  compare: boolean;
  name: string;
  text: string;
}

const MAX_CASES = 5000;
const VALUES = [
  { name: 'string', source: "'s'" },
  { name: 'empty', source: "''" },
  { name: 'zero', source: '0' },
  { name: 'true', source: 'true' },
  { name: 'false', source: 'false' },
  { name: 'null', source: 'null' },
  { name: 'undefined', source: 'undefined' },
  { name: 'nothing', source: 'nothing' },
  { name: 'if-defined', source: 'ifDefined(undefined)' },
];

const declaration = {
  kind: 'class',
  name: 'TestElement',
  customElement: true,
  tagName: 'test-element',
  attributes: [{ name: 'label', fieldName: 'label' }],
  members: [
    { kind: 'field', name: 'label', attribute: 'label' } as ManifestClassField & {
      attribute: string;
    },
  ],
} satisfies ManifestDeclaration;

const attributeKinds = (index: number, value: string): AttributeSlot[] => [
  { compare: true, name: `a${index}`, text: `a${index}=\${${value}}` },
  { compare: true, name: `s${index}`, text: `s${index}=\${${value}}px` },
  { compare: true, name: `q${index}`, text: `q${index}="\${${value}}"` },
  { compare: true, name: `m${index}`, text: `m${index}="x \${${value}} y"` },
  { compare: true, name: `b${index}`, text: `?b${index}=\${${value}}` },
  { compare: false, name: 'label', text: `.label=\${${value}}` },
  { compare: false, name: 'ev', text: '@ev=${fn}' },
];

const allCases = (): AttributeCase[] => {
  const slots = [0, 1, 2].map((index) =>
    VALUES.flatMap((value) =>
      attributeKinds(index, value.source).map((slot) => ({
        ...slot,
        text: slot.text,
        valueName: value.name,
      }))
    )
  );
  const cases: AttributeCase[] = [];
  for (const first of slots[0]) {
    for (const second of slots[1]) {
      for (const third of slots[2]) {
        const attrs = [first, second, third];
        if (new Set(attrs.map((slot) => slot.name)).size !== attrs.length) {
          continue;
        }
        if (
          attrs.some(
            (slot) =>
              slot.name.startsWith('s') &&
              ['undefined', 'nothing', 'if-defined'].includes(slot.valueName)
          )
        ) {
          continue;
        }
        cases.push({
          attrs,
          source: attrs.map((slot) => `${slot.name}:${slot.valueName}:${slot.text}`).join(' | '),
        });
      }
    }
  }
  if (cases.length <= MAX_CASES) {
    return cases;
  }
  const step = cases.length / MAX_CASES;
  return Array.from({ length: MAX_CASES }, (_, index) => cases[Math.floor(index * step)]);
};

const cases = allCases();

const renderSnippet = (attrs: readonly AttributeSlot[]): string => {
  const attrText = attrs.map((slot) => slot.text).join(' ');
  const storySource = `
    import { html, nothing } from 'lit';
    import { ifDefined } from 'lit/directives/if-defined.js';
    const fn = () => {};
    export default { component: 'test-element' };
    export const Primary = {
      render: () => html\`<test-element ${attrText}>Body</test-element>\`,
    };
  `;
  const csf = loadCsf(storySource, { makeTitle: (title) => title ?? 'Example/Lit' }).parse();
  const resolver = createStoryArgsResolver(csf);
  const normalized = normalizeStoryDeclaration(csf._storyDeclarationPath.Primary);
  const renderFunction =
    normalized.type === 'fn'
      ? { kind: 'resolved' as const, path: normalized.path }
      : resolveRenderFunction(
          normalized.type === 'config' ? normalized.path : undefined,
          csf._storyDeclarationPath.Primary,
          resolver.ctx
        );
  expect(renderFunction.kind).toBe('resolved');
  if (renderFunction.kind !== 'resolved') {
    throw new Error('Expected render to resolve');
  }
  const template = resolveHtmlTemplate(renderFunction.path, csf);
  expect(template).toBeDefined();
  return printHtmlTemplate(template!, {}, declaration).snippet;
};

const renderLitAttributes = (attrs: readonly AttributeSlot[]): [string, string][] => {
  const attrText = attrs.map((slot) => slot.text).join(' ');
  const template = Function(
    'html',
    'nothing',
    'ifDefined',
    'fn',
    `return html\`<test-element ${attrText}>Body</test-element>\`;`
  )(html, nothing, ifDefined, () => {});
  const container = document.createElement('div');
  render(template, container);
  return attributesOf(container.querySelector('test-element'));
};

const renderSnippetAttributes = (
  snippet: string,
  attrs: readonly AttributeSlot[]
): [string, string][] => {
  const [node] = parseHtml(snippet);
  const excluded = new Set(attrs.filter((attr) => !attr.compare).map((attr) => attr.name));
  expect(node?.kind).toBe('element');
  if (node?.kind !== 'element') {
    return [];
  }
  for (const attribute of node.attributes) {
    expect(attribute.name.startsWith('@') || attribute.name.startsWith('.')).toBe(false);
  }
  return sortAttributePairs(
    node.attributes
      .filter((attribute) => !excluded.has(attribute.name))
      .map((attribute) => attributePair(attribute.name, attribute.value ?? ''))
  );
};

const attributesOf = (element: Element | null): [string, string][] =>
  sortAttributePairs(
    [...(element?.attributes ?? [])].map((attribute) =>
      attributePair(attribute.name, attribute.value)
    )
  );

const attributePair = (name: string, value: string): [string, string] => [name, value];

const sortAttributePairs = (pairs: [string, string][]): [string, string][] =>
  pairs.sort(([left], [right]) => left.localeCompare(right));

describe('lit template attribute oracle', () => {
  it(`matches lit attributes across ${MAX_CASES} sampled permutations`, () => {
    expect(cases).toHaveLength(MAX_CASES);
    for (const entry of cases) {
      const expected = renderLitAttributes(entry.attrs).filter(([name]) =>
        entry.attrs.some((attr) => attr.compare && attr.name === name)
      );
      const snippet = renderSnippet(entry.attrs);
      const actual = renderSnippetAttributes(snippet, entry.attrs);
      expect(actual, `${entry.source}\n${snippet}`).toEqual(expected);
    }
  });
});
