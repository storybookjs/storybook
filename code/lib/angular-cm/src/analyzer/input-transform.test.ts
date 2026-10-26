import { describe, expect, it } from 'vitest';

import { extractArgTypesFromData } from '../extract-arg-types.ts';
import {
  analyzeInline as analyze,
  byName,
  componentIn,
  names,
} from './__testutils__/inline-source.ts';

const ANALYZER_EXTRACT_OPTIONS = { propsTable: 'all' } as const;

const soleComponent = (meta: ReturnType<typeof analyze>) => meta.components[0]!;

describe('input transforms', () => {
  it('documents the write type a transform accepts rather than the read type it returns', () => {
    const meta = analyze(`
      import { Component, input } from '@angular/core';

      const levelTransform = (value: 'primary' | 'secondary') =>
        value === 'primary' ? 'primary-button' : 'secondary-button';

      @Component({ selector: 'sb-level', template: '' })
      export class LevelComponent {
        level = input.required({ transform: levelTransform });
      }
    `);
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'level').type).toBe('"primary" | "secondary"');

    const argTypes = extractArgTypesFromData(component, {
      metadataJson: meta,
      ...ANALYZER_EXTRACT_OPTIONS,
    });
    expect(argTypes.level.type).toEqual({
      name: 'enum',
      value: ['primary', 'secondary'],
      required: true,
    });
  });

  it('documents the second type argument of input.required as the write type', () => {
    const component = componentIn(`
      import { Component, input } from '@angular/core';

      @Component({ selector: 'sb-date', template: '' })
      export class DateComponent {
        timestamp = input.required<Date, string | Date>({
          transform: (value: string | Date) => new Date(value),
        });
      }
    `);

    expect(byName(component.inputsClass, 'timestamp').type).toBe('string | Date');
  });

  it('documents the parameter type of an inline transform on a defaulted input', () => {
    const meta = analyze(`
      import { Component, input } from '@angular/core';

      @Component({ selector: 'sb-size', template: '' })
      export class SizeComponent {
        size = input('md-resolved', { transform: (value: 'sm' | 'md') => value + '-resolved' });
      }
    `);
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'size').type).toBe('"sm" | "md"');

    const argTypes = extractArgTypesFromData(component, {
      metadataJson: meta,
      ...ANALYZER_EXTRACT_OPTIONS,
    });
    expect(argTypes.size.type).toEqual({ name: 'enum', value: ['sm', 'md'] });
  });

  it('keeps the value argument type when the transform accepts unknown', () => {
    const component = componentIn(`
      import { Component, booleanAttribute, input } from '@angular/core';

      @Component({ selector: 'sb-toggle', template: '' })
      export class ToggleComponent {
        disabled = input(false, { transform: booleanAttribute });
      }
    `);

    expect(byName(component.inputsClass, 'disabled').type).toBe('boolean');
  });

  it('falls back to the explicit read type argument when the write type argument is unknown', () => {
    const component = componentIn(`
      import { Component, booleanAttribute, input } from '@angular/core';

      @Component({ selector: 'sb-toggle', template: '' })
      export class ToggleComponent {
        disabled = input<boolean, unknown>(false, { transform: booleanAttribute });
      }
    `);

    expect(byName(component.inputsClass, 'disabled').type).toBe('boolean');
  });

  it('falls back to the explicit read type argument when the write type argument is any', () => {
    const component = componentIn(`
      import { Component, input } from '@angular/core';

      @Component({ selector: 'sb-toggle', template: '' })
      export class ToggleComponent {
        disabled = input<boolean, any>(false, { transform: (value: any) => !!value });
      }
    `);

    expect(byName(component.inputsClass, 'disabled').type).toBe('boolean');
  });

  it('documents the parameter type of an @Input transform', () => {
    const meta = analyze(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-mode', template: '' })
      export class ModeComponent {
        @Input({ transform: (value: 'x' | 'y') => value.toUpperCase() }) mode = 'X';
      }
    `);
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'mode').type).toBe('"x" | "y"');

    const argTypes = extractArgTypesFromData(component, {
      metadataJson: meta,
      ...ANALYZER_EXTRACT_OPTIONS,
    });
    expect(argTypes.mode.type).toEqual({ name: 'enum', value: ['x', 'y'] });
  });

  it('resolves an @Input transform referenced from another file to its parameter alias', () => {
    const meta = analyze(
      `
      import { Component, Input } from '@angular/core';

      import { coerceAppearance } from './transforms.ts';

      @Component({ selector: 'sb-appearance', template: '' })
      export class AppearanceComponent {
        @Input({ transform: coerceAppearance }) appearance = 'flat';
      }
    `,
      {
        'transforms.ts': `
          export type Appearance = 'flat' | 'raised';

          export const coerceAppearance = (value: Appearance) => value;
        `,
      }
    );
    const component = soleComponent(meta);

    expect(byName(component.inputsClass, 'appearance').type).toBe('Appearance');
    expect(names(meta.miscellaneous.typealiases)).toContain('Appearance');

    const argTypes = extractArgTypesFromData(component, {
      metadataJson: meta,
      ...ANALYZER_EXTRACT_OPTIONS,
    });
    expect(argTypes.appearance.type).toEqual({ name: 'enum', value: ['flat', 'raised'] });
  });

  it('keeps the declared type when an @Input transform accepts unknown', () => {
    const component = componentIn(`
      import { Component, Input, booleanAttribute } from '@angular/core';

      @Component({ selector: 'sb-flag', template: '' })
      export class FlagComponent {
        @Input({ transform: booleanAttribute }) active = false;
      }
    `);

    expect(byName(component.inputsClass, 'active').type).toBe('boolean');
  });

  it('reads an overloaded transform from its last signature, the one Angular infers from', () => {
    const component = componentIn(`
      import { Component, Input, input } from '@angular/core';

      export function coerceSize(value: string): number;
      export function coerceSize(value: number): number;
      export function coerceSize(value: string | number): number { return Number(value); }

      @Component({ selector: 'sb-size', template: '' })
      export class SizeComponent {
        signalWidth = input(0, { transform: coerceSize });
        @Input({ transform: coerceSize }) decoratorWidth = 0;
      }
    `);

    expect(byName(component.inputsClass, 'decoratorWidth').type).toBe(
      byName(component.inputsClass, 'signalWidth').type
    );
    expect(byName(component.inputsClass, 'decoratorWidth').type).toBe('number');
  });

  it('documents the write type of a transform on a setter-declared @Input', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-width', template: '' })
      export class WidthComponent {
        @Input({ transform: (value: string | number) => Number(value) })
        set width(value: number) {
          this._width = value;
        }

        private _width = 0;
      }
    `);

    expect(byName(component.inputsClass, 'width').type).toBe('string | number');
  });
});
