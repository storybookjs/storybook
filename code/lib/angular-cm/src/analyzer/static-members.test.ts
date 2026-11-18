import { describe, expect, it } from 'vitest';

import { analyzeInline, names } from './__testutils__/inline-source.ts';

describe('retained static members', () => {
  it('keeps static and instance accessors with the same name distinct', () => {
    const file = analyzeInline(`
      import { Injectable } from '@angular/core';

      @Injectable()
      export class DataService {
        static get mode(): string { return 'static'; }
        get mode(): number { return 1; }
      }
    `);

    expect(file.injectables[0].properties.map(({ type }) => type).sort()).toEqual([
      'number',
      'string',
    ]);
  });

  it('keeps static signal-shaped values as properties on non-template classes', () => {
    const file = analyzeInline(`
      import { Injectable, input, model, output } from '@angular/core';

      @Injectable()
      export class DataService {
        static defaults = input('compact');
        static state = model(1);
        static events = output<string>();
      }
    `);

    expect(names(file.injectables[0].properties)).toEqual(['defaults', 'events', 'state']);
  });

  it('merges inherited static and instance names independently in both directions', () => {
    const file = analyzeInline(`
      import { Injectable } from '@angular/core';

      class Base {
        get mode(): string { return 'base'; }
        static get size(): boolean { return true; }
      }

      @Injectable()
      export class DataService extends Base {
        static get mode(): number { return 1; }
        get size(): Date { return new Date(); }
      }
    `);

    const properties = file.injectables[0].properties;
    expect(
      properties
        .filter(({ name }) => name === 'mode')
        .map(({ type }) => type)
        .sort()
    ).toEqual(['number', 'string']);
    expect(
      properties
        .filter(({ name }) => name === 'size')
        .map(({ type }) => type)
        .sort()
    ).toEqual(['Date', 'boolean']);
  });

  it('does not confuse a static member with an instance name carrying the old key prefix', () => {
    const sameClass = analyzeInline(`
      import { Injectable } from '@angular/core';

      @Injectable()
      export class SameClassService {
        static get mode(): string { return 'static'; }
        get 'static:mode'(): number { return 1; }
      }
    `).injectables[0];

    expect(names(sameClass.properties)).toEqual(['mode', 'static:mode']);

    const inherited = analyzeInline(`
      import { Injectable } from '@angular/core';

      class Base {
        static get mode(): string { return 'static'; }
      }

      @Injectable()
      export class ChildService extends Base {
        get 'static:mode'(): number { return 1; }
      }
    `).injectables[0];

    expect(names(inherited.properties)).toEqual(['mode', 'static:mode']);
  });
});
