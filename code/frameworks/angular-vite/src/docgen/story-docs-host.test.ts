import { describe, expect, it } from 'vitest';

import type { AngularHostContext } from './story-docs-host.ts';
import { angularHostComponent, angularHostImports } from './story-docs-host.ts';

const context = (overrides: Partial<AngularHostContext> = {}): AngularHostContext => ({
  componentName: 'ButtonComponent',
  exportName: 'ButtonComponent',
  importId: './button.component',
  ...overrides,
});

describe('angularHostImports', () => {
  it('imports a named export the way the story file did', () => {
    expect(angularHostImports(context())).toBe(
      `import { Component } from '@angular/core';\nimport { ButtonComponent } from './button.component';`
    );
  });

  it('imports a default export without braces', () => {
    expect(angularHostImports(context({ exportName: 'default' }))).toBe(
      `import { Component } from '@angular/core';\nimport ButtonComponent from './button.component';`
    );
  });

  // The template names the class itself, so an export under another name has to be aliased back to
  // it rather than left bound to a name the template never mentions.
  it('aliases an export whose name is not the class name', () => {
    expect(angularHostImports(context({ exportName: 'Button' }))).toContain(
      `import { Button as ButtonComponent } from './button.component';`
    );
  });

  it('emits no component import when the story file declares the component itself', () => {
    expect(angularHostImports(context({ importId: undefined }))).toBe(
      `import { Component } from '@angular/core';`
    );
  });

  it('pulls in NgComponentOutlet for a component with no selector', () => {
    expect(angularHostImports(context({ outlet: true }))).toContain(
      `import { NgComponentOutlet } from '@angular/common';`
    );
  });
});

describe('angularHostComponent', () => {
  it('declares a no-op method per bound output so the template type-checks', () => {
    expect(angularHostComponent('<sb-button />', ['clicked', 'closed'], context())).toBe(
      `@Component({
  selector: 'app-root',
  template: \`<sb-button />\`,
  imports: [ButtonComponent],
})
export class App {
  clicked(event: unknown) {}
  closed(event: unknown) {}
}`
    );
  });

  it('leaves the class empty when the template binds nothing', () => {
    expect(angularHostComponent('<sb-button />', [], context())).toContain('export class App {}');
  });

  it('quotes an output name that is not a valid identifier', () => {
    expect(angularHostComponent('<sb-button />', ['data-changed'], context())).toContain(
      `['data-changed'](event: unknown) {}`
    );
  });

  it('exposes the class the outlet template reads as a value', () => {
    const snippet = angularHostComponent(
      '<ng-container *ngComponentOutlet="ButtonComponent"></ng-container>',
      [],
      context({ outlet: true })
    );

    expect(snippet).toContain('imports: [NgComponentOutlet],');
    expect(snippet).toContain('readonly ButtonComponent = ButtonComponent;');
  });

  it.each([
    ['a backtick', '<sb-button [label]="`hi`" />', '<sb-button [label]="\\`hi\\`" />'],
    ['an interpolation', '<sb-button>${x}</sb-button>', '<sb-button>\\${x}</sb-button>'],
    ['a backslash', '<sb-button [re]="/a\\d/" />', '<sb-button [re]="/a\\\\d/" />'],
  ])('escapes %s so it cannot break out of the host template literal', (_case, markup, escaped) => {
    expect(angularHostComponent(markup, [], context())).toContain(`template: \`${escaped}\`,`);
  });
});
