import { describe, expect, it } from 'vitest';

import {
  analyzeWithUnresolvableAngular,
  componentIn,
  names,
} from './__testutils__/inline-source.ts';

describe('decorator resolution', () => {
  it('recognizes class and member decorators re-exported through multiple barrels', () => {
    const component = componentIn(
      `
        import { DeepComponent, DeepInput, DeepOutput } from './middle.ts';
        import { EventEmitter } from '@angular/core';

        @DeepComponent({ selector: 'sb-barrel', template: '' })
        export class BarrelComponent {
          @DeepInput() label = '';
          @DeepOutput() saved = new EventEmitter<void>();
        }
      `,
      {
        'barrel.ts': `
          export {
            Component as ComponentDecorator,
            Input as InputDecorator,
            Output as OutputDecorator,
          } from '@angular/core';
        `,
        'middle.ts': `
          export {
            ComponentDecorator as DeepComponent,
            InputDecorator as DeepInput,
            OutputDecorator as DeepOutput,
          } from './barrel.ts';
        `,
      }
    );

    expect(component.name).toBe('BarrelComponent');
    expect(names(component.inputsClass)).toEqual(['label']);
    expect(names(component.outputsClass)).toEqual(['saved']);
    expect(component.propertiesClass).toEqual([]);
  });

  it('uses the terminal symbol behind a namespace-imported barrel alias', () => {
    const component = componentIn(
      `
        import * as ng from './barrel.ts';

        @ng.DeepComponent({ selector: 'sb-barrel', template: '' })
        export class BarrelComponent {
          @ng.DeepInput() label = '';
        }
      `,
      {
        'barrel.ts': `
          export { Component as DeepComponent, Input as DeepInput } from '@angular/core';
        `,
      }
    );

    expect(names(component.inputsClass)).toEqual(['label']);
  });

  it('preserves import aliases when Angular itself cannot be resolved', () => {
    const meta = analyzeWithUnresolvableAngular(`
      import { Component as C, Input as I } from '@angular/core';

      @C({ selector: 'sb-unresolved', template: '' })
      export class UnresolvedComponent {
        @I() label = '';
      }
    `);

    expect(meta.components).toHaveLength(1);
    expect(names(meta.components[0].inputsClass)).toEqual(['label']);
  });
});
