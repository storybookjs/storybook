import { describe, expect, it } from 'vitest';

import type { ComponentMeta } from 'vue-component-meta';

import { renderVueapiMd } from './vueapiMd.ts';

/**
 * Builds a `ComponentMeta` (vue-component-meta / Volar shape) with a prop, a scoped slot named
 * `default`, an event, and an exposed member. Vue's member kinds arrive as structurally distinct
 * arrays, so a slot can never leak into the Props table — the acceptance criterion below.
 */
const meta: ComponentMeta = {
  name: 'Button',
  description: 'A clickable button.',
  type: 1, // TypeMeta.Class
  props: [
    {
      name: 'variant',
      type: "'primary' | 'secondary'",
      required: false,
      default: "'primary'",
      global: false,
      description: 'Visual style of the button.',
      tags: [],
    },
  ],
  slots: [
    {
      name: 'default',
      type: '{ active: boolean }',
      description: 'The button label content.',
      tags: [],
    },
  ],
  events: [
    {
      name: 'click',
      type: 'MouseEvent',
      description: 'Fired when the button is clicked.',
      tags: [],
    },
  ],
  exposed: [
    {
      name: 'focus',
      type: '() => void',
      description: 'Focuses the button element.',
      tags: [],
    },
  ],
} as unknown as ComponentMeta;

describe('renderVueapiMd', () => {
  const markdown = renderVueapiMd(meta);

  it('renders each section as a fenced `ts` `export type` block, not a markdown table', () => {
    expect(markdown).toContain('```ts');
    expect(markdown).toContain('export type Props = {');
    expect(markdown).toContain('export type Slots = {');
    expect(markdown).toContain('export type Events = {');
    expect(markdown).toContain('export type Exposed = {');
    // no markdown-table syntax anywhere
    expect(markdown).not.toContain('| Name |');
    expect(markdown).not.toContain('| --- |');
  });

  it('renders a Slots section including scoped bindings', () => {
    expect(markdown).toContain('## Slots');
    expect(markdown).toContain('default: { active: boolean };');
    expect(markdown).toContain('active: boolean');
  });

  it('renders distinct Props, Events, and Exposed sections', () => {
    expect(markdown).toContain('## Props');
    expect(markdown).toContain('## Events');
    expect(markdown).toContain('## Exposed');
    expect(markdown).toContain("variant?: 'primary' | 'secondary'");
    expect(markdown).toContain('click: MouseEvent;');
    expect(markdown).toContain('focus: () => void;');
  });

  it('renders props with `?` for optional and ` = <default>` for defaults', () => {
    expect(markdown).toContain("variant?: 'primary' | 'secondary' = 'primary';");
  });

  it('renders member descriptions as single-line JSDoc comments', () => {
    expect(markdown).toContain('/** Visual style of the button. */');
    expect(markdown).toContain('/** The button label content. */');
  });

  it('uses Volar resolved prop types (union literals, not a flat "union")', () => {
    // Inside a fenced code block the union `|` is raw — no table `\|` escaping needed.
    expect(markdown).toContain("'primary' | 'secondary'");
    expect(markdown).not.toContain('union');
  });

  it('ACCEPTANCE: a scoped slot named `default` appears under Slots and never under Props', () => {
    const slotsIndex = markdown.indexOf('## Slots');
    const propsSection = markdown.slice(markdown.indexOf('## Props'), slotsIndex);
    const slotsSection = markdown.slice(slotsIndex);

    expect(slotsSection).toContain('default: { active: boolean };');
    expect(propsSection).toContain('variant');
    expect(propsSection).not.toContain('default');
    expect(propsSection).not.toContain('active: boolean');
  });

  it('renders only the API fragment: no header, description, or stories', () => {
    expect(markdown).not.toContain('# Button');
    expect(markdown).not.toContain('A clickable button.');
    expect(markdown).not.toContain('## Stories');
    expect(markdown.startsWith('## Props')).toBe(true);
  });

  it('skips global (inherited) props', () => {
    const withGlobal = renderVueapiMd({
      ...meta,
      props: [
        ...meta.props,
        {
          name: 'class',
          type: 'string',
          required: false,
          global: true,
          description: '',
          tags: [],
        },
      ],
    } as unknown as ComponentMeta);
    expect(withGlobal).toContain("variant?: 'primary' | 'secondary'");
    expect(withGlobal).not.toContain('class');
  });

  it('omits empty sections entirely', () => {
    const propsOnly = renderVueapiMd({
      ...meta,
      slots: [],
      events: [],
      exposed: [],
    } as unknown as ComponentMeta);
    expect(propsOnly).toContain('## Props');
    expect(propsOnly).not.toContain('## Slots');
    expect(propsOnly).not.toContain('## Events');
    expect(propsOnly).not.toContain('## Exposed');
  });

  // Load-bearing for the story-cap signal: a component with no documentable API must render to an
  // empty string, so the generator's `renderVueapiMd(meta) || undefined` omits `apiMd`
  // entirely. A row without `apiMd` tells the MCP consumer "no documented API", which is what
  // makes it show all stories instead of capping. If this ever returns bare headers, that signal
  // silently inverts and stories get hidden.
  it('renders an empty string when the component has no documentable API', () => {
    const empty = renderVueapiMd({
      ...meta,
      props: [],
      slots: [],
      events: [],
      exposed: [],
    } as unknown as ComponentMeta);
    expect(empty).toBe('');
  });
});
