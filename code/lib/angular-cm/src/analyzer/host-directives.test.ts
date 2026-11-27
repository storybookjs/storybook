import { describe, expect, it } from 'vitest';

import type { Directive, PropertyInitializer } from '../types.ts';
import { extractArgTypesFromData } from '../extract-arg-types.ts';
import {
  analyzeForExtraction,
  analyzeInline as analyze,
  byName,
  componentIn,
  names,
} from './__testutils__/inline-source.ts';

type LiteralInitializer = Extract<PropertyInitializer, { kind: 'literal' }>;

const literal = (
  text: string,
  literalKind: LiteralInitializer['literalKind']
): LiteralInitializer => ({ kind: 'literal', literalKind, text });

describe('host directives', () => {
  const TOOLTIP = `
    import { Directive, EventEmitter, Input, Output, input, model, output } from '@angular/core';

    @Directive({ selector: '[sbTooltip]' })
    export class TooltipDirective {
      /** Text the tooltip shows. */
      text = input('');

      position = input<'above' | 'below'>('above');

      @Input('tooltipDisabled') disabled = false;

      open = model(false);

      shown = output<void>();

      @Output() hidden = new EventEmitter<void>();
    }
  `;

  it('exposes the inputs and outputs a host lists, under the name it gives them', () => {
    const component = componentIn(
      `
        import { Component } from '@angular/core';

        import { TooltipDirective } from './tooltip.ts';

        @Component({
          selector: 'sb-chip',
          template: '',
          hostDirectives: [
            {
              directive: TooltipDirective,
              inputs: ['text: tooltip', 'tooltipDisabled'],
              outputs: ['shown'],
            },
          ],
        })
        export class ChipComponent {}
      `,
      { 'tooltip.ts': TOOLTIP }
    );

    // `position` and `hidden` are left unlisted, so a template on the host cannot bind them.
    expect(names(component.inputsClass)).toEqual(['tooltip', 'tooltipDisabled']);
    expect(names(component.outputsClass)).toEqual(['shown']);
    expect(byName(component.inputsClass, 'tooltip')).toMatchObject({
      type: 'string',
      initializer: literal("''", 'string'),
      rawdescription: 'Text the tooltip shows.',
    });
    expect(byName(component.inputsClass, 'tooltipDisabled')).toMatchObject({ type: 'boolean' });
    expect(component.propertiesClass).toEqual([]);
  });

  it('exposes nothing for a bare directive reference', () => {
    const component = componentIn(
      `
        import { Component } from '@angular/core';

        import { TooltipDirective } from './tooltip.ts';

        @Component({ selector: 'sb-chip', template: '', hostDirectives: [TooltipDirective] })
        export class ChipComponent {}
      `,
      { 'tooltip.ts': TOOLTIP }
    );

    expect(component.inputsClass).toEqual([]);
    expect(component.outputsClass).toEqual([]);
  });

  it('follows a shared exposure config through constants, spreads and `as const`', () => {
    const component = componentIn(
      `
        import { Component } from '@angular/core';

        import { TooltipDirective } from './tooltip.ts';

        const TOOLTIP_INPUTS = ['text', 'position'] as const;

        export const TooltipHost = {
          directive: TooltipDirective,
          inputs: TOOLTIP_INPUTS,
        };

        const SHARED = [TooltipHost];

        @Component({ selector: 'sb-chip', template: '', hostDirectives: [...SHARED] })
        export class ChipComponent {}
      `,
      { 'tooltip.ts': TOOLTIP }
    );

    expect(names(component.inputsClass)).toEqual(['position', 'text']);
  });

  it('keeps the host’s own binding when it declares the same public name', () => {
    const component = componentIn(
      `
        import { Component, input } from '@angular/core';

        import { TooltipDirective } from './tooltip.ts';

        @Component({
          selector: 'sb-chip',
          template: '',
          hostDirectives: [{ directive: TooltipDirective, inputs: ['text'] }],
        })
        export class ChipComponent {
          /** The chip's own label. */
          text = input<string>();
        }
      `,
      { 'tooltip.ts': TOOLTIP }
    );

    expect(names(component.inputsClass)).toEqual(['text']);
    expect(byName(component.inputsClass, 'text')).toMatchObject({
      rawdescription: "The chip's own label.",
    });
  });

  it('pairs an exposed `model()` with its `Change` output, as the class’s own model is paired', () => {
    const component = componentIn(
      `
        import { Component } from '@angular/core';

        import { TooltipDirective } from './tooltip.ts';

        @Component({
          selector: 'sb-chip',
          template: '',
          hostDirectives: [
            {
              directive: TooltipDirective,
              inputs: ['open: expanded'],
              outputs: ['openChange: expandedChange'],
            },
          ],
        })
        export class ChipComponent {}
      `,
      { 'tooltip.ts': TOOLTIP }
    );

    expect(names(component.inputsClass)).toEqual(['expanded']);
    expect(names(component.outputsClass)).toEqual(['expanded']);
    expect(byName(component.outputsClass, 'expanded')).toMatchObject({ type: 'boolean' });
  });

  it('reads what a host directive itself exposes from its own host directives', () => {
    const component = componentIn(
      `
        import { Component, Directive } from '@angular/core';

        import { TooltipDirective } from './tooltip.ts';

        @Directive({
          selector: '[sbHint]',
          hostDirectives: [{ directive: TooltipDirective, inputs: ['text: hint'] }],
        })
        export class HintDirective {}

        @Component({
          selector: 'sb-chip',
          template: '',
          hostDirectives: [{ directive: HintDirective, inputs: ['hint'] }],
        })
        export class ChipComponent {}
      `,
      { 'tooltip.ts': TOOLTIP }
    );

    expect(names(component.inputsClass)).toEqual(['hint']);
    expect(byName(component.inputsClass, 'hint')).toMatchObject({ type: 'string' });
  });

  it('resolves a `forwardRef` to a directive declared later in the file', () => {
    const meta = analyze(`
      import { Component, Directive, forwardRef, input } from '@angular/core';

      @Component({
        selector: 'sb-chip',
        template: '',
        hostDirectives: [{ directive: forwardRef(() => BadgeDirective), inputs: ['count'] }],
      })
      export class ChipComponent {}

      @Directive({ selector: '[sbBadge]' })
      export class BadgeDirective {
        count = input(0);
      }
    `);

    expect(names(meta.components[0].inputsClass)).toEqual(['count']);
  });

  it('accepts only `forwardRef` as a deferred directive reference', () => {
    const meta = analyze(`
      import { Component, Directive, input } from '@angular/core';

      const pick = <T>(factory: () => T): T => factory();

      @Component({
        selector: 'sb-chip',
        template: '',
        hostDirectives: [{ directive: pick(() => BadgeDirective), inputs: ['count'] }],
      })
      export class ChipComponent {}

      @Directive({ selector: '[sbBadge]' })
      export class BadgeDirective {
        count = input(0);
      }
    `);

    expect(meta.components[0].inputsClass).toEqual([]);
  });

  it('reads a shorthand `inputs` property', () => {
    const component = componentIn(
      `
        import { Component } from '@angular/core';

        import { TooltipDirective } from './tooltip.ts';

        const inputs = ['text'];

        @Component({
          selector: 'sb-chip',
          template: '',
          hostDirectives: [{ directive: TooltipDirective, inputs }],
        })
        export class ChipComponent {}
      `,
      { 'tooltip.ts': TOOLTIP }
    );

    expect(names(component.inputsClass)).toEqual(['text']);
  });

  it('stops at a constant that spreads itself', () => {
    const component = componentIn(`
      import { Component } from '@angular/core';

      // @ts-expect-error A self-reference is a type error, and must not hang the analyzer.
      const LOOP: unknown[] = [...LOOP];

      @Component({ selector: 'sb-chip', template: '', hostDirectives: LOOP })
      export class ChipComponent {}
    `);

    expect(component.inputsClass).toEqual([]);
  });

  it('reads a compiled host directive from a declaration file', () => {
    const component = componentIn(
      `
        import { Component } from '@angular/core';

        import { LibraryTooltip } from './library-tooltip';

        @Component({
          selector: 'sb-chip',
          template: '',
          hostDirectives: [{ directive: LibraryTooltip, inputs: ['text'], outputs: ['shown'] }],
        })
        export class ChipComponent {}
      `,
      {
        'library-tooltip.d.ts': `
          import * as i0 from '@angular/core';

          export declare class LibraryTooltip {
            text: i0.InputSignal<string>;
            shown: i0.OutputEmitterRef<void>;
          }
        `,
      }
    );

    expect(names(component.inputsClass)).toEqual(['text']);
    expect(names(component.outputsClass)).toEqual(['shown']);
  });

  describe('inherited through a base class', () => {
    it('keeps bindings from same-named directives in different files apart', () => {
      const directive = (selector: string) => `
        import { Directive, input } from '@angular/core';

        @Directive({ selector: '[${selector}]' })
        export class TooltipDirective {
          label = input('');
        }
      `;
      const meta = analyze(
        `
          import { Component, Directive } from '@angular/core';

          import { TooltipDirective as FirstTooltip } from './a.ts';
          import { TooltipDirective as SecondTooltip } from './b.ts';

          @Directive({
            selector: '[sbZ]',
            hostDirectives: [{ directive: FirstTooltip, inputs: ['label: first'] }],
          })
          export class Z {}

          @Directive({
            selector: '[sbY]',
            hostDirectives: [{ directive: SecondTooltip, inputs: ['label: second'] }],
          })
          export class Y extends Z {}

          @Component({ selector: 'sb-c', template: '' })
          export class C extends Y {}
        `,
        { 'a.ts': directive('sbFirst'), 'b.ts': directive('sbSecond') }
      );

      expect(names(meta.components[0].inputsClass)).toEqual(['first', 'second']);
    });

    it('lets the subclass’s own binding of the same public name win', () => {
      const component = componentIn(
        `
          import { Component, Directive, input } from '@angular/core';

          import { TooltipDirective } from './tooltip.ts';

          @Directive({
            selector: '[sbBase]',
            hostDirectives: [{ directive: TooltipDirective, inputs: ['text'] }],
          })
          export class BaseDirective {}

          @Component({ selector: 'sb-chip', template: '' })
          export class ChipComponent extends BaseDirective {
            /** The chip's own label. */
            text = input<string>();
          }
        `,
        { 'tooltip.ts': TOOLTIP }
      );

      expect(names(component.inputsClass)).toEqual(['text']);
      expect(byName(component.inputsClass, 'text')).toMatchObject({
        rawdescription: "The chip's own label.",
      });
    });
  });

  describe('a `model()` whose halves are exposed apart', () => {
    const argTypesOf = (hostDirective: string, chipBody = '') => {
      const { meta, context } = analyzeForExtraction(
        `
          import { Component, output } from '@angular/core';

          import { TooltipDirective } from './tooltip.ts';

          @Component({ selector: 'sb-chip', template: '', hostDirectives: [${hostDirective}] })
          export class ChipComponent {
            ${chipBody}
          }
        `,
        { 'tooltip.ts': TOOLTIP }
      );
      const argTypes = extractArgTypesFromData(meta.components[0], {
        metadataJson: meta,
        propsTable: 'all',
        context,
      });
      return Object.fromEntries(
        Object.entries(argTypes).map(([name, argType]) => [name, argType.table?.category])
      );
    };

    it('documents the output alone under its own name', () => {
      expect(argTypesOf(`{ directive: TooltipDirective, outputs: ['openChange'] }`)).toEqual({
        openChange: 'outputs',
      });
    });

    it('shows the output half as an `output()` of the model value, with no default', () => {
      const { meta } = analyzeForExtraction(
        `
          import { Component } from '@angular/core';

          import { TooltipDirective } from './tooltip.ts';

          @Component({
            selector: 'sb-chip',
            template: '',
            hostDirectives: [{ directive: TooltipDirective, outputs: ['openChange'] }],
          })
          export class ChipComponent {}
        `,
        { 'tooltip.ts': TOOLTIP }
      );
      const output = byName((meta.components[0] as Directive).outputsClass, 'openChange');

      expect(output.type).toBe('boolean');
      expect(output.initializer).toBeUndefined();
    });

    it('documents a renamed output', () => {
      expect(
        argTypesOf(`{ directive: TooltipDirective, outputs: ['openChange: toggled'] }`)
      ).toEqual({ toggled: 'outputs' });
    });

    it('does not pair an input and output whose public names do not match', () => {
      expect(
        argTypesOf(`{ directive: TooltipDirective, inputs: ['open: o'], outputs: ['openChange'] }`)
      ).toEqual({ o: 'inputs', openChange: 'outputs' });
    });

    it('pairs a renamed input with its matching renamed output', () => {
      expect(
        argTypesOf(
          `{ directive: TooltipDirective, inputs: ['open: o'], outputs: ['openChange: oChange'] }`
        )
      ).toEqual({ o: 'inputs', oChange: 'outputs' });
    });

    it('yields to the host’s own output of the same name', () => {
      expect(
        argTypesOf(
          `{ directive: TooltipDirective, outputs: ['openChange'] }`,
          'openChange = output<boolean>();'
        )
      ).toEqual({ openChange: 'outputs' });
    });
  });
});
