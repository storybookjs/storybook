import { describe, expect, it } from 'vitest';

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
import { printHtmlTemplate } from './template-print.ts';
import { resolveHtmlTemplate } from './template-scope.ts';

const declaration = {
  kind: 'class',
  name: 'TemplateElement',
  customElement: true,
  tagName: 'template-element',
  attributes: [
    { name: 'label', fieldName: 'label' },
    { name: 'count', fieldName: 'count' },
    { name: 'disabled', fieldName: 'disabled' },
    { name: 'heading', fieldName: 'heading' },
    { name: 'open', fieldName: 'open' },
  ],
  members: [
    { kind: 'field', name: 'label', attribute: 'label' } as ManifestClassField & {
      attribute: string;
    },
    { kind: 'field', name: 'count', attribute: 'count' } as ManifestClassField & {
      attribute: string;
    },
    { kind: 'field', name: 'disabled', attribute: 'disabled' } as ManifestClassField & {
      attribute: string;
    },
    { kind: 'field', name: 'heading', attribute: 'heading' } as ManifestClassField & {
      attribute: string;
    },
    { kind: 'field', name: 'open', attribute: 'open', default: 'true' } as ManifestClassField & {
      attribute: string;
    },
    { kind: 'field', name: 'items' },
  ],
} satisfies ManifestDeclaration;

const renderTemplate = (storySource: string) => {
  const csf = loadCsf(storySource, { makeTitle: (title) => title ?? 'Example/Template' }).parse();
  const resolver = createStoryArgsResolver(csf);
  const story = 'Primary';
  const normalized = normalizeStoryDeclaration(csf._storyDeclarationPath[story]);
  const render =
    normalized.type === 'fn'
      ? { kind: 'resolved' as const, path: normalized.path }
      : resolveRenderFunction(
          normalized.type === 'config' ? normalized.path : undefined,
          csf._storyDeclarationPath[story],
          resolver.ctx
        );
  expect(render.kind).toBe('resolved');
  if (render.kind !== 'resolved') {
    throw new Error('Expected render to resolve');
  }
  const template = resolveHtmlTemplate(render.path, csf);
  expect(template).toBeDefined();
  return printHtmlTemplate(template!, resolver.resolve(story).args, declaration);
};

describe('html template story snippets', () => {
  it.each([
    {
      name: 'plain attributes',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { label: 'Hello', count: 2 },
          render: (args) => html\`<template-element label=\${args.label} count="\${args.count}"></template-element>\`,
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['label', 'count'],
        snippet: '<template-element label="Hello" count="2"></template-element>',
        unresolved: [],
      },
    },
    {
      name: 'boolean, property, and listener prefixes',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { disabled: true, heading: 'Head', items: [1], onClick: () => {} },
          render: (args) => html\`<template-element ?disabled=\${args.disabled} .heading=\${args.heading} .items=\${args.items} @click=\${args.onClick}></template-element>\`,
        };
      `,
      expected: {
        listeners: [{ event: 'click', handler: '() => {}' }],
        properties: ['items'],
        referenced: ['disabled', 'heading', 'items', 'onClick'],
        snippet: `<template-element disabled heading="Head"></template-element>
<script>
  {
    const host = document.currentScript.previousElementSibling;
    host.addEventListener('click', () => {});
  }
</script>`,
        unresolved: [],
      },
    },
    {
      name: 'inline template listener handler',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          render: () => html\`<template-element @shape-change=\${(event) => event.preventDefault()}></template-element>\`,
        };
      `,
      expected: {
        listeners: [
          {
            event: 'shape-change',
            handler: 'event => event.preventDefault()',
          },
        ],
        properties: [],
        referenced: [],
        snippet: `<template-element></template-element>
<script>
  {
    const host = document.currentScript.previousElementSibling;
    host.addEventListener('shape-change', event => event.preventDefault());
  }
</script>`,
        unresolved: [],
      },
    },
    {
      name: 'unresolved template listener handler',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          render: () => html\`<template-element @shape-change=\${fn()}></template-element>\`,
        };
      `,
      expected: {
        listeners: [{ event: 'shape-change', handler: '() => {}' }],
        properties: [],
        referenced: [],
        snippet: `<template-element></template-element>
<script>
  {
    const host = document.currentScript.previousElementSibling;
    host.addEventListener('shape-change', () => {});
  }
</script>`,
        unresolved: [],
      },
    },
    {
      name: 'paired boolean property attributes',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          render: () => html\`<template-element .open=\${true}></template-element><template-element .open=\${false}></template-element>\`,
        };
      `,
      expected: {
        falseDefaults: ['open'],
        listeners: [],
        properties: [],
        referenced: [],
        snippet: `<template-element open></template-element>
<template-element></template-element>`,
        unresolved: [],
      },
    },
    {
      name: 'kept prefixed attributes preserve whitespace',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { count: 2, disabled: true },
          render: (args) => html\`<template-element
      count=\${args.count}
      ?disabled=\${args.disabled}
    ></template-element>\`,
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['count', 'disabled'],
        snippet: '<template-element count="2" disabled></template-element>',
        unresolved: [],
      },
    },
    {
      name: 'quoted and multi-hole attributes',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { tone: 'warm', size: 'large', label: 'Say "hi"' },
          render: (args) => html\`<template-element class="card \${args.tone} \${args.size}" label="\${args.label}"></template-element>\`,
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['tone', 'size', 'label'],
        snippet:
          '<template-element class="card warm large" label="Say &quot;hi&quot;"></template-element>',
        unresolved: [],
      },
    },
    {
      name: 'untagged question-prefixed attribute',
      source: `
        export default { component: 'template-element' };
        export const Primary = {
          args: { flag: true },
          render: (args) => \`<template-element ?fake=\${args.flag}></template-element>\`,
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['flag'],
        snippet: '<template-element ?fake="true"></template-element>',
        unresolved: [],
      },
    },
    {
      name: 'ifDefined and nothing',
      source: `
        import { html, nothing } from 'lit';
        import { ifDefined } from 'lit/directives/if-defined.js';
        export default { component: 'template-element' };
        export const Primary = {
          args: { label: undefined, count: 3, show: false },
          render: (args) => html\`<template-element label=\${ifDefined(args.label)} count=\${ifDefined(args.count)}>\${args.show ? html\`<b>shown</b>\` : nothing}</template-element>\`,
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['label', 'count', 'show'],
        snippet: '<template-element count="3"></template-element>',
        unresolved: [],
      },
    },
    {
      name: 'nested templates',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { label: 'Nested' },
          render: (args) => html\`<template-element>\${html\`<span>\${args.label}</span>\`}</template-element>\`,
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['label'],
        snippet: `<template-element>
  <span>Nested</span>
</template-element>`,
        unresolved: [],
      },
    },
    {
      name: 'destructured and renamed parameters',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { label: 'Renamed', count: 4 },
          render: ({ label, count: n }) => html\`<template-element label=\${label} count=\${n}></template-element>\`,
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['label', 'count'],
        snippet: '<template-element label="Renamed" count="4"></template-element>',
        unresolved: [],
      },
    },
    {
      name: 'block body destructured args aliases',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { label: 'Block', count: 5 },
          render: (args) => {
            const { label, count: n } = args;
            return html\`<template-element label=\${label} count=\${n}></template-element>\`;
          },
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['label', 'count'],
        snippet: '<template-element label="Block" count="5"></template-element>',
        unresolved: [],
      },
    },
    {
      name: 'block body plain aliases',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { label: 'Alias', heading: 'Head' },
          render: (args) => {
            const { label } = args;
            const text = label;
            const heading = args.heading;
            return html\`<template-element label=\${text} .heading=\${heading}></template-element>\`;
          },
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['label', 'heading'],
        snippet: '<template-element label="Alias" heading="Head"></template-element>',
        unresolved: [],
      },
    },
    {
      name: 'block body template alias',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { label: 'Nested' },
          render: (args) => {
            const { label } = args;
            const tag = html\`<b>\${label}</b>\`;
            return html\`<template-element>\${tag}</template-element>\`;
          },
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['label'],
        snippet: `<template-element>
  <b>Nested</b>
</template-element>`,
        unresolved: [],
      },
    },
    {
      name: 'block body literal alias',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          render: () => {
            const label = 'Literal';
            return html\`<template-element label=\${label}></template-element>\`;
          },
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: [],
        snippet: '<template-element label="Literal"></template-element>',
        unresolved: [],
      },
    },
    {
      name: 'plain function attribute is unresolved instead of treated as a listener',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { onClick: () => {} },
          render: (args) => html\`<template-element onclick=\${args.onClick}></template-element>\`,
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['onClick'],
        snippet: '<template-element></template-element>',
        unresolved: ['args.onClick'],
      },
    },
    {
      name: 'function child is unresolved instead of rendered',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { child: () => {} },
          render: (args) => html\`<template-element>\${args.child}</template-element>\`,
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['child'],
        snippet: '<template-element></template-element>',
        unresolved: ['args.child'],
      },
    },
    {
      name: 'property binding with static text is unresolved',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { label: 'A', heading: 'B' },
          render: (args) => html\`<template-element .label="\${args.label} \${args.heading}"></template-element>\`,
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['label', 'heading'],
        snippet: '<template-element></template-element>',
        unresolved: ['args.label, args.heading'],
      },
    },
    {
      name: 'later paired property or attribute wins',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { label: 'Prop', heading: 'Attr' },
          render: (args) => html\`<template-element .label=\${args.label} label=\${args.heading}></template-element>\`,
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['label', 'heading'],
        snippet: '<template-element label="Attr"></template-element>',
        unresolved: [],
      },
    },
    {
      name: 'unresolved child and raw text holes',
      source: `
        import { html } from 'lit';
        import { classMap } from 'lit/directives/class-map.js';
        export default { component: 'template-element' };
        export const Primary = {
          args: { active: true },
          render: (args) => html\`<template-element class=\${classMap({ active: Boolean(args.active) })}><!-- \${args.active} --><style>\${args.active}</style></template-element>\`,
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['active'],
        snippet: `<template-element>
  <!--  -->
  <style></style>
</template-element>`,
        unresolved: ['classMap({ active: Boolean(args.active) })', 'args.active'],
      },
    },
    {
      name: 'template whose only hole fails',
      source: `
        import { html } from 'lit';
        import { classMap } from 'lit/directives/class-map.js';
        export default { component: 'template-element' };
        export const Primary = {
          render: (args) => html\`\${classMap({ active: Boolean(args.active) })}\`,
        };
      `,
      expected: {
        listeners: [],
        properties: [],
        referenced: ['active'],
        snippet: '',
        unresolved: ['classMap({ active: Boolean(args.active) })'],
      },
    },
  ])('$name', ({ source, expected }) => {
    expect(renderTemplate(source)).toEqual(expected);
  });

  it.each([
    {
      name: 'nested templates preserve listeners and unpaired properties',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { onChange: () => {}, items: [1] },
          render: (args) => html\`<template-element>\${html\`<x-b @change=\${args.onChange} .items=\${args.items}></x-b>\`}</template-element>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "listenersNotShown": [
    "@change",
  ],
  "properties": [
    "items",
  ],
  "referenced": [
    "onChange",
    "items",
  ],
  "snippet": "<template-element>
  <x-b></x-b>
</template-element>",
  "unresolved": [],
}
`),
    },
    {
      name: 'block body template alias preserves listeners and unpaired properties',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { onChange: () => {}, items: [1] },
          render: (args) => {
            const tag = html\`<x-b @change=\${args.onChange} .items=\${args.items}></x-b>\`;
            return html\`<template-element>\${tag}</template-element>\`;
          },
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "listenersNotShown": [
    "@change",
  ],
  "properties": [
    "items",
  ],
  "referenced": [
    "onChange",
    "items",
  ],
  "snippet": "<template-element>
  <x-b></x-b>
</template-element>",
  "unresolved": [],
}
`),
    },
    {
      name: 'single-quoted attributes escape apostrophes and ampersands',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { label: "it's & done" },
          render: (args) => html\`<template-element label='\${args.label}'></template-element>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "properties": [],
  "referenced": [
    "label",
  ],
  "snippet": "<template-element label="it's &amp; done"></template-element>",
  "unresolved": [],
}
`),
    },
    {
      name: 'removed multi-hole attribute skips later holes',
      source: `
        import { html } from 'lit';
        import { classMap } from 'lit/directives/class-map.js';
        export default { component: 'template-element' };
        export const Primary = {
          args: { active: true, size: 'lg' },
          render: (args) => html\`<template-element class="a \${classMap({ active: Boolean(args.active) })} \${args.size}"></template-element>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "properties": [],
  "referenced": [
    "active",
    "size",
  ],
  "snippet": "<template-element></template-element>",
  "unresolved": [
    "classMap({ active: Boolean(args.active) })",
  ],
}
`),
    },
    {
      name: 'arg member paths resolve values and conditional tests',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { user: { name: 'Bob', admin: false }, label: 'abc' },
          render: (args) => html\`<template-element label=\${args.user.name} count=\${args.label.length}>\${args.user.admin ? 'admin' : 'guest'}</template-element>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "properties": [],
  "referenced": [
    "user",
    "label",
  ],
  "snippet": "<template-element label="Bob" count="3">guest</template-element>",
  "unresolved": [],
}
`),
    },
    {
      name: 'missing arg member path is unresolved',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { user: { name: 'Bob' } },
          render: (args) => html\`<template-element label=\${args.user.missing}></template-element>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "properties": [],
  "referenced": [
    "user",
  ],
  "snippet": "<template-element></template-element>",
  "unresolved": [
    "args.user.missing",
  ],
}
`),
    },
    {
      name: 'removed quoted prefixed attributes preserve later offsets',
      source: `
        import { html, nothing } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { disabled: true, open: true, heading: 'Head' },
          render: (args) => html\`<template-element ?disabled="\${args.disabled}" ?open=\${args.open} label="\${nothing}" .heading="\${args.heading}"></template-element>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "properties": [],
  "referenced": [
    "disabled",
    "open",
    "heading",
  ],
  "snippet": "<template-element disabled open heading="Head"></template-element>",
  "unresolved": [],
}
`),
    },
    {
      name: 'attribute template literal resolves holes as text',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { label: 'red' },
          render: (args) => html\`<template-element style=\${\`color: \${args.label}\`}></template-element>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "properties": [],
  "referenced": [
    "label",
  ],
  "snippet": "<template-element style="color: red"></template-element>",
  "unresolved": [],
}
`),
    },
    {
      name: 'lit template in attribute position is unresolved',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          render: () => html\`<template-element label=\${html\`<b>x</b>\`}></template-element>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "properties": [],
  "referenced": [],
  "snippet": "<template-element></template-element>",
  "unresolved": [
    "html\`<b>x</b>\`",
  ],
}
`),
    },
    {
      name: 'unquoted attributes with static text are quoted as one value',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { size: 'large' },
          render: (args) => html\`<template-element class=btn-\${args.size}-primary></template-element>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "properties": [],
  "referenced": [
    "size",
  ],
  "snippet": "<template-element class="btn-large-primary"></template-element>",
  "unresolved": [],
}
`),
    },
    {
      name: 'nothing in multi-hole attributes removes the attribute to match lit',
      source: `
        import { html, nothing } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { label: 'warm' },
          render: (args) => html\`<template-element class="card \${args.label} \${nothing}"></template-element>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "properties": [],
  "referenced": [
    "label",
  ],
  "snippet": "<template-element></template-element>",
  "unresolved": [],
}
`),
    },
    {
      name: 'null single-hole attribute prints empty text to match lit',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { label: null },
          render: (args) => html\`<template-element label=\${args.label}></template-element>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "properties": [],
  "referenced": [
    "label",
  ],
  "snippet": "<template-element label=""></template-element>",
  "unresolved": [],
}
`),
    },
    {
      name: 'untagged child values print as HTML',
      source: `
        export default { component: 'template-element' };
        export const Primary = {
          args: { label: '<span>Hi</span>' },
          render: (args) => \`<template-element>\${args.label}</template-element>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "properties": [],
  "referenced": [
    "label",
  ],
  "snippet": "<template-element>
  <span>Hi</span>
</template-element>",
  "unresolved": [],
}
`),
    },
    {
      name: 'lit binds wrapped component listener; snippet reports @shape-change',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { onChange: () => {} },
          render: (args) => html\`<div class="wrap"><template-element @shape-change=\${args.onChange}></template-element></div>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "listenersNotShown": [
    "@shape-change",
  ],
  "properties": [],
  "referenced": [
    "onChange",
  ],
  "snippet": "<div class="wrap">
  <template-element></template-element>
</div>",
  "unresolved": [],
}
`),
    },
    {
      name: 'lit binds before trailing sibling; snippet reports @x',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { onX: () => {} },
          render: (args) => html\`<template-element @x=\${args.onX}></template-element><p>after</p>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "listenersNotShown": [
    "@x",
  ],
  "properties": [],
  "referenced": [
    "onX",
  ],
  "snippet": "<template-element></template-element>
<p>after</p>",
  "unresolved": [],
}
`),
    },
    {
      name: 'lit binds two root listeners; snippet reports both',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { onOne: () => {}, onTwo: () => {} },
          render: (args) => html\`<template-element @one=\${args.onOne}></template-element><x-other @two=\${args.onTwo}></x-other>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "listenersNotShown": [
    "@one",
    "@two",
  ],
  "properties": [],
  "referenced": [
    "onOne",
    "onTwo",
  ],
  "snippet": "<template-element></template-element>
<x-other></x-other>",
  "unresolved": [],
}
`),
    },
    {
      name: 'lit binds non-component root listener; snippet prints host script',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { onClick: () => {} },
          render: (args) => html\`<div @click=\${args.onClick}>Body</div>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [
    {
      "event": "click",
      "handler": "() => {}",
    },
  ],
  "properties": [],
  "referenced": [
    "onClick",
  ],
  "snippet": "<div>Body</div>
<script>
  {
    const host = document.currentScript.previousElementSibling;
    host.addEventListener('click', () => {});
  }
</script>",
  "unresolved": [],
}
`),
    },
    {
      name: 'lit binds before trailing style; snippet reports @x',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { onX: () => {} },
          render: (args) => html\`<template-element @x=\${args.onX}></template-element><style>template-element{}</style>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [],
  "listenersNotShown": [
    "@x",
  ],
  "properties": [],
  "referenced": [
    "onX",
  ],
  "snippet": "<template-element></template-element>
<style>template-element{}</style>",
  "unresolved": [],
}
`),
    },
    {
      name: 'lit binds after leading style; snippet prints host script',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { onX: () => {} },
          render: (args) => html\`<style>template-element{}</style><template-element @x=\${args.onX}></template-element>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [
    {
      "event": "x",
      "handler": "() => {}",
    },
  ],
  "properties": [],
  "referenced": [
    "onX",
  ],
  "snippet": "<style>template-element{}</style>
<template-element></template-element>
<script>
  {
    const host = document.currentScript.previousElementSibling;
    host.addEventListener('x', () => {});
  }
</script>",
  "unresolved": [],
}
`),
    },
    {
      name: 'lit binds nested listener; snippet reports nested @change',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          args: { onRoot: () => {}, onChange: () => {} },
          render: (args) => html\`<template-element @root-event=\${args.onRoot}>\${html\`<x-b @change=\${args.onChange}></x-b>\`}</template-element>\`,
        };
      `,
      assert: (actual: ReturnType<typeof renderTemplate>) =>
        expect(actual).toMatchInlineSnapshot(`
{
  "listeners": [
    {
      "event": "root-event",
      "handler": "() => {}",
    },
  ],
  "listenersNotShown": [
    "@change",
  ],
  "properties": [],
  "referenced": [
    "onRoot",
    "onChange",
  ],
  "snippet": "<template-element>
  <x-b></x-b>
</template-element>
<script>
  {
    const host = document.currentScript.previousElementSibling;
    host.addEventListener('root-event', () => {});
  }
</script>",
  "unresolved": [],
}
`),
    },
  ])('$name', ({ source, assert }) => {
    assert(renderTemplate(source));
  });

  it.each([
    {
      name: 'computed alias initializer',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          render: (args) => {
            const label = compute(args);
            return html\`<template-element label=\${label}></template-element>\`;
          },
        };
      `,
    },
    {
      name: 'reassigned let alias',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          render: (args) => {
            let label = args.label;
            label = 'changed';
            return html\`<template-element label=\${label}></template-element>\`;
          },
        };
      `,
    },
    {
      name: 'non-declaration statement',
      source: `
        import { html } from 'lit';
        export default { component: 'template-element' };
        export const Primary = {
          render: (args) => {
            console.log(args.label);
            return html\`<template-element label=\${args.label}></template-element>\`;
          },
        };
      `,
    },
  ])('rejects block body with $name', ({ source }) => {
    const csf = loadCsf(source, { makeTitle: (title) => title ?? 'Example/Template' }).parse();
    const resolver = createStoryArgsResolver(csf);
    const normalized = normalizeStoryDeclaration(csf._storyDeclarationPath.Primary);
    const render =
      normalized.type === 'fn'
        ? { kind: 'resolved' as const, path: normalized.path }
        : resolveRenderFunction(
            normalized.type === 'config' ? normalized.path : undefined,
            csf._storyDeclarationPath.Primary,
            resolver.ctx
          );
    expect(render.kind).toBe('resolved');
    if (render.kind !== 'resolved') {
      throw new Error('Expected render to resolve');
    }
    expect(resolveHtmlTemplate(render.path, csf)).toBeUndefined();
  });
});
