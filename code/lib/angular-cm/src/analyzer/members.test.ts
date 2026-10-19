/**
 * How the analyzer decides what a class member *is*, with the Angular source it reads inline.
 *
 * `analyze-file.test.ts` covers the shape of a file's output; this file covers the rules that
 * decide which bucket a member lands in, what it is called, how it is typed, and what its default
 * is. Those rules are spread over `members.ts`, `decorators.ts`, `signals.ts`, `inheritance.ts` and
 * `type-index.ts`, and the point of keeping the source beside each assertion is that you should not
 * have to open any of them to review a behaviour.
 *
 * A few tests run the record through `extractArgTypesFromData` as well, because the emitted spelling
 * only matters insofar as the props table can resolve it.
 */
import { logger } from 'storybook/internal/node-logger';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  AngularClassMeta,
  Directive,
  Method,
  Property,
  PropertyInitializer,
} from '../types.ts';
import { extractArgTypesFromData } from '../extract-arg-types.ts';
import {
  analyzeInline as analyze,
  analyzeWithUnresolvableAngular,
  byName,
  componentIn,
  names,
} from './__testutils__/inline-source.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

// These tests are about what the analyzer records, so nothing here may be filtered on the way out.
const ANALYZER_EXTRACT_OPTIONS = { propsTable: 'all' } as const;

const soleComponent = (meta: ReturnType<typeof analyze>) => meta.components[0] as Directive;
type LiteralInitializer = Extract<PropertyInitializer, { kind: 'literal' }>;

const literal = (
  text: string,
  literalKind: LiteralInitializer['literalKind']
): LiteralInitializer => ({ kind: 'literal', literalKind, text });
const expression = (text: string) => ({ kind: 'expression', text });

describe('@Input and @Output aliases', () => {
  const SOURCE = `
    import { Component, EventEmitter, Input, Output } from '@angular/core';

    @Component({ selector: 'sb-alias-required', template: '' })
    export class AliasRequiredComponent {
      @Input('buttonLabel') label = '';

      @Input({ alias: 'tone', required: true }) kind!: string;

      @Input({ required: false }) hint?: string;

      /**
       * Accessor input whose default only exists as documentation.
       *
       * @default Another default value
       */
      @Input()
      get anotherDefaultValue() {
        return this.#anotherDefaultValue;
      }

      set anotherDefaultValue(value: string) {
        this.#anotherDefaultValue = value;
      }

      #anotherDefaultValue = 'Another default value';

      @Output('saved') persisted = new EventEmitter<number>();
    }
  `;

  it('reports an input under its alias, and reads the actual `required` boolean', () => {
    const inputs = componentIn(SOURCE).inputsClass;

    // `label` and `kind` are gone: an aliased member is only bindable under its alias.
    expect(names(inputs)).toEqual(['anotherDefaultValue', 'buttonLabel', 'hint', 'tone']);

    // `required` is the option's value, not merely whether the key was written.
    expect(byName(inputs, 'tone')).toMatchObject({ required: true, optional: false });
    expect(byName(inputs, 'hint')).toMatchObject({ required: false, optional: true });
    expect(byName(inputs, 'buttonLabel')).toMatchObject({
      optional: false,
      initializer: literal("''", 'string'),
    });
    expect(byName(inputs, 'buttonLabel').required).toBeUndefined();
  });

  it('does not mark an input required just because `@Input()` carries no `required` key', () => {
    const argTypes = extractArgTypesFromData(componentIn(SOURCE), {
      metadataJson: undefined,
      ...ANALYZER_EXTRACT_OPTIONS,
    });

    // An initializer is what settles it: `buttonLabel` has one, so binding it is optional.
    expect(argTypes.buttonLabel?.type?.required).toBeUndefined();
    expect(argTypes.tone?.type?.required).toBe(true);
    expect(argTypes.hint?.type?.required).toBeUndefined();
  });

  it('leaves an accessor input’s `@default` tag as its only default carrier', () => {
    // A getter has no initializer, so without the tag there would be nothing to show.
    expect(byName(componentIn(SOURCE).inputsClass, 'anotherDefaultValue')).toMatchObject({
      type: 'string',
      jsdoctags: [
        { tagName: { text: 'default', escapedText: 'default' }, comment: 'Another default value' },
      ],
    });
  });

  it('reports an output under its alias too', () => {
    const outputs = componentIn(SOURCE).outputsClass;

    expect(names(outputs)).toEqual(['saved']);
    expect(byName(outputs, 'saved')).toMatchObject({
      type: 'EventEmitter',
      initializer: expression('new EventEmitter<number>()'),
    });
  });
});

describe('aliased decorator imports', () => {
  it('recognizes decorators imported under another name, as Angular itself does', () => {
    const component = componentIn(`
      import {
        Component as NgComponent,
        EventEmitter,
        Input as InputDecorator,
        Output as OutputDecorator,
      } from '@angular/core';

      @NgComponent({ selector: 'sb-aliased-imports', template: '' })
      export class AliasedImportsComponent {
        @InputDecorator() label?: 'a' | 'b';

        @OutputDecorator() saved = new EventEmitter<number>();
      }
    `);

    expect(names(component.inputsClass)).toEqual(['label']);
    expect(names(component.outputsClass)).toEqual(['saved']);
    expect(names(component.propertiesClass)).toEqual([]);
  });
});

describe('pipes, injectables and plain classes', () => {
  const SOURCE = `
    import { Injectable, NgModule, Pipe } from '@angular/core';

    /** Formats things. */
    @Pipe({ name: 'sbFormat' })
    export class FormatPipe {
      transform(value: string, width?: number): string {
        return value.padEnd(width ?? 0);
      }
    }

    @Injectable()
    export class DataService {
      rows = 3;

      load(id: number): Promise<string[]> {
        return Promise.resolve([\`\${id}\`]);
      }
    }

    export class Paginator {
      page = 1;

      constructor(
        public pageSize: number,
        label?: string
      ) {
        void label;
      }

      next(): void {
        this.page += 1;
      }
    }

    @NgModule({})
    export class NoiseModule {}
  `;

  it('gives a pipe its template name and records each method’s parameters', () => {
    const pipe = analyze(SOURCE).pipes[0] as AngularClassMeta & {
      ngname: string;
      methods: Method[];
    };

    expect(pipe).toMatchObject({
      name: 'FormatPipe',
      type: 'pipe',
      ngname: 'sbFormat',
      rawdescription: 'Formats things.',
    });
    expect(byName(pipe.methods, 'transform').args).toEqual([
      { name: 'value', type: 'string', optional: false },
      { name: 'width', type: 'number', optional: true },
    ]);
    expect(byName(pipe.methods, 'transform').returnType).toBe('string');
  });

  it('splits an injectable into properties and methods rather than IO buckets', () => {
    const injectable = analyze(SOURCE).injectables[0] as AngularClassMeta & {
      properties: Property[];
      methods: { name: string; returnType: string }[];
    };

    expect(injectable).toMatchObject({ name: 'DataService', type: 'injectable' });
    expect(byName(injectable.properties, 'rows')).toMatchObject({
      type: 'number',
      initializer: literal('3', 'number'),
    });
    expect(byName(injectable.methods, 'load').returnType).toBe('Promise<string[]>');
  });

  it('promotes a constructor parameter property, and emits no constructor method', () => {
    const paginator = analyze(SOURCE).classes[0] as AngularClassMeta & {
      properties: Property[];
      methods: { name: string }[];
    };

    expect(paginator).toMatchObject({ name: 'Paginator', type: 'class' });
    // `pageSize` is `public`, so it is part of the surface; the plain `label` parameter is not.
    expect(names(paginator.properties)).toEqual(['page', 'pageSize']);
    expect(byName(paginator.properties, 'pageSize')).toMatchObject({ type: 'number' });
    expect(names(paginator.methods)).toEqual(['next']);
  });

  it('drops an @NgModule from every bucket', () => {
    const meta = analyze(SOURCE);
    const everything = [
      ...meta.components,
      ...meta.directives,
      ...meta.pipes,
      ...meta.injectables,
      ...meta.classes,
    ];

    expect(names(everything)).not.toContain('NoiseModule');
  });
});

describe('signal inputs and outputs', () => {
  it('unwraps InputSignal/ModelSignal/OutputEmitterRef through the checker', () => {
    const component = componentIn(`
      import { Component, input, model, output } from '@angular/core';

      @Component({ selector: 'sb-signal-checker', template: '' })
      export class SignalCheckerComponent {
        // No generic and a non-literal default: only the checker's InputSignal<T> unwrap types this.
        ratios = input([0.5, 1]);

        // Union literal default: the unwrap has to keep the union, not widen it to string.
        align = model('left' as 'left' | 'right');

        tags = output<Set<string>>();
      }
    `);

    expect(byName(component.inputsClass, 'ratios')).toMatchObject({
      type: 'number[]',
      initializer: literal('[0.5, 1]', 'composite'),
    });
    expect(byName(component.inputsClass, 'align')).toMatchObject({
      type: '"left" | "right"',
      initializer: literal("'left'", 'string'),
    });
    expect(byName(component.outputsClass, 'tags')).toMatchObject({ type: 'Set<string>' });
  });

  it('falls back to bare names when nothing in the file resolves', () => {
    // A project whose `@angular/core` types are unreachable still gets a props table; the types
    // then come from explicit generics and literal defaults rather than from the checker.
    const component = componentIn(`
      @Component({ selector: 'sb-signal-fallback', template: '' })
      export class SignalFallbackComponent {
        label = input('hi');

        count = input.required<number>();

        step = input(2, { alias: 'increment' });

        toggled = output<boolean>();

        value = model(1);

        notSignal = compute('x');
      }
    `);

    expect(names(component.inputsClass)).toEqual(['count', 'increment', 'label', 'value']);
    expect(byName(component.inputsClass, 'label')).toMatchObject({
      type: 'string',
      required: false,
      optional: false,
      initializer: literal("'hi'", 'string'),
    });
    expect(byName(component.inputsClass, 'count')).toMatchObject({
      type: 'number',
      required: true,
    });
    expect(byName(component.inputsClass, 'increment')).toMatchObject({
      type: 'number',
      initializer: literal('2', 'number'),
    });

    expect(names(component.outputsClass)).toEqual(['toggled', 'value']);
    expect(byName(component.outputsClass, 'toggled')).toMatchObject({
      type: 'boolean',
      required: false,
    });
    for (const bucket of [component.inputsClass, component.outputsClass]) {
      expect(byName(bucket, 'value')).toMatchObject({
        type: 'number',
        initializer: literal('1', 'number'),
      });
    }

    // An unresolved call that is not a signal factory stays an ordinary property.
    expect(byName(component.propertiesClass, 'notSignal')).toMatchObject({
      initializer: expression("compute('x')"),
    });
  });

  it('falls back the same way when the @angular/core import itself cannot be resolved', () => {
    const meta = analyzeWithUnresolvableAngular(`
      import { Component, input, model, output } from '@angular/core';

      @Component({ selector: 'sb-unresolved-core', template: '' })
      export class UnresolvedCoreComponent {
        label = input('hi');

        checked = model.required<boolean>();

        toggled = output<boolean>();
      }
    `);
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'label')).toMatchObject({
      type: 'string',
      initializer: literal("'hi'", 'string'),
      required: false,
    });
    expect(byName(component.inputsClass, 'checked')).toMatchObject({
      type: 'boolean',
      required: true,
    });
    expect(byName(component.outputsClass, 'toggled')).toMatchObject({ type: 'boolean' });
  });

  it('does not treat a resolved non-Angular `input` function as a signal', () => {
    const component = componentIn(`
      import { Component } from '@angular/core';

      function input(value: string): string {
        return value;
      }

      @Component({ selector: 'sb-not-a-signal', template: '' })
      export class NotASignalComponent {
        label = input('hi');
      }
    `);

    expect(component.inputsClass).toEqual([]);
    expect(byName(component.propertiesClass, 'label')).toMatchObject({
      type: 'string',
      initializer: expression("input('hi')"),
    });
  });
});

describe('the miscellaneous type index', () => {
  const TYPES = `
    export type Outer = Inner;
    export type Inner = 'x' | 'y';

    // A deliberate cycle: the collector has to stop rather than recurse until the worker dies.
    export type LoopA = LoopB;
    export type LoopB = LoopA;

    export enum Numeric {
      Zero,
      One = 1,
    }

    export enum Weird {
      Computed = 1 << 2,
    }
  `;

  const SOURCE = `
    import { Component, Input } from '@angular/core';

    import { Numeric, Weird, type LoopA, type Outer } from './types.ts';

    @Component({ selector: 'sb-misc', template: '' })
    export class MiscComponent {
      @Input() tone: Outer = 'x';

      @Input() level: Numeric = Numeric.One;

      @Input() loop?: LoopA;

      @Input() weird?: Weird;
    }
  `;

  it('follows an alias to the aliases it references, and survives a cycle', () => {
    const { typealiases } = analyze(SOURCE, { 'types.ts': TYPES }).miscellaneous;

    expect(names(typealiases)).toEqual(['Inner', 'LoopA', 'LoopB', 'Outer']);
    expect(byName(typealiases, 'Outer').rawtype).toBe('Inner');
    expect(byName(typealiases, 'Inner').rawtype).toBe('"x" | "y"');
    expect(byName(typealiases, 'LoopA').rawtype).toBe('LoopB');
    expect(byName(typealiases, 'LoopB').rawtype).toBe('LoopA');
  });

  it('records an enum member’s value only when it has a readable one', () => {
    const { enumerations } = analyze(SOURCE, { 'types.ts': TYPES }).miscellaneous;

    expect(names(enumerations)).toEqual(['Numeric', 'Weird']);
    // An auto-incremented member and a computed one carry no value the consumer can offer.
    expect(byName(enumerations, 'Numeric').childs).toEqual([
      { name: 'Zero' },
      { name: 'One', value: 1 },
    ]);
    expect(byName(enumerations, 'Weird').childs).toEqual([{ name: 'Computed' }]);
  });

  it('indexes a checker-inferred enum and signal alias, not just annotated ones', () => {
    const meta = analyze(
      `
      import { Component, Input, input } from '@angular/core';

      import { Side, Status } from './types.ts';

      @Component({ selector: 'sb-checker-misc', template: '' })
      export class CheckerMiscComponent {
        // Unannotated: the enum type only becomes known through checker inference.
        @Input() status = Status.Active;

        // No generic: the alias only becomes known through the InputSignal<T> unwrap.
        align = input('left' as Side);
      }
    `,
      {
        'types.ts': `
          export enum Status {
            Active = 'active',
            Inactive = 'inactive',
          }

          export type Side = 'left' | 'right';
        `,
      }
    );
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'status').type).toBe('Status');
    expect(byName(component.inputsClass, 'align').type).toBe('Side');
    expect(byName(meta.miscellaneous.enumerations, 'Status').childs).toEqual([
      { name: 'Active', value: 'active' },
      { name: 'Inactive', value: 'inactive' },
    ]);
    expect(byName(meta.miscellaneous.typealiases, 'Side').rawtype).toBe('"left" | "right"');

    // Which is what lets the props table offer them as choices.
    const argTypes = extractArgTypesFromData(component, {
      metadataJson: meta,
      ...ANALYZER_EXTRACT_OPTIONS,
    });
    expect(argTypes.status.type).toEqual({ name: 'enum', value: ['active', 'inactive'] });
    expect(argTypes.align.type).toEqual({ name: 'enum', value: ['left', 'right'] });
  });

  it('answers to the local spelling when a type is imported under a different name', () => {
    const meta = analyze(
      `
      import { Component, Input } from '@angular/core';

      import { Choice as ButtonChoice, Level as ButtonLevel } from './types.ts';

      @Component({ selector: 'sb-renamed-type-import', template: '' })
      export class RenamedTypeImportComponent {
        @Input() choice: ButtonChoice = 'x';
        @Input() level: ButtonLevel = ButtonLevel.Low;
      }
    `,
      {
        'types.ts': `
          export type Choice = 'x' | 'y';

          export enum Level {
            Low = 'low',
            High = 'high',
          }
        `,
      }
    );
    const component = soleComponent(meta);

    // The props table shows the local spelling, so `miscellaneous` has to be keyed by it too.
    expect(byName(component.inputsClass, 'choice').type).toBe('ButtonChoice');
    expect(byName(component.inputsClass, 'level').type).toBe('ButtonLevel');
    expect(names(meta.miscellaneous.typealiases)).toContain('ButtonChoice');
    expect(names(meta.miscellaneous.enumerations)).toContain('ButtonLevel');

    const argTypes = extractArgTypesFromData(component, {
      metadataJson: meta,
      ...ANALYZER_EXTRACT_OPTIONS,
    }) as Record<string, { type?: unknown }>;
    expect(argTypes.choice?.type).toEqual({ name: 'enum', value: ['x', 'y'] });
    expect(argTypes.level?.type).toEqual({ name: 'enum', value: ['low', 'high'] });
  });

  it('JSON-escapes a string-literal type so the consumer can parse its members', () => {
    const meta = analyze(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-quoted', template: '' })
      export class QuotedComponent {
        @Input() dir: 'a"b' | 'c' = 'c';
      }
    `);
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'dir').type).toBe('"a\\"b" | "c"');
    const argTypes = extractArgTypesFromData(component, {
      metadataJson: meta,
      ...ANALYZER_EXTRACT_OPTIONS,
    });
    expect(argTypes.dir.type).toEqual({ name: 'enum', value: ['a"b', 'c'] });
  });

  it('resolves an alias over an as-const array element type to its literal members', () => {
    const meta = analyze(
      `
      import { Component, Input } from '@angular/core';

      import { ButtonVariant } from './types.ts';

      @Component({ selector: 'sb-const-array', template: '' })
      export class ConstArrayComponent {
        @Input() variant: ButtonVariant = 'primary';
      }
    `,
      {
        'types.ts': `
          export const buttonVariants = ['primary', 'secondary', 'tertiary'] as const;

          export type ButtonVariant = (typeof buttonVariants)[number];
        `,
      }
    );
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'variant').type).toBe('ButtonVariant');
    expect(byName(meta.miscellaneous.typealiases, 'ButtonVariant').rawtype).toBe(
      '"primary" | "secondary" | "tertiary"'
    );

    const argTypes = extractArgTypesFromData(component, {
      metadataJson: meta,
      ...ANALYZER_EXTRACT_OPTIONS,
    });
    expect(argTypes.variant.type).toEqual({
      name: 'enum',
      value: ['primary', 'secondary', 'tertiary'],
    });
  });

  it('resolves a union that includes another alias imported from a second file', () => {
    const meta = analyze(
      `
      import { Component, Input } from '@angular/core';

      import { Tone } from './tone.ts';

      @Component({ selector: 'sb-alias-member', template: '' })
      export class AliasMemberComponent {
        @Input() tone: Tone = 'info';
      }
    `,
      {
        'tone.ts': `
          import { LegacyTone } from './legacy.ts';

          export type Tone = 'info' | 'warn' | LegacyTone;
        `,
        'legacy.ts': `export type LegacyTone = 'legacy';`,
      }
    );
    const component = soleComponent(meta);

    expect(byName(meta.miscellaneous.typealiases, 'Tone').rawtype).toBe(
      '"info" | "warn" | "legacy"'
    );

    const argTypes = extractArgTypesFromData(component, {
      metadataJson: meta,
      ...ANALYZER_EXTRACT_OPTIONS,
    });
    expect(argTypes.tone.type).toEqual({ name: 'enum', value: ['info', 'warn', 'legacy'] });
  });

  it('resolves a keyof typeof alias to the keys of the map behind it', () => {
    const meta = analyze(
      `
      import { Component, Input } from '@angular/core';

      import { IconSize } from './types.ts';

      @Component({ selector: 'sb-keyof', template: '' })
      export class KeyofComponent {
        @Input() size: IconSize = 'sm';
      }
    `,
      {
        'types.ts': `
          export const ICON_SIZES = { sm: 12, md: 16, lg: 24 };

          export type IconSize = keyof typeof ICON_SIZES;
        `,
      }
    );
    const component = soleComponent(meta);

    expect(byName(meta.miscellaneous.typealiases, 'IconSize').rawtype).toBe('"sm" | "md" | "lg"');

    const argTypes = extractArgTypesFromData(component, {
      metadataJson: meta,
      ...ANALYZER_EXTRACT_OPTIONS,
    });
    expect(argTypes.size.type).toEqual({ name: 'enum', value: ['sm', 'md', 'lg'] });
  });

  it('resolves a union alias re-exported through a barrel file', () => {
    const meta = analyze(
      `
      import { Component, Input } from '@angular/core';

      import { Tone } from './barrel.ts';

      @Component({ selector: 'sb-barrel', template: '' })
      export class BarrelComponent {
        @Input() tone: Tone = 'info';
      }
    `,
      {
        'barrel.ts': `export * from './defs.ts';`,
        'defs.ts': `export type Tone = 'info' | 'warn' | 'error';`,
      }
    );
    const component = soleComponent(meta);

    const argTypes = extractArgTypesFromData(component, {
      metadataJson: meta,
      ...ANALYZER_EXTRACT_OPTIONS,
    });
    expect(argTypes.tone.type).toEqual({ name: 'enum', value: ['info', 'warn', 'error'] });
  });

  it('resolves a primitive-union alias to a primitive control, not an enum', () => {
    const meta = analyze(
      `
      import { Component, Input } from '@angular/core';

      import { Amount } from './types.ts';

      @Component({ selector: 'sb-primitive-union', template: '' })
      export class PrimitiveUnionComponent {
        @Input() amount: Amount = 0;
      }
    `,
      { 'types.ts': `export type Amount = string | number;` }
    );
    const component = soleComponent(meta);

    expect(byName(meta.miscellaneous.typealiases, 'Amount').rawtype).toBe('string | number');

    const argTypes = extractArgTypesFromData(component, {
      metadataJson: meta,
      ...ANALYZER_EXTRACT_OPTIONS,
    });
    expect(argTypes.amount.type).toEqual({ name: 'number' });
  });

  it('strips the import qualifier so a signal input’s alias matches its indexed entry', () => {
    const meta = analyze(
      `
      import { Component, input } from '@angular/core';

      // Only the constant is imported, never the type, so the checker renders the inferred type
      // with an \`import("...")\` qualifier that has to be stripped before it can match.
      import { DEFAULT_THEME } from './types.ts';

      @Component({ selector: 'sb-signal-alias', template: '' })
      export class SignalAliasComponent {
        theme = input(DEFAULT_THEME);
      }
    `,
      {
        'types.ts': `
          export type Theme = 'light' | 'dark';

          export const DEFAULT_THEME: Theme = 'light';
        `,
      }
    );
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'theme').type).toBe('Theme');
    expect(names(meta.miscellaneous.typealiases)).toContain('Theme');

    const argTypes = extractArgTypesFromData(component, {
      metadataJson: meta,
      ...ANALYZER_EXTRACT_OPTIONS,
    }) as Record<string, { type?: unknown }>;
    expect(argTypes.theme?.type).toEqual({ name: 'enum', value: ['light', 'dark'] });
  });
});

describe('which members survive, and how they are described', () => {
  const SOURCE = `
    import { Component, Input } from '@angular/core';

    /**
     * Shows misc collection.
     *
     * @summary A summary line.
     */
    @Component({ selector: 'sb-misc', template: '' })
    export class MiscComponent {
      /**
       * Callback invoked on change.
       *
       * @default 'none'
       */
      @Input() onChange?: string;

      formatter = (value: number) => \`\${value}\`;

      @Input() decoratedFormatter = (value: number) => \`\${value}\`;

      /** @ignore */
      secret = 'hidden';

      private cache: string[] = [];

      protected shield = true;

      static counter = 0;

      get zoom(): number {
        return 1;
      }

      set zoom(value: number) {
        void value;
      }

      ngOnInit(): void {}
    }
  `;

  it('keeps private, protected and lifecycle members, and drops static and @ignore ones', () => {
    const component = componentIn(SOURCE);

    // Visibility is not the analyzer's filter to apply: the consumer decides what to show.
    expect(names(component.propertiesClass)).toEqual(['cache', 'formatter', 'shield', 'zoom']);
    expect(names(component.propertiesClass)).not.toContain('secret');
    expect(names(component.propertiesClass)).not.toContain('counter');
    expect(names(component.methodsClass)).toEqual(['ngOnInit']);
  });

  it('records arrow initializer source for diagnostics', () => {
    const component = componentIn(SOURCE);

    // Expression text is diagnostic metadata; neither arrow reaches the props table as a default.
    expect(byName(component.propertiesClass, 'formatter')).toMatchObject({
      initializer: expression('(value: number) => `${value}`'),
      type: '(value: number) => string',
    });
    expect(byName(component.inputsClass, 'decoratedFormatter')).toMatchObject({
      initializer: expression('(value: number) => `${value}`'),
      type: '(value: number) => string',
    });
  });

  it('reads an undecorated accessor pair as a single property', () => {
    expect(byName(componentIn(SOURCE).propertiesClass, 'zoom')).toMatchObject({
      type: 'number',
      optional: false,
    });
  });

  it('carries class and member descriptions with their tags as plain text', () => {
    const component = componentIn(SOURCE) as AngularClassMeta & Directive;

    expect(component.rawdescription).toBe('Shows misc collection.');
    expect(component.jsdoctags).toEqual([
      { tagName: { text: 'summary', escapedText: 'summary' }, comment: 'A summary line.' },
    ]);
    expect(byName(component.inputsClass, 'onChange').rawdescription).toBe(
      'Callback invoked on change.'
    );
    expect(byName(component.inputsClass, 'onChange').jsdoctags).toEqual([
      { tagName: { text: 'default', escapedText: 'default' }, comment: "'none'" },
    ]);
  });
});

describe('methods', () => {
  it('emits one entry per overloaded method, preferring the implementation signature', () => {
    const component = componentIn(`
      import { Component, HostListener } from '@angular/core';

      @Component({ selector: 'sb-overloads', template: '' })
      export class OverloadsComponent {
        @HostListener('window:resize')
        onResize(): void {}

        format(value: string): string;
        format(value: number): number;
        format(value: string | number): string | number {
          return value;
        }
      }
    `);

    const formats = component.methodsClass.filter((method) => method.name === 'format');
    expect(formats).toHaveLength(1);
    expect(formats[0]).toMatchObject({
      args: [{ name: 'value', type: 'string | number', optional: false }],
      returnType: 'string | number',
    });
    // A host listener is still a method of the class, so it is not filtered out here.
    expect(names(component.methodsClass)).toContain('onResize');
  });

  it('strips an import() qualifier from an inferred return type', () => {
    const component = componentIn(
      `
      import { Component } from '@angular/core';

      import { subscribe } from './helper.ts';

      @Component({ selector: 'sb-listen', template: '' })
      export class ListenComponent {
        listen() {
          return subscribe();
        }
      }
    `,
      {
        'helper.ts': `
          export class SubscriptionLike {
            closed = false;
          }

          export const subscribe = (): SubscriptionLike => new SubscriptionLike();
        `,
      }
    );

    expect(byName(component.methodsClass, 'listen').returnType).toBe('SubscriptionLike');
  });
});

describe('the selector', () => {
  const SOURCE = `
    import { Component, Directive } from '@angular/core';

    const CHIP_SELECTOR = 'sb-indirect-chip';

    @Component({ selector: CHIP_SELECTOR, template: '' })
    export class IndirectSelectorComponent {}

    function computeSelector(): string {
      return 'sb-dynamic';
    }

    @Directive({ selector: computeSelector() })
    export class DynamicSelectorDirective {}

    @Component({ template: '' })
    export class NoSelectorComponent {}
  `;

  it('follows an identifier to its string-literal initializer', () => {
    expect(byName(analyze(SOURCE).components, 'IndirectSelectorComponent').selector).toBe(
      'sb-indirect-chip'
    );
  });

  it('is omitted when it cannot be resolved statically, or is not written at all', () => {
    const meta = analyze(SOURCE);

    expect(byName(meta.directives, 'DynamicSelectorDirective').selector).toBeUndefined();
    expect(byName(meta.components, 'NoSelectorComponent').selector).toBeUndefined();
  });
});

describe('inheritance', () => {
  it('keeps an inherited input the child re-declares as a plain property', () => {
    const component = componentIn(`
      import { Component, Directive, Input } from '@angular/core';

      // Selector-less base: Angular only inherits input metadata from a decorated base.
      @Directive()
      export class OverrideBase {
        /** Whether the control is disabled. */
        @Input() disabled = true;
      }

      @Component({ selector: 'sb-override-input', template: '' })
      export class OverrideInputComponent extends OverrideBase {
        // Re-declared without the decorator; Angular still inherits the input metadata.
        override disabled = false;
      }
    `);

    // The base decides the bucket, the child's own initializer decides the default.
    expect(byName(component.inputsClass, 'disabled')).toMatchObject({
      initializer: literal('false', 'boolean'),
    });
    expect(names(component.propertiesClass)).not.toContain('disabled');
  });

  const METADATA_BASES = `
    import { Component, Directive, Input } from '@angular/core';

    @Directive({
      selector: '[sbMetadataBase]',
      inputs: ['color', 'tone'],
      outputs: ['tapped'],
    })
    export class MetadataBase {
      color = 'red';
      tone = 'soft';
      tapped: unknown;
    }

    @Component({ selector: 'sb-metadata-child', template: '' })
    export class MetadataChildComponent extends MetadataBase {
      shade = 'dark';
    }

    @Directive({ selector: '[sbPlainBase]' })
    export class PlainBase {
      density = 'comfortable';
    }

    @Component({ selector: 'sb-metadata-of-inherited', template: '', inputs: ['density'] })
    export class MetadataOfInheritedComponent extends PlainBase {}

    @Directive({ selector: '[sbSpacingBase]' })
    export class SpacingBase {
      spacing = 'compact';
    }

    @Directive({ selector: '[sbSpacingMid]', inputs: ['spacing'] })
    export class SpacingMidBase extends SpacingBase {}

    @Component({ selector: 'sb-spacing-leaf', template: '' })
    export class SpacingLeafComponent extends SpacingMidBase {}

    @Directive({ selector: '[sbAliasedBase]' })
    export class AliasedBase {
      @Input('label') text = 'base';
    }

    @Component({ selector: 'sb-aliased-child', template: '' })
    export class AliasedChildComponent extends AliasedBase {
      @Input() override text = 'child';
    }
  `;

  it('inherits a base’s metadata-declared inputs and outputs', () => {
    const child = byName(analyze(METADATA_BASES).components, 'MetadataChildComponent') as Directive;

    expect(names(child.inputsClass)).toEqual(['color', 'tone']);
    expect(names(child.outputsClass)).toEqual(['tapped']);
    expect(names(child.propertiesClass)).toEqual(['shade']);
  });

  it('reclassifies an inherited field named by the child’s own metadata', () => {
    const child = byName(
      analyze(METADATA_BASES).components,
      'MetadataOfInheritedComponent'
    ) as Directive;

    expect(names(child.inputsClass)).toEqual(['density']);
    expect(child.propertiesClass).toEqual([]);
  });

  it('reclassifies a grandparent’s field named by a middle class’s metadata', () => {
    const leaf = byName(analyze(METADATA_BASES).components, 'SpacingLeafComponent') as Directive;

    // Angular binds `[spacing]` on the leaf, so emitting it as a plain property drops the control.
    // The middle class's metadata can only see the field once its own base is merged first.
    expect(names(leaf.inputsClass)).toEqual(['spacing']);
    expect(leaf.propertiesClass).toEqual([]);
  });

  it('drops the base alias when the child re-declares the same field as an input', () => {
    const child = byName(analyze(METADATA_BASES).components, 'AliasedChildComponent') as Directive;

    // `label` is the base's binding name for the same field, so emitting it too would offer a
    // control that binds to nothing.
    expect(names(child.inputsClass)).toEqual(['text']);
    expect(byName(child.inputsClass, 'text')).toMatchObject({
      initializer: literal("'child'", 'string'),
    });
  });

  it('merges multi-level bases with the child winning, and takes plain members from a .d.ts', () => {
    const meta = analyze(
      `
      import { Component, Input } from '@angular/core';

      import { DtsBase } from './dts-base';

      export class MidBase extends DtsBase {
        @Input() midFlag = false;

        hint = 'mid';

        midHelper(): void {}
      }

      @Component({ selector: 'sb-inherit-chain', template: '' })
      export class InheritChainComponent extends MidBase {
        @Input() own = '';

        midHelper(): void {}
      }
    `,
      {
        'dts-base.d.ts': `
          export declare class DtsBase {
            hint: string;
            helper(entry: string): number;
          }
        `,
      }
    );
    const component = soleComponent(meta);

    expect(names(component.inputsClass)).toEqual(['midFlag', 'own']);
    expect(byName(component.inputsClass, 'midFlag')).toMatchObject({
      type: 'boolean',
      initializer: literal('false', 'boolean'),
    });

    // `hint` comes from MidBase, which overrides the .d.ts base's declaration.
    expect(names(component.propertiesClass)).toEqual(['hint']);
    expect(byName(component.propertiesClass, 'hint')).toMatchObject({
      initializer: literal("'mid'", 'string'),
    });

    // A .d.ts records no decorators, so it can only contribute plain members, never IO.
    expect(names(component.methodsClass)).toEqual(['helper', 'midHelper']);
    expect(byName(component.methodsClass, 'helper')).toMatchObject({
      args: [{ name: 'entry', type: 'string', optional: false }],
      returnType: 'number',
    });

    const midBase = byName(meta.classes, 'MidBase') as AngularClassMeta & {
      inputsClass?: Property[];
      methods: { name: string }[];
    };
    expect(names(midBase.inputsClass)).toEqual(['midFlag']);
    expect(names(midBase.methods)).toEqual(['helper', 'midHelper']);
  });

  it('substitutes the extends clause’s type arguments into inherited member types', () => {
    const meta = analyze(
      `
      import { Component } from '@angular/core';

      import { BaseCardView } from './base-card-view.ts';

      export class CardTextModel { value = ''; }

      @Component({ selector: 'sb-card-text', template: '' })
      export class CardTextComponent extends BaseCardView<CardTextModel> {}
    `,
      {
        'base-card-view.ts': `
          import { Input } from '@angular/core';

          export abstract class BaseCardView<T> {
            @Input() property!: T;

            items: T[] = [];

            find(key: string): T | undefined { return undefined; }
          }
        `,
      }
    );
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'property').type).toBe('CardTextModel');
    expect(byName(component.propertiesClass, 'items').type).toBe('CardTextModel[]');
    expect(byName(component.methodsClass, 'find')).toMatchObject({
      args: [{ name: 'key', type: 'string', optional: false }],
      returnType: 'CardTextModel | undefined',
    });
  });

  it('substitutes a literal-union type argument down to an enum control', () => {
    const meta = analyze(`
      import { Component, Input } from '@angular/core';

      export abstract class SizedBase<S> {
        @Input() size!: S;
      }

      @Component({ selector: 'sb-sized', template: '' })
      export class SizedComponent extends SizedBase<'small' | 'large'> {}
    `);
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'size').type).toBe('"small" | "large"');

    const argTypes = extractArgTypesFromData(component, {
      metadataJson: meta,
      ...ANALYZER_EXTRACT_OPTIONS,
    });
    expect(argTypes.size.type).toEqual({
      name: 'enum',
      value: ['small', 'large'],
      required: true,
    });
  });

  it('substitutes through a middle generic base down to the leaf’s concrete argument', () => {
    const meta = analyze(`
      import { Component, Input } from '@angular/core';

      export class Entry { id = 0; }

      export class ListBase<T> {
        @Input() data!: T;
      }

      export class PagedListBase<U> extends ListBase<U> {}

      @Component({ selector: 'sb-paged', template: '' })
      export class PagedComponent extends PagedListBase<Entry> {}
    `);
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'data').type).toBe('Entry');

    const base = byName(meta.classes, 'ListBase') as AngularClassMeta & {
      inputsClass: Property[];
    };
    expect(byName(base.inputsClass, 'data').type).toBe('T');
  });

  it('falls back to the parameter default when the extends clause pins nothing', () => {
    const meta = analyze(`
      import { Component, Input } from '@angular/core';

      export class FallbackBase<T = string> {
        @Input() fallback!: T;
      }

      @Component({ selector: 'sb-fallback', template: '' })
      export class FallbackComponent extends FallbackBase {}
    `);
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'fallback').type).toBe('string');
  });

  it('does not rewrite a method’s own type parameter that shadows the class’s', () => {
    const meta = analyze(`
      import { Component } from '@angular/core';

      export class Entry { id = 0; }

      export abstract class GridBase<T> {
        pluck<T>(picker: (row: T) => T): T[] { return []; }

        first(): T | undefined { return undefined; }
      }

      @Component({ selector: 'sb-grid', template: '' })
      export class GridComponent extends GridBase<Entry> {}
    `);
    const component = soleComponent(meta);

    // pluck's own <T> shadows the class parameter, so its caller-chosen T stays bare.
    expect(byName(component.methodsClass, 'pluck')).toMatchObject({
      args: [{ name: 'picker', type: '(row: T) => T' }],
      returnType: 'T[]',
    });
    expect(byName(component.methodsClass, 'first').returnType).toBe('Entry | undefined');
  });

  it('does not rewrite a function type’s own type parameter that shadows the class’s', () => {
    const meta = analyze(`
      import { Component, Input } from '@angular/core';

      export class Entry { id = 0; }

      export abstract class ComparerBase<T> {
        @Input() compare!: <T>(a: T, b: T) => number;

        @Input() pick!: (row: T) => T;
      }

      @Component({ selector: 'sb-comparer', template: '' })
      export class ComparerComponent extends ComparerBase<Entry> {}
    `);
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'compare').type).toBe('<T>(a: T, b: T) => number');
    expect(byName(component.inputsClass, 'pick').type).toBe('(row: Entry) => Entry');
  });

  it('does not rewrite a type-literal property key that spells a type parameter’s name', () => {
    const meta = analyze(`
      import { Component, Input } from '@angular/core';

      export abstract class ConfBase<value> {
        @Input() config!: { value: string; payload: value };
      }

      @Component({ selector: 'sb-conf', template: '' })
      export class ConfComponent extends ConfBase<number> {}
    `);
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'config').type).toBe(
      '{ value: string; payload: number; }'
    );
  });

  it('leaves a shadowing binder alone even when its constraint is itself generic', () => {
    const [component] = analyze(`
      import { Component, Input } from '@angular/core';

      export class Base<T> {
        @Input() pick!: <T extends Array<string>>(a: T) => T;
      }

      @Component({ selector: 'sb-leaf', template: '' })
      export class LeafComponent extends Base<Entry> {}

      export interface Entry { id: string }
    `).components as Directive[];

    expect(byName(component.inputsClass, 'pick').type).toBe('<T extends Array<string>>(a: T) => T');
  });

  it('does not rewrite a string literal that spells a type parameter’s name', () => {
    const meta = analyze(`
      import { Component, Input } from '@angular/core';

      export abstract class ModeBase<T> {
        @Input() mode!: 'T' | T;
      }

      @Component({ selector: 'sb-mode', template: '' })
      export class ModeComponent extends ModeBase<'live'> {}
    `);
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'mode').type).toBe('"T" | "live"');
  });

  it('ignores a decorator that only shares Angular’s spelling', () => {
    const component = componentIn(
      `
      import { Component } from '@angular/core';

      // Spelled \`Input\`, but not Angular's.
      import { Input } from './foreign.ts';

      @Component({ selector: 'sb-foreign-decorator', template: '' })
      export class ForeignDecoratorComponent {
        @Input() tracked = 'no';
      }
    `,
      { 'foreign.ts': `export const Input = (): PropertyDecorator => () => {};` }
    );

    expect(component.inputsClass).toEqual([]);
    expect(names(component.propertiesClass)).toEqual(['tracked']);
  });
});

describe('metadata-declared IO, in the generated-wrapper style', () => {
  // Fields carry no member-level decorator; the @Component metadata arrays declare them instead,
  // which is how SAP/ui5-webcomponents-ngx generates its wrappers.
  const SOURCE = `
    import { Component, EventEmitter } from '@angular/core';

    @Component({
      selector: 'sb-metadata-io',
      template: '',
      inputs: ['disabled', 'design: buttonDesign', { name: 'state', required: true }],
      outputs: ['ui5Click: click'],
    })
    export class MetadataIoComponent {
      /** Whether the component is disabled. */
      disabled = false;

      design: 'Default' | 'Positive' = 'Default';

      state?: string;

      ui5Click = new EventEmitter<void>();

      plainField = 1;
    }
  `;

  it('moves a named field into its bucket, honouring the alias and `required`', () => {
    const component = componentIn(SOURCE);

    expect(byName(component.inputsClass, 'disabled').description).toContain(
      'Whether the component is disabled.'
    );
    expect(byName(component.inputsClass, 'buttonDesign').type).toBe('"Default" | "Positive"');
    expect(byName(component.inputsClass, 'state')).toMatchObject({
      required: true,
      optional: false,
    });
    expect(byName(component.outputsClass, 'click').type).toContain('EventEmitter');
    // Only the fields the metadata names move; the rest stay properties.
    expect(names(component.propertiesClass)).toEqual(['plainField']);
  });

  it('sorts each bucket after reclassifying, not before', () => {
    // Reclassification appends to the target bucket, so sorting has to be the last pass or a moved
    // field lands past the sorted block. Every member here is declared out of order.
    const component = componentIn(`
      import { Component, EventEmitter } from '@angular/core';

      @Component({
        selector: 'sb-late-sort',
        template: '',
        inputs: ['zulu', 'alpha'],
        outputs: ['zebraChange', 'alfaChange'],
      })
      export class LateSortComponent {
        zulu = 1;
        alpha = 2;
        zebraChange = new EventEmitter<void>();
        alfaChange = new EventEmitter<void>();
        omega = 3;
        beta = 4;
      }
    `);

    expect(names(component.inputsClass)).toEqual(['alpha', 'zulu']);
    expect(names(component.outputsClass)).toEqual(['alfaChange', 'zebraChange']);
    expect(names(component.propertiesClass)).toEqual(['beta', 'omega']);
  });
});

describe('function-typed members', () => {
  const SOURCE = `
    import { Component, Input } from '@angular/core';

    @Component({ selector: 'sb-function-types', template: '' })
    export class FunctionTypesComponent {
      @Input() format!: (value: number, unit?: string) => string;

      @Input() compare!: (a: { id: string }, b: { id: string }) => -1 | 0 | 1;

      @Input() collect!: (...items: string[]) => void;

      @Input() factory!: new (value: number) => Date;

      @Input() nullableCallback?: ((value: string) => void) | null;
    }
  `;

  it('renders parameters and return type instead of a bare "function"', () => {
    const inputs = componentIn(SOURCE).inputsClass;

    expect(byName(inputs, 'format').type).toBe('(value: number, unit?: string) => string');
    expect(byName(inputs, 'compare').type).toBe(
      '(a: { id: string }, b: { id: string }) => -1 | 0 | 1'
    );
    expect(byName(inputs, 'collect').type).toBe('(...items: string[]) => void');
  });

  it('marks a constructor type with `new` rather than flattening it to the same placeholder', () => {
    expect(byName(componentIn(SOURCE).inputsClass, 'factory').type).toBe(
      'new (value: number) => Date'
    );
  });

  it('gives a signature the function control, but a union containing one keeps its summary', () => {
    const component = componentIn(SOURCE);
    const argTypes = extractArgTypesFromData(component, {
      metadataJson: undefined,
      ...ANALYZER_EXTRACT_OPTIONS,
    }) as Record<
      string,
      { type?: { name?: string; required?: boolean }; table?: { type?: { summary?: string } } }
    >;

    expect(argTypes.format?.type).toEqual({ name: 'function', required: true });
    expect(argTypes.format?.table?.type?.summary).toBe('(value: number, unit?: string) => string');
    expect(argTypes.nullableCallback?.table?.type?.summary).toBe(
      '((value: string) => void) | null'
    );
  });
});

describe('real-world JSDoc, visibility and accessor edge cases', () => {
  // Shapes found on vmware-clarity/ng-clarity and geonetwork/geonetwork-ui during the community
  // evaluations.
  const SOURCE = `
    import { Component, EventEmitter, Input, Output } from '@angular/core';

    @Component({ selector: 'sb-clarity-edges', template: '' })
    export class ClarityEdgesComponent {
      private readonly clicks = new EventEmitter<number[]>();

      /** Emitted when map features are clicked. */
      @Output() get featuresClick(): EventEmitter<number[]> {
        return this.clicks;
      }

      @Output('renamedChange') get internalChange(): EventEmitter<string> {
        return new EventEmitter<string>();
      }

      /*****
       * property cells
       *
       * @description
       * A query list of the cells in this row.
       */
      @Input() cells = 3;

      private get internalState(): string {
        return 'hidden';
      }

      protected get errorPresent(): boolean {
        return false;
      }

      get publicPair(): number {
        return 1;
      }

      set publicPair(value: number) {
        void value;
      }

      /**
       * @deprecated Will be removed in v15. Use \`openNav\` instead.
       */
      toggleNav(navLevel: number): void {
        void navLevel;
      }
    }
  `;

  it('prefers an explicit @description tag over a malformed comment body', () => {
    const cells = byName(componentIn(SOURCE).inputsClass, 'cells');

    expect(cells.description).toBe('A query list of the cells in this row.');
    expect(cells.description).not.toContain('*');
  });

  it('keeps a leading **bold** marker on undecorated continuation lines', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-undecorated-jsdoc', template: '' })
      export class UndecoratedJsdocComponent {
        /**
        Defines the accessible role.

        **Note:** Use the ButtonAccessibleRole type.
        */
        @Input() accessibleRole = 'button';
      }
    `);

    expect(byName(component.inputsClass, 'accessibleRole').description).toBe(
      'Defines the accessible role.\n\n**Note:** Use the ButtonAccessibleRole type.'
    );
  });

  it('strips the decoration asterisk of a `* **bold**` line, keeping the bold marker', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-decorated-jsdoc', template: '' })
      export class DecoratedJsdocComponent {
        /**
         * Defines the accessible role.
         *
         * **Note:** Use the ButtonAccessibleRole type.
         */
        @Input() accessibleRole = 'button';
      }
    `);

    expect(byName(component.inputsClass, 'accessibleRole').description).toBe(
      'Defines the accessible role.\n\n**Note:** Use the ButtonAccessibleRole type.'
    );
  });

  it('keeps a leading **bold** marker in an undecorated @description tag body', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-undecorated-description-tag', template: '' })
      export class UndecoratedDescriptionTagComponent {
        /**
        property role
        @description
        Defines the role.

        **Note:** stays bold.
        */
        @Input() role = 'button';
      }
    `);

    expect(byName(component.inputsClass, 'role').description).toBe(
      'Defines the role.\n\n**Note:** stays bold.'
    );
  });

  it('keeps @deprecated on a method, so it survives all the way into the props table', () => {
    const component = componentIn(SOURCE);
    const tagNames = (byName(component.methodsClass, 'toggleNav').jsdoctags ?? []).map(
      (tag) => tag.tagName?.escapedText
    );
    expect(tagNames).toContain('deprecated');

    const argTypes = extractArgTypesFromData(component, {
      metadataJson: undefined,
      ...ANALYZER_EXTRACT_OPTIONS,
    }) as Record<string, { table?: { jsDocTags?: unknown } }>;
    expect(argTypes.toggleNav?.table?.jsDocTags).toMatchObject({
      deprecated: 'Will be removed in v15. Use `openNav` instead.',
    });
  });

  it('records an undecorated accessor pair with its visibility, whatever that visibility is', () => {
    const properties = componentIn(SOURCE).propertiesClass;

    expect(names(properties)).toEqual(
      expect.arrayContaining(['publicPair', 'internalState', 'errorPresent'])
    );
    expect(byName(properties, 'publicPair').visibility).toBeUndefined();
    expect(byName(properties, 'internalState').visibility).toBe('private');
    expect(byName(properties, 'errorPresent').visibility).toBe('protected');
  });

  it('treats @Output() on a getter as an output, alias honoured', () => {
    const component = componentIn(SOURCE);

    expect(byName(component.outputsClass, 'featuresClick').type).toBe('EventEmitter<number[]>');
    expect(byName(component.outputsClass, 'featuresClick').description).toContain(
      'Emitted when map features are clicked.'
    );
    expect(names(component.outputsClass)).toContain('renamedChange');
    // Having become outputs, they must not also appear as properties.
    expect(names(component.propertiesClass)).not.toContain('featuresClick');
    expect(names(component.propertiesClass)).not.toContain('internalChange');
  });
});

describe('member identity is the declared field, not the emitted name', () => {
  const SOURCE = `
    import { Component, ContentChild, ElementRef, ViewChild } from '@angular/core';

    @Component({ selector: 'sb-member-identity', template: '' })
    export class MemberIdentityComponent {
      @ViewChild('asProperty') asProperty!: ElementRef;

      @ViewChild('asSetter')
      set asSetter(value: ElementRef) {
        this.captured = value;
      }

      @ContentChild('asGetter')
      get asGetter(): ElementRef {
        return this.captured;
      }

      captured!: ElementRef;

      constructor(
        public pageSize: number,
        readonly pageIndex: number,
        private hidden: number,
        /** @deprecated use pageSize */
        public legacySize: number
      ) {}

      static create(): string {
        return '';
      }

      create(): number {
        return 0;
      }

      static get mode(): string {
        return 'static';
      }

      get mode(): number {
        return 1;
      }
    }
  `;

  it('keeps decorators on an accessor-declared property, as on a property-declared one', () => {
    const properties = componentIn(SOURCE).propertiesClass;

    expect(byName(properties, 'asProperty').decorators).toEqual([{ name: 'ViewChild' }]);
    expect(byName(properties, 'asSetter').decorators).toEqual([{ name: 'ViewChild' }]);
    expect(byName(properties, 'asGetter').decorators).toEqual([{ name: 'ContentChild' }]);
  });

  it('emits parameter properties, bare `readonly` included, with their tags and visibility', () => {
    const component = componentIn(SOURCE);

    expect(names(component.propertiesClass)).toContain('pageSize');
    expect(names(component.propertiesClass)).toContain('pageIndex');
    expect(byName(component.propertiesClass, 'hidden').visibility).toBe('private');
    expect(byName(component.propertiesClass, 'pageSize').visibility).toBeUndefined();
    expect(byName(component.propertiesClass, 'legacySize').jsdoctags).toMatchObject([
      { tagName: { text: 'deprecated' } },
    ]);
  });

  it('says why a member it left out is missing', () => {
    const debug = vi.spyOn(logger, 'debug').mockImplementation(() => {});

    analyze(`
      import { Component } from '@angular/core';

      @Component({ selector: 'sb-ignored', template: '' })
      export class IgnoredComponent {
        /** @ignore */
        hidden = 1;
      }
    `);

    expect(debug.mock.calls.map(([message]) => message)).toContain(
      '[angular-cm] IgnoredComponent.hidden left out of docgen: tagged @ignore'
    );
  });

  it('does not let a static member stand in for the instance member of the same name', () => {
    const component = componentIn(SOURCE);

    expect(
      component.methodsClass.filter((method) => method.name === 'create').map((m) => m.returnType)
    ).toEqual(['number']);
    expect(
      component.propertiesClass.filter((property) => property.name === 'mode').map((p) => p.type)
    ).toEqual(['number']);
  });
});

describe('static members', () => {
  it('drops static members entirely, Angular coercion statics and ɵ internals included', () => {
    // Angular only recognizes IO on instance fields, `static defaults = input(...)` included.
    const component = componentIn(`
      import { Component, Input, input } from '@angular/core';

      @Component({ selector: 'sb-statics', template: '' })
      export class StaticsComponent {
        @Input() date?: Date | null | string;

        static ngAcceptInputType_date: Date | null | string;

        static ɵfac = () => new StaticsComponent();

        static defaults = input('nope');

        static describe(): string {
          return '';
        }

        static get mode(): string {
          return 'static';
        }
      }
    `);

    expect(names(component.inputsClass)).toEqual(['date']);
    expect(names(component.propertiesClass)).toEqual([]);
    expect(names(component.methodsClass)).toEqual([]);
  });

  it('keeps a service’s own statics, dropping only the ones Angular generates', () => {
    const file = analyze(`
      import { Injectable } from '@angular/core';

      @Injectable()
      export class DataService {
        static VERSION = '1.0.0';

        static ɵfac = () => new DataService();

        static create(): DataService {
          return new DataService();
        }
      }
    `);

    expect(names(file.injectables[0].properties)).toEqual(['VERSION']);
    expect(names(file.injectables[0].methods)).toEqual(['create']);
  });
});

describe('visibility and @internal are recorded, not acted on', () => {
  const SOURCE = `
    import { ChangeDetectorRef, Component, Input, inject } from '@angular/core';

    @Component({ selector: 'sb-visibility', template: '' })
    export class VisibilityComponent {
      @Input() title = '';

      private readonly cdr = inject(ChangeDetectorRef);

      protected helperLabel = 'help';

      publicNote = 'note';

      /** @internal */
      buildId = 'build-1';

      private stash(): void {}

      protected assist(): void {}

      /** @internal */
      reset(): void {}
    }
  `;

  it('marks a private property and leaves a public one unmarked', () => {
    const component = componentIn(SOURCE);

    expect(byName(component.propertiesClass, 'cdr').visibility).toBe('private');
    expect(byName(component.propertiesClass, 'publicNote').visibility).toBeUndefined();
    expect(byName(component.inputsClass, 'title').visibility).toBeUndefined();
  });

  it('marks a protected property, which stays bindable from a template', () => {
    expect(byName(componentIn(SOURCE).propertiesClass, 'helperLabel').visibility).toBe('protected');
  });

  it('marks private and protected methods', () => {
    const component = componentIn(SOURCE);

    expect(byName(component.methodsClass, 'stash').visibility).toBe('private');
    expect(byName(component.methodsClass, 'assist').visibility).toBe('protected');
  });

  it('marks an @internal property and method regardless of their visibility', () => {
    const component = componentIn(SOURCE);

    expect(byName(component.propertiesClass, 'buildId').internal).toBe(true);
    expect(byName(component.propertiesClass, 'buildId').visibility).toBeUndefined();
    expect(byName(component.methodsClass, 'reset').internal).toBe(true);
  });

  it('keeps every one of them in the payload for the extractor to decide on', () => {
    const component = componentIn(SOURCE);

    expect(names(component.propertiesClass)).toEqual(
      expect.arrayContaining(['cdr', 'helperLabel', 'publicNote', 'buildId'])
    );
    expect(names(component.methodsClass)).toEqual(
      expect.arrayContaining(['stash', 'assist', 'reset'])
    );
  });
});

describe('what `propsTable` does with the recorded visibility', () => {
  const SOURCE = `
    import { Component, EventEmitter, Input, Output, model } from '@angular/core';

    @Component({ selector: 'sb-props-table', template: '' })
    export class PropsTableComponent {
      constructor(private readonly cdr: string, protected readonly host: string) {}

      @Input() private density = 'compact';

      @Output() private densityChange = new EventEmitter<string>();

      /** @internal */
      @Input() experimentalKnob = '';

      /** @internal */
      @Output() experimentalChanged = new EventEmitter<string>();

      protected helperLabel = 'help';

      private pageCount = 10;

      #secret = 'hidden';

      /** @internal */
      buildId = 'build-1';

      /** @internal */
      draft = model('');

      published = model('');
    }
  `;

  const argNames = (propsTable: 'all' | 'api' | 'inputs') =>
    Object.keys(
      extractArgTypesFromData(componentIn(SOURCE), { metadataJson: undefined, propsTable })
    );

  it('documents every recorded member under `all`', () => {
    expect(argNames('all')).toEqual(
      expect.arrayContaining([
        'cdr',
        'host',
        'density',
        'densityChange',
        'helperLabel',
        'pageCount',
        '#secret',
        'buildId',
        'draft',
        'draftChange',
      ])
    );
  });

  it('keeps a private input and output under `api`, which a parent template can still bind', () => {
    expect(argNames('api')).toEqual(expect.arrayContaining(['density', 'densityChange']));
  });

  it("keeps `protected` under `api`, which the component's own template reads", () => {
    expect(argNames('api')).toEqual(expect.arrayContaining(['helperLabel', 'host']));
  });

  it('drops what nothing can reach under `api`', () => {
    expect(argNames('api')).not.toContain('cdr');
    expect(argNames('api')).not.toContain('pageCount');
    expect(argNames('api')).not.toContain('#secret');
  });

  it('drops an @internal input and output in api and inputs, keeping them in all', () => {
    expect(argNames('all')).toEqual(
      expect.arrayContaining(['experimentalKnob', 'experimentalChanged'])
    );
    expect(argNames('api')).not.toContain('experimentalKnob');
    expect(argNames('api')).not.toContain('experimentalChanged');
    expect(argNames('inputs')).not.toContain('experimentalKnob');
  });

  it('says why a member is missing from the table', () => {
    const debug = vi.fn();

    extractArgTypesFromData(componentIn(SOURCE), {
      metadataJson: undefined,
      propsTable: 'api',
      logger: { warn: vi.fn(), debug },
    });

    expect(debug.mock.calls.map(([message]) => message)).toContain(
      "PropsTableComponent.cdr left out of the props table: propsTable 'api'"
    );
  });

  it('takes an @internal `model()` and its synthesized change output together', () => {
    expect(argNames('all')).toEqual(expect.arrayContaining(['draft', 'draftChange']));
    expect(argNames('api')).not.toContain('draft');
    expect(argNames('api')).not.toContain('draftChange');
    expect(argNames('api')).toEqual(expect.arrayContaining(['published', 'publishedChange']));
  });

  it('narrows to the inputs section, keeping each documented model pair whole', () => {
    const inputs = argNames('inputs');

    expect(inputs).toEqual(expect.arrayContaining(['density', 'published', 'publishedChange']));
    expect(inputs).not.toContain('helperLabel');
    expect(inputs).not.toContain('densityChange');
    expect(inputs).not.toContain('draft');
    expect(inputs).not.toContain('draftChange');
  });
});
