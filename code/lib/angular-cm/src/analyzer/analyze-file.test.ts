/**
 * What `analyzeSourceFile` does, one behaviour per test, with the Angular source it reads inline.
 *
 * The analyzer walks a file's top-level statements and produces one record per class:
 *
 *     @Component / @Directive  -> components / directives, members split into
 *                                 inputsClass, outputsClass, propertiesClass, methodsClass
 *     @Pipe / @Injectable      -> pipes / injectables, members split into properties, methods
 *     no Angular decorator     -> classes
 *     @NgModule or @ignore     -> dropped
 *
 * plus a `miscellaneous` index of the enums and type aliases the file declares, which is what lets a
 * consumer resolve an input typed `ToneOption` down to its literals.
 *
 * Sources are compiled with a real `ts.Program` against the real `@angular/core`, so the expected
 * values below are what a full type checker produces, not what a syntax-only pass could guess.
 *
 * The same behaviours are additionally pinned against Compodoc's output over a shared fixture corpus
 * in `@storybook/docgen-harness`; this file is about the analyzer on its own terms.
 */
import { describe, expect, it } from 'vitest';

import type { AngularClassMeta, Directive, Method, Property } from '../types.ts';
import {
  ENTRY,
  analyzeFiles,
  analyzeInline as analyze,
  byName,
  componentIn,
  names,
} from './__testutils__/inline-source.ts';

describe('which classes a file yields', () => {
  it('buckets each class by its Angular decorator, and files an undecorated one under `classes`', () => {
    const meta = analyze(`
      import { Component, Directive, Injectable, Pipe, PipeTransform } from '@angular/core';

      @Component({ selector: 'sb-card', template: '' })
      export class CardComponent {}

      @Directive({ selector: '[sbFocus]' })
      export class FocusDirective {}

      @Pipe({ name: 'sbFormat' })
      export class FormatPipe implements PipeTransform {
        transform(value: string): string { return value; }
      }

      @Injectable()
      export class DataService {}

      export class Paginator {}
    `);

    expect(names(meta.components)).toEqual(['CardComponent']);
    expect(names(meta.directives)).toEqual(['FocusDirective']);
    expect(names(meta.pipes)).toEqual(['FormatPipe']);
    expect(names(meta.injectables)).toEqual(['DataService']);
    expect(names(meta.classes)).toEqual(['Paginator']);
    // The bucket a record lands in is also stated on the record, which is what the consumer reads.
    expect([
      meta.components[0].type,
      meta.directives[0].type,
      meta.pipes[0].type,
      meta.injectables[0].type,
      meta.classes[0].type,
    ]).toEqual(['component', 'directive', 'pipe', 'injectable', 'class']);
    // A pipe is bound in templates by its `name`, not by its class name.
    expect(meta.pipes[0].ngname).toBe('sbFormat');
  });

  it('drops an @NgModule, which declares no bindable surface of its own', () => {
    const meta = analyze(`
      import { NgModule } from '@angular/core';

      @NgModule({ declarations: [] })
      export class CardModule {}
    `);

    expect([...meta.components, ...meta.classes]).toEqual([]);
  });

  it('drops a class the author tagged @ignore', () => {
    const meta = analyze(`
      import { Component } from '@angular/core';

      /** @ignore */
      @Component({ selector: 'sb-internal', template: '' })
      export class InternalComponent {}
    `);

    expect(meta.components).toEqual([]);
  });

  it('records the file each class came from', () => {
    const component = componentIn(`
      import { Component } from '@angular/core';

      @Component({ selector: 'sb-card', template: '' })
      export class CardComponent {}
    `);

    expect(component.file).toBe(ENTRY);
  });
});

describe('the selector', () => {
  it('is the decorator string verbatim, multi-part selectors included', () => {
    const component = componentIn(`
      import { Component } from '@angular/core';

      @Component({
        selector: 'button[sb-harness-action], a[sb-harness-action]',
        template: '',
      })
      export class ActionComponent {}
    `);

    expect(component.selector).toBe('button[sb-harness-action], a[sb-harness-action]');
  });

  it('is absent on a class with no Angular decorator', () => {
    const meta = analyze(`
      export class BaseAlertComponent {}
    `);

    expect(meta.classes[0].selector).toBeUndefined();
  });
});

describe('@Input and @Output', () => {
  it('splits the two into their own buckets, with the initializer text as the default', () => {
    const component = componentIn(`
      import { Component, EventEmitter, Input, Output } from '@angular/core';

      @Component({ selector: 'sb-badge', template: '' })
      export class BadgeComponent {
        /** The text shown on the badge. */
        @Input() label = 'Badge';

        @Output() clicked = new EventEmitter<string>();
      }
    `);

    expect(byName(component.inputsClass, 'label')).toMatchObject({
      type: 'string',
      optional: false,
      defaultValue: "'Badge'",
      rawdescription: 'The text shown on the badge.',
    });
    // Outputs keep their constructor call as written; the consumer turns it into an action.
    expect(byName(component.outputsClass, 'clicked')).toMatchObject({
      type: 'EventEmitter',
      defaultValue: 'new EventEmitter<string>()',
    });
  });

  it('marks a `?` input optional and gives it no default', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-badge', template: '' })
      export class BadgeComponent {
        @Input() count?: number;
      }
    `);

    const count = byName(component.inputsClass, 'count');
    expect(count).toMatchObject({ type: 'number', optional: true });
    expect(count.defaultValue).toBeUndefined();
    // `required` tracks the `@Input({ required })` option, which this input does not use.
    expect(count.required).toBeUndefined();
  });

  it('renders a function-typed input as its full signature rather than as `function`', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-badge', template: '' })
      export class BadgeComponent {
        @Input() formatter!: (value: number) => string;

        @Input() data: any;
      }
    `);

    expect(byName(component.inputsClass, 'formatter').type).toBe('(value: number) => string');
    expect(byName(component.inputsClass, 'data').type).toBe('any');
  });

  it('reports a decorated getter/setter pair as one input, backing field left a property', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-player', template: '' })
      export class PlayerComponent {
        private innerVolume = 5;

        /** Playback volume, clamped between 0 and 10. */
        @Input()
        get volume(): number { return this.innerVolume; }
        set volume(value: number) { this.innerVolume = value; }
      }
    `);

    expect(names(component.inputsClass)).toEqual(['volume']);
    expect(byName(component.inputsClass, 'volume')).toMatchObject({
      type: 'number',
      optional: false,
      rawdescription: 'Playback volume, clamped between 0 and 10.',
    });
    expect(byName(component.propertiesClass, 'innerVolume')).toMatchObject({
      type: 'number',
      defaultValue: '5',
    });
  });
});

describe('signal inputs and outputs', () => {
  it('reads required-ness and the default out of the `input()` call', () => {
    const component = componentIn(`
      import { Component, booleanAttribute, input, output } from '@angular/core';

      @Component({ selector: 'sb-toggle', template: '' })
      export class ToggleComponent {
        /** Visible caption next to the control. */
        label = input('');

        count = input.required<number>();

        disabled = input(false, { transform: booleanAttribute });

        toggled = output<boolean>();
      }
    `);

    // `input.required()` takes no value, so there is nothing to report as a default.
    const count = byName(component.inputsClass, 'count');
    expect(count).toMatchObject({ type: 'number', required: true, optional: false });
    expect(count.defaultValue).toBeUndefined();

    expect(byName(component.inputsClass, 'label')).toMatchObject({
      type: 'string',
      required: false,
      defaultValue: "''",
      rawdescription: 'Visible caption next to the control.',
    });
    // The type comes from the value argument even when a transform widens what may be assigned.
    expect(byName(component.inputsClass, 'disabled')).toMatchObject({
      type: 'boolean',
      required: false,
      defaultValue: 'false',
    });

    expect(byName(component.outputsClass, 'toggled')).toMatchObject({
      type: 'boolean',
      required: false,
    });
  });

  it('reports a signal input under its alias, which is the name a template binds', () => {
    const component = componentIn(`
      import { Component, input } from '@angular/core';

      @Component({ selector: 'sb-toggle', template: '' })
      export class ToggleComponent {
        step = input(1, { alias: 'increment' });
      }
    `);

    expect(names(component.inputsClass)).toEqual(['increment']);
    expect(byName(component.inputsClass, 'increment')).toMatchObject({
      type: 'number',
      defaultValue: '1',
    });
  });

  it('reports a `model()` in both buckets under the same name, being a two-way binding', () => {
    const component = componentIn(`
      import { Component, model } from '@angular/core';

      @Component({ selector: 'sb-field', template: '' })
      export class FieldComponent {
        /** Current text value of the field. */
        value = model('start');

        checked = model.required<boolean>();
      }
    `);

    expect(names(component.inputsClass)).toEqual(['checked', 'value']);
    expect(names(component.outputsClass)).toEqual(['checked', 'value']);
    for (const bucket of [component.inputsClass, component.outputsClass]) {
      expect(byName(bucket, 'value')).toMatchObject({
        type: 'string',
        required: false,
        defaultValue: "'start'",
        rawdescription: 'Current text value of the field.',
      });
      expect(byName(bucket, 'checked')).toMatchObject({ type: 'boolean', required: true });
    }
  });
});

describe('how a member is typed', () => {
  it('keeps a literal union quoted, so the consumer can offer its members as choices', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-button', template: '' })
      export class ButtonComponent {
        @Input() size: 'small' | 'large' = 'small';
      }
    `);

    expect(byName(component.inputsClass, 'size')).toMatchObject({
      type: '"small" | "large"',
      defaultValue: "'small'",
    });
  });

  it('names the alias or enum, and indexes its definition under `miscellaneous`', () => {
    // The member keeps the name it was written with; `miscellaneous` is how that name is resolved
    // to the literals behind it.
    const meta = analyze(
      `
      import { Component, Input } from '@angular/core';

      import { ButtonKind, type ToneOption } from './types.ts';

      @Component({ selector: 'sb-button', template: '' })
      export class ButtonComponent {
        @Input() tone: ToneOption = 'info';

        @Input() kind: ButtonKind = ButtonKind.Primary;
      }
    `,
      {
        'types.ts': `
          export type ToneOption = 'info' | 'warn' | 'error';

          export enum ButtonKind {
            Primary = 'primary',
            Secondary = 'secondary',
          }
        `,
      }
    );

    const component = meta.components[0] as AngularClassMeta & Directive;
    expect(byName(component.inputsClass, 'tone')).toMatchObject({
      type: 'ToneOption',
      defaultValue: "'info'",
    });
    expect(byName(component.inputsClass, 'kind')).toMatchObject({
      type: 'ButtonKind',
      defaultValue: 'ButtonKind.Primary',
    });

    expect(meta.miscellaneous.typealiases).toEqual([
      expect.objectContaining({
        name: 'ToneOption',
        ctype: 'miscellaneous',
        subtype: 'typealias',
        rawtype: '"info" | "warn" | "error"',
      }),
    ]);
    expect(meta.miscellaneous.enumerations).toHaveLength(1);
    expect(meta.miscellaneous.enumerations[0]).toMatchObject({ name: 'ButtonKind' });
    expect(meta.miscellaneous.enumerations[0].childs).toEqual([
      { name: 'Primary', value: 'primary' },
      { name: 'Secondary', value: 'secondary' },
    ]);
  });

  it('renders a type parameter as written rather than resolving it', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-list', template: '' })
      export class ListComponent<T> {
        @Input() items: T[] = [];

        @Input() selected?: T;
      }
    `);

    expect(byName(component.inputsClass, 'items')).toMatchObject({
      type: 'T[]',
      defaultValue: '[]',
    });
    expect(byName(component.inputsClass, 'selected')).toMatchObject({ type: 'T', optional: true });
  });

  it('infers the type of an expression default the annotation does not state', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-grid', template: '' })
      export class GridComponent {
        @Input() rows = Math.max(1, 3);

        @Input() timeoutMs = 5 * 60 * 1000;
      }
    `);

    // The default keeps its source text; only a real checker can call these `number`.
    expect(byName(component.inputsClass, 'rows')).toMatchObject({
      type: 'number',
      defaultValue: 'Math.max(1, 3)',
    });
    expect(byName(component.inputsClass, 'timeoutMs')).toMatchObject({
      type: 'number',
      defaultValue: '5 * 60 * 1000',
    });
  });
});

describe('JSDoc', () => {
  it('carries the class description and its tags', () => {
    const component = componentIn(`
      import { Component } from '@angular/core';

      /**
       * Renders a colored status chip.
       *
       * @see https://example.com/design/chips
       */
      @Component({ selector: 'sb-chip', template: '' })
      export class ChipComponent {}
    `);

    expect(component.rawdescription).toBe('Renders a colored status chip.');
    expect(component.description).toBe('Renders a colored status chip.');
    expect(component.jsdoctags).toEqual([
      { tagName: { text: 'see', escapedText: 'see' }, comment: 'https://example.com/design/chips' },
    ]);
  });

  it('carries every tag on a member, custom ones included, in source order', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-chip', template: '' })
      export class ChipComponent {
        /**
         * Chip text.
         *
         * @deprecated Use \`label\` on the parent panel instead.
         * @see https://example.com/docs/chip-text
         * @sbCategory presentation
         */
        @Input() text = '';
      }
    `);

    const text = byName(component.inputsClass, 'text');
    expect(text.rawdescription).toBe('Chip text.');
    expect(text.jsdoctags).toEqual([
      {
        tagName: { text: 'deprecated', escapedText: 'deprecated' },
        comment: 'Use `label` on the parent panel instead.',
      },
      {
        tagName: { text: 'see', escapedText: 'see' },
        comment: 'https://example.com/docs/chip-text',
      },
      { tagName: { text: 'sbCategory', escapedText: 'sbCategory' }, comment: 'presentation' },
    ]);
  });

  it('leaves an @default tag as written, quotes included, for the consumer to unwrap', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-chip', template: '' })
      export class ChipComponent {
        /**
         * Accent color applied to the chip text.
         *
         * @default 'steelblue'
         */
        @Input() accent?: string;
      }
    `);

    const accent = byName(component.inputsClass, 'accent');
    // An accessor or an optional input has no initializer, so the tag is the only default carrier.
    expect(accent.defaultValue).toBeUndefined();
    expect(accent.jsdoctags).toEqual([
      { tagName: { text: 'default', escapedText: 'default' }, comment: "'steelblue'" },
    ]);
  });
});

describe('inheritance', () => {
  const BASE = `
    import { EventEmitter, Input, Output } from '@angular/core';

    export abstract class BaseAlertComponent {
      /** Whether the alert shows a close button. */
      @Input() dismissible = false;

      @Output() dismissed = new EventEmitter<void>();
    }
  `;

  const DERIVED = `
    import { Component, Input } from '@angular/core';

    import { BaseAlertComponent } from './base.ts';

    @Component({ selector: 'sb-alert', template: '' })
    export class AlertComponent extends BaseAlertComponent {
      @Input() heading = '';
    }
  `;

  it('merges a base class’s inputs and outputs into the component that extends it', () => {
    const component = componentIn(DERIVED, { 'base.ts': BASE });

    expect(names(component.inputsClass)).toEqual(['dismissible', 'heading']);
    expect(byName(component.inputsClass, 'dismissible')).toMatchObject({
      type: 'boolean',
      defaultValue: 'false',
      rawdescription: 'Whether the alert shows a close button.',
    });
    expect(byName(component.outputsClass, 'dismissed')).toMatchObject({
      type: 'EventEmitter',
      defaultValue: 'new EventEmitter<void>()',
    });
  });

  it('reports only the classes a file declares, not the ones it inherits from', () => {
    const meta = analyze(DERIVED, { 'base.ts': BASE });

    expect(meta.classes).toEqual([]);
  });

  it('keeps a base class’s IO split out when that file is analyzed on its own', () => {
    // The base carries no Angular decorator, so it lands under `classes`; a consumer that asks for
    // it by name still gets its bindable surface rather than a bag of plain properties.
    const meta = analyzeFiles('base.ts', { 'base.ts': BASE });
    const base = meta.classes[0] as AngularClassMeta & {
      inputsClass?: Property[];
      outputsClass?: Property[];
    };

    expect(base).toMatchObject({ name: 'BaseAlertComponent', type: 'class' });
    expect(names(base.inputsClass)).toEqual(['dismissible']);
    expect(names(base.outputsClass)).toEqual(['dismissed']);
  });
});

describe('members that are not inputs or outputs', () => {
  const NOISE = `
    import type { ElementRef } from '@angular/core';
    import { Component, HostBinding, Input, ViewChild, signal } from '@angular/core';

    @Component({ selector: 'sb-panel', template: '' })
    export class PanelComponent {
      @Input() title = '';

      currentPage = 1;

      #secret = 'hidden';

      readonly loading = signal(false);

      @ViewChild('panel') panel?: ElementRef<HTMLDivElement>;

      @HostBinding('class.active') isActive = false;

      nextPage(): void {
        this.currentPage += 1;
      }
    }
  `;

  it('keeps plain fields and ES-private fields as properties, and methods as methods', () => {
    const component = componentIn(NOISE);

    expect(names(component.inputsClass)).toEqual(['title']);
    // `#secret` is kept here on purpose: dropping unbindable members is the consumer's decision,
    // not the analyzer's.
    expect(names(component.propertiesClass)).toEqual([
      '#secret',
      'currentPage',
      'isActive',
      'loading',
      'panel',
    ]);
    expect(byName(component.propertiesClass, 'currentPage')).toMatchObject({
      type: 'number',
      defaultValue: '1',
    });
    expect(names(component.methodsClass)).toEqual(['nextPage']);
    expect(byName(component.methodsClass, 'nextPage')).toMatchObject({
      args: [],
      returnType: 'void',
    });
  });

  it('records a query or host-binding decorator on the property it annotates', () => {
    const component = componentIn(NOISE);

    // An undecorated property says so by omission rather than with an empty array.
    expect(byName(component.propertiesClass, 'currentPage').decorators).toBeUndefined();
    expect(byName(component.propertiesClass, 'panel')).toMatchObject({
      type: 'ElementRef<HTMLDivElement>',
      optional: true,
      decorators: [{ name: 'ViewChild' }],
    });
    expect(byName(component.propertiesClass, 'isActive')).toMatchObject({
      type: 'boolean',
      defaultValue: 'false',
      decorators: [{ name: 'HostBinding' }],
    });
  });
});

describe('ordering', () => {
  it('sorts every bucket by member name, so output does not depend on declaration order', () => {
    const meta = analyze(`
      import { Component, EventEmitter, Input, Output } from '@angular/core';

      @Component({ selector: 'sb-sorted', template: '' })
      export class SortedComponent {
        @Input() zebra = '';
        @Input() alpha = '';
        @Output() zulu = new EventEmitter<void>();
        @Output() alfa = new EventEmitter<void>();
        second = 2;
        first = 1;
        zzz(): void {}
        aaa(): void {}
      }
    `);

    const component = meta.components[0] as AngularClassMeta & Directive;
    expect(names(component.inputsClass)).toEqual(['alpha', 'zebra']);
    expect(names(component.outputsClass)).toEqual(['alfa', 'zulu']);
    expect(names(component.propertiesClass)).toEqual(['first', 'second']);
    expect(names(component.methodsClass as Method[])).toEqual(['aaa', 'zzz']);
  });
});
