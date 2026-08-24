import { describe, expect, it } from 'vitest';

import { buildHostComponentSnippet, extractHostComponentTemplate } from './story-docs-snippet.ts';

const build = (overrides: Partial<Parameters<typeof buildHostComponentSnippet>[0]> = {}) =>
  buildHostComponentSnippet({
    template: '<sb-button></sb-button>',
    componentName: 'ButtonComponent',
    componentImport: "import { ButtonComponent } from './button.component.ts';",
    viaComponentOutlet: false,
    standalone: true,
    outputs: [],
    ...overrides,
  });

describe('buildHostComponentSnippet', () => {
  it('declares the component and gives every output a handler', () => {
    const { snippet, warning } = build({ outputs: ['pressed', 'valueChange'] });

    expect(warning).toBeUndefined();
    expect(snippet).toMatchInlineSnapshot(`
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
    const { snippet } = build({
      viaComponentOutlet: true,
      template: '<ng-container *ngComponentOutlet="ButtonComponent" />',
    });

    expect(snippet).toContain("import { NgComponentOutlet } from '@angular/common';");
    expect(snippet).toContain('imports: [NgComponentOutlet],');
    expect(snippet).toContain('protected readonly ButtonComponent = ButtonComponent;');
  });

  it("lists the story's NgModules in `imports` for a non-standalone component, without a warning", () => {
    const { snippet, warning } = build({
      standalone: false,
      ngModules: {
        names: ['ButtonModule', 'IconModule'],
        importStatements: ["import { ButtonModule, IconModule } from './button.module.ts';"],
      },
    });

    expect(snippet).toContain('imports: [ButtonModule, IconModule],');
    expect(snippet).toContain("import { ButtonModule, IconModule } from './button.module.ts';");
    expect(snippet).not.toContain('./button.component.ts');
    expect(warning).toBeUndefined();
  });

  it('keeps `imports` empty and warns when the component is not standalone', () => {
    const { snippet, warning } = build({ standalone: false });

    expect(snippet).toContain('imports: [],');
    expect(snippet).not.toContain('./button.component.ts');
    expect(warning).toBe(
      'ButtonComponent is declared with `standalone: false`, so it cannot be listed in the host ' +
        "component's `imports`. Add the NgModule that declares and exports ButtonComponent to " +
        '`imports` to make this snippet compile.'
    );
  });

  it('references a non-standalone component as a value under the outlet, ignoring modules', () => {
    const { snippet, warning } = build({
      standalone: false,
      viaComponentOutlet: true,
      template: '<ng-container *ngComponentOutlet="ButtonComponent" />',
      ngModules: {
        names: ['ButtonModule'],
        importStatements: ["import { ButtonModule } from './button.module.ts';"],
      },
    });

    expect(snippet).toContain('imports: [NgComponentOutlet],');
    expect(snippet).toContain("import { ButtonComponent } from './button.component.ts';");
    expect(snippet).not.toContain('ButtonModule');
    expect(warning).toBeUndefined();
  });

  it('reaches an output whose name is not an identifier the way the template does', () => {
    expect(build({ outputs: ['on-change'] }).snippet).toContain(
      "  ['on-change'](event: unknown) {}"
    );
  });

  it('omits the component import when the component is declared in the story file, and says so', () => {
    const { snippet, warning } = build({ componentImport: undefined });

    expect(snippet.match(/^import /gm)).toHaveLength(1);
    expect(snippet).toContain('imports: [ButtonComponent],');
    expect(warning).toBe(
      'ButtonComponent is declared in the story file, so the snippet references it without importing it.'
    );
  });

  // A template carrying a backtick or a `${` would otherwise end or interpolate the literal that
  // quotes it, turning a snippet into source that does not parse.
  it.each([
    ['a backtick', '<sb-button [label]="`tick`"></sb-button>'],
    ['an interpolation', '<sb-button [label]="${x}"></sb-button>'],
    ['a backslash escape', `<sb-button [label]="'it\\'s'"></sb-button>`],
    ['both quote characters', `<sb-button [label]="\\"a'b\\""></sb-button>`],
  ])('survives a template containing %s', (_name, template) => {
    const { snippet } = build({ template });

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
