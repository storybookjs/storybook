import { describe, expect, it } from 'vitest';

import { buildHostComponentSnippet, extractHostComponentTemplate } from './story-docs-snippet.ts';

const build = (overrides: Partial<Parameters<typeof buildHostComponentSnippet>[0]> = {}) =>
  buildHostComponentSnippet({
    template: '<sb-button></sb-button>',
    componentName: 'ButtonComponent',
    componentImport: "import { ButtonComponent } from './button.component.ts';",
    viaComponentOutlet: false,
    outputs: [],
    ...overrides,
  });

describe('buildHostComponentSnippet', () => {
  it('declares the component and gives every output a handler', () => {
    expect(build({ outputs: ['pressed', 'valueChange'] })).toMatchInlineSnapshot(`
      "import { Component } from '@angular/core';
      import { ButtonComponent } from './button.component.ts';

      @Component({
        selector: 'app-demo',
        imports: [ButtonComponent],
        template: \`<sb-button></sb-button>\`,
      })
      export class DemoComponent {
        pressed(event: unknown) {}
        valueChange(event: unknown) {}
      }"
    `);
  });

  it('declares NgComponentOutlet and exposes the class when there is no selector', () => {
    const snippet = build({
      viaComponentOutlet: true,
      template: '<ng-container *ngComponentOutlet="ButtonComponent"></ng-container>',
    });

    expect(snippet).toContain("import { NgComponentOutlet } from '@angular/common';");
    expect(snippet).toContain('imports: [NgComponentOutlet],');
    expect(snippet).toContain('protected readonly ButtonComponent = ButtonComponent;');
  });

  it('reaches an output whose name is not an identifier the way the template does', () => {
    expect(build({ outputs: ['on-change'] })).toContain("  ['on-change'](event: unknown) {}");
  });

  it('omits the component import when the component is declared in the story file', () => {
    const snippet = build({ componentImport: undefined });

    expect(snippet.match(/^import /gm)).toHaveLength(1);
    expect(snippet).toContain('imports: [ButtonComponent],');
  });

  // A template carrying a backtick or a `${` would otherwise end or interpolate the literal that
  // quotes it, turning a snippet into source that does not parse.
  it.each([
    ['a backtick', '<sb-button [label]="`tick`"></sb-button>'],
    ['an interpolation', '<sb-button [label]="${x}"></sb-button>'],
    ['a backslash escape', `<sb-button [label]="'it\\'s'"></sb-button>`],
    ['both quote characters', `<sb-button [label]="\\"a'b\\""></sb-button>`],
  ])('survives a template containing %s', (_name, template) => {
    const snippet = build({ template });

    expect(extractHostComponentTemplate(snippet)).toBe(template);
    // The template literal must be closed by the delimiter the builder wrote, not by the payload.
    expect(snippet.endsWith('export class DemoComponent {}')).toBe(true);
  });
});

describe('extractHostComponentTemplate', () => {
  it('returns undefined for text that is not a host-component snippet', () => {
    expect(extractHostComponentTemplate('<sb-button></sb-button>')).toBeUndefined();
  });
});
