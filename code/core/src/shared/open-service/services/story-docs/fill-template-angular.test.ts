import { describe, expect, it } from 'vitest';

import { fillAngularTemplate } from './fill-template-angular.ts';
import { fillTemplate } from './fill-template-by-syntax.ts';

const host = (template: string, body = '{}') =>
  [
    "import { Component } from '@angular/core';",
    "import { ButtonComponent } from './button.component';",
    '',
    '@Component({',
    "  selector: 'app-demo',",
    '  imports: [ButtonComponent],',
    `  template: \`${template}\`,`,
    '})',
    `export class DemoComponent ${body}`,
  ].join('\n');

describe('fillAngularTemplate', () => {
  it('expands {{args}} into bindings, strings as attributes', () => {
    const template = host(
      '<app-button {{args}} (onClick)="onClick($event)" />',
      '{\n  onClick(event: unknown) {}\n}'
    );
    expect(
      fillAngularTemplate(template, {
        label: 'Click me',
        primary: true,
        size: 'large',
        count: 3,
        tags: ['a', 'b'],
        onClick: () => {},
        unset: undefined,
      })
    ).toBe(
      host(
        `<app-button label="Click me" [primary]="true" size="large" [count]="3" [tags]="['a', 'b']" (onClick)="onClick($event)" />`,
        '{\n  onClick(event: unknown) {}\n}'
      )
    );
  });

  it('drops the {{args}} marker when there are no args', () => {
    expect(fillAngularTemplate('<app-button {{args}} />', {})).toBe('<app-button />');
  });

  it('keeps one binding per line when the element was broken over lines', () => {
    expect(
      fillAngularTemplate('<app-button\n    {{args}}\n    (onClick)="onClick($event)"\n/>', {
        label: 'Hi',
        primary: false,
      })
    ).toBe(
      '<app-button\n    label="Hi"\n    [primary]="false"\n    (onClick)="onClick($event)"\n/>'
    );
  });

  it('fills a marked binding and drops it when unset', () => {
    const template = '<app-button [label]="{{args.label}}" [size]="{{args.size}}"></app-button>';
    expect(fillAngularTemplate(template, { label: 'Save' })).toBe(
      '<app-button label="Save"></app-button>'
    );
    expect(fillAngularTemplate(template, { label: 'Say "hi"', size: 2 })).toBe(
      `<app-button [label]="'Say &quot;hi&quot;'" [size]="2"></app-button>`
    );
  });

  it('fills host component fields as expressions', () => {
    expect(
      fillAngularTemplate('{\n  label = {{args.label}};\n  user = {{args.user}};\n}', {
        label: "It's",
        user: { name: 'Jane', 'data-id': 1 },
      })
    ).toBe("{\n  label = 'It\\'s';\n  user = {name: 'Jane', 'data-id': 1};\n}");
  });

  it('leaves Angular interpolation that does not read args alone', () => {
    expect(fillAngularTemplate('<p>{{ label }}</p>', { label: 'x' })).toBe('<p>{{ label }}</p>');
  });

  it('is registered for the angular syntax', () => {
    expect(fillTemplate('<app-button {{args}} />', { label: 'Go' }, 'angular')).toBe(
      '<app-button label="Go" />'
    );
  });
});
