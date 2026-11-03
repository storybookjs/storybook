import { describe, expect, it } from 'vitest';

import type { Property } from '../types.ts';
import { analyzeFiles, analyzeInline, byName, names } from './__testutils__/inline-source.ts';

const analyzeDeclaration = (source: string, extraFiles: Record<string, string> = {}) =>
  analyzeFiles('button.component.d.ts', { 'button.component.d.ts': source, ...extraFiles });

const declaring = (typeArguments: string) => `
  import * as i0 from '@angular/core';

  export declare class ButtonComponent {
    static ɵcmp: i0.ɵɵComponentDeclaration<${typeArguments}>;
  }
`;

const declaringMember = (member: string) => `
  import * as i0 from '@angular/core';

  export declare class OtherComponent {}

  export declare class ButtonComponent {
    ${member}
  }
`;

const MODERN_ARGUMENTS = `ButtonComponent, 'my-button', never, {}, {}, never, never, true`;

describe('a component compiled into a .d.ts declaration', () => {
  it.each([true, false])('reads the selector and `standalone: %s` from `ɵcmp`', (standalone) => {
    const meta = analyzeDeclaration(`
      import * as i0 from '@angular/core';

      export declare class ButtonComponent {
        static ɵcmp: i0.ɵɵComponentDeclaration<
          ButtonComponent,
          'my-button',
          never,
          {},
          {},
          never,
          never,
          ${standalone}
        >;
      }
    `);

    expect(meta.classes).toEqual([]);
    expect(meta.components).toEqual([
      expect.objectContaining({
        name: 'ButtonComponent',
        type: 'component',
        selector: 'my-button',
        standalone,
      }),
    ]);
  });

  it('reads a seven-argument declaration, the shape from before standalone existed, as non-standalone', () => {
    const [component] = analyzeDeclaration(
      declaring(`ButtonComponent, 'my-button', never, {}, {}, never, never`)
    ).components;

    expect(component).toMatchObject({ selector: 'my-button', standalone: false });
  });

  it('ignores the host-directive and signal arguments newer Angular versions append', () => {
    const [component] = analyzeDeclaration(
      declaring(`ButtonComponent, 'my-button', never, {}, {}, never, never, false, never, true`)
    ).components;

    expect(component).toMatchObject({ selector: 'my-button', standalone: false });
  });

  it.each(['boolean', 'Standalone'])(
    'leaves standalone unknown when its argument is `%s` rather than a boolean literal',
    (argument) => {
      const [component] = analyzeDeclaration(`
        type Standalone = true;
        ${declaring(`ButtonComponent, 'my-button', never, {}, {}, never, never, ${argument}`)}
      `).components;

      expect(component).toMatchObject({ type: 'component', selector: 'my-button' });
      expect(component).not.toHaveProperty('standalone');
    }
  );

  it('keeps `ng-component`, which Angular also binds when it stands in for an omitted selector', () => {
    const [component] = analyzeDeclaration(
      declaring(`ButtonComponent, 'ng-component', never, {}, {}, never, never, false`)
    ).components;

    expect(component).toMatchObject({ selector: 'ng-component', standalone: false });
  });

  it('reports no selector when it is not a string literal', () => {
    const [component] = analyzeDeclaration(
      declaring(`ButtonComponent, string, never, {}, {}, never, never, true`)
    ).components;

    expect(component).toMatchObject({ type: 'component', standalone: true });
    expect(component).not.toHaveProperty('selector');
  });

  it('reads a generic component, which Angular names with `any` type arguments', () => {
    const [component] = analyzeDeclaration(`
      import * as i0 from '@angular/core';

      export declare class TableComponent<T> {
        static ɵcmp: i0.ɵɵComponentDeclaration<
          TableComponent<any>, 'my-table', never, {}, {}, never, never, true
        >;
      }
    `).components;

    expect(component).toMatchObject({ name: 'TableComponent', selector: 'my-table' });
  });

  it.each([
    [
      'a named import',
      `import { ɵɵComponentDeclaration } from '@angular/core';`,
      'ɵɵComponentDeclaration',
    ],
    [
      'a renamed type import',
      `import type { ɵɵComponentDeclaration as Declaration } from '@angular/core';`,
      'Declaration',
    ],
  ])('follows %s of the declaration type', (_, importStatement, typeName) => {
    const [component] = analyzeDeclaration(`
      ${importStatement}

      export declare class ButtonComponent {
        static ɵcmp: ${typeName}<${MODERN_ARGUMENTS}>;
      }
    `).components;

    expect(component).toMatchObject({ selector: 'my-button', standalone: true });
  });

  it('documents its instance members as the properties of a component', () => {
    const [component] = analyzeDeclaration(`
      import * as i0 from '@angular/core';

      export declare class ButtonComponent {
        label: string;
        static ɵfac: i0.ɵɵFactoryDeclaration<ButtonComponent, never>;
        static ɵcmp: i0.ɵɵComponentDeclaration<${MODERN_ARGUMENTS}>;
      }
    `).components;

    expect(names(component.propertiesClass)).toEqual(['label']);
  });
});

const IO_SOURCE = `
  import { Component, EventEmitter, Input, Output, booleanAttribute, input, model, output } from '@angular/core';

  @Component({ selector: 'my-io', template: '', inputs: ['viaMeta: metaAlias'], outputs: ['metaOut'] })
  export class IoComponent {
    @Input() plain = '';
    @Input('publicName') aliased = '';
    @Input({ required: true }) needed!: number;
    @Input({ transform: booleanAttribute }) flag = false;
    @Input({ transform: (value: string | number) => Number(value) }) amount = 0;
    viaMeta = '';
    metaOut = new EventEmitter<void>();
    size = input<'sm' | 'md'>('sm');
    count = input.required<number>({ alias: 'total' });
    checked = model(false);
    open = model(false, { alias: 'expanded' });
    @Output() clicked = new EventEmitter<string>();
    @Output('renamed') internal = new EventEmitter<void>();
    toggled = output<boolean>();
    closed = output<void>({ alias: 'dismissed' });
  }
`;

// What ngc emits for IO_SOURCE in partial-compilation mode.
const IO_DECLARATION = `
  import { EventEmitter } from '@angular/core';
  import * as i0 from "@angular/core";
  export declare class IoComponent {
      plain: string;
      aliased: string;
      needed: number;
      flag: boolean;
      amount: number;
      viaMeta: string;
      metaOut: EventEmitter<void>;
      size: import("@angular/core").InputSignal<"sm" | "md">;
      count: import("@angular/core").InputSignal<number>;
      checked: import("@angular/core").ModelSignal<boolean>;
      open: import("@angular/core").ModelSignal<boolean>;
      clicked: EventEmitter<string>;
      internal: EventEmitter<void>;
      toggled: import("@angular/core").OutputEmitterRef<boolean>;
      closed: import("@angular/core").OutputEmitterRef<void>;
      static ɵfac: i0.ɵɵFactoryDeclaration<IoComponent, never>;
      static ɵcmp: i0.ɵɵComponentDeclaration<IoComponent, "my-io", never, { "viaMeta": { "alias": "metaAlias"; "required": false; }; "plain": { "alias": "plain"; "required": false; }; "aliased": { "alias": "publicName"; "required": false; }; "needed": { "alias": "needed"; "required": true; }; "flag": { "alias": "flag"; "required": false; }; "amount": { "alias": "amount"; "required": false; }; "size": { "alias": "size"; "required": false; "isSignal": true; }; "count": { "alias": "total"; "required": true; "isSignal": true; }; "checked": { "alias": "checked"; "required": false; "isSignal": true; }; "open": { "alias": "expanded"; "required": false; "isSignal": true; }; }, { "metaOut": "metaOut"; "checked": "checkedChange"; "open": "expandedChange"; "clicked": "clicked"; "internal": "renamed"; "toggled": "toggled"; "closed": "dismissed"; }, never, never, true, never>;
      static ngAcceptInputType_flag: unknown;
      static ngAcceptInputType_amount: string | number;
  }
`;

describe('inputs and outputs read from the compiled maps', () => {
  const binding = (property: Property) => ({
    name: property.name,
    type: property.type,
    required: property.required,
    optional: property.optional,
    hasLine: property.line !== undefined,
  });
  const fromSource = analyzeFiles('io.component.ts', { 'io.component.ts': IO_SOURCE })
    .components[0];
  const fromDeclaration = analyzeDeclaration(IO_DECLARATION).components[0];

  it('reports every input as analyzing the source would', () => {
    expect(fromDeclaration.inputsClass.map(binding)).toEqual(fromSource.inputsClass.map(binding));
    expect(names(fromDeclaration.inputsClass)).toEqual([
      'amount',
      'checked',
      'expanded',
      'flag',
      'metaAlias',
      'needed',
      'plain',
      'publicName',
      'size',
      'total',
    ]);
  });

  it('types a transform input by what it accepts, from its generated `ngAcceptInputType_` static', () => {
    expect(byName(fromDeclaration.inputsClass, 'amount').type).toBe('string | number');
  });

  it('reports every output under its public name, a model() under its input name', () => {
    expect(names(fromDeclaration.outputsClass)).toEqual(names(fromSource.outputsClass));
    expect(names(fromDeclaration.outputsClass)).toEqual([
      'checked',
      'clicked',
      'dismissed',
      'expanded',
      'metaOut',
      'renamed',
      'toggled',
    ]);
    expect(byName(fromDeclaration.outputsClass, 'toggled').type).toBe('boolean');
  });

  it('leaves no input or output among the plain properties', () => {
    expect(fromDeclaration.propertiesClass).toEqual([]);
  });

  it('reads the string-valued input map Angular emitted before version 16', () => {
    const [component] = analyzeDeclaration(`
      import * as i0 from '@angular/core';

      export declare class ButtonComponent {
        label: string;
        static ɵcmp: i0.ɵɵComponentDeclaration<
          ButtonComponent, 'my-button', never, { "label": "text"; }, {}, never, never, true
        >;
      }
    `).components;

    expect(names(component.inputsClass)).toEqual(['text']);
  });
});

describe('a .d.ts class whose `ɵcmp` is not an Angular component declaration', () => {
  const expectLeftOut = (meta: ReturnType<typeof analyzeDeclaration>) => {
    expect(meta.components).toEqual([]);
    expect(meta.classes).toEqual([]);
  };

  it.each([
    ['a type that is not a declaration', 'static ɵcmp: unknown;'],
    ['no type arguments', 'static ɵcmp: i0.ɵɵComponentDeclaration;'],
    [
      'fewer type arguments than any Angular version emits',
      `static ɵcmp: i0.ɵɵComponentDeclaration<ButtonComponent, 'my-button'>;`,
    ],
    [
      'a declaration of another class',
      `static ɵcmp: i0.ɵɵComponentDeclaration<OtherComponent, 'my-button', never, {}, {}, never, never, true>;`,
    ],
    [
      'a directive declaration',
      `static ɵcmp: i0.ɵɵDirectiveDeclaration<ButtonComponent, 'my-button', never, {}, {}, never, never, true>;`,
    ],
    ['an instance member', `ɵcmp: i0.ɵɵComponentDeclaration<${MODERN_ARGUMENTS}>;`],
  ])('is left out when `ɵcmp` has %s', (_, member) => {
    expectLeftOut(analyzeDeclaration(declaringMember(member)));
  });

  it('does not mistake a locally declared `ɵɵComponentDeclaration` for Angular', () => {
    expectLeftOut(
      analyzeDeclaration(`
        type ɵɵComponentDeclaration<T, S, E, I, O, Q, N, IsStandalone> = unknown;

        export declare class ButtonComponent {
          static ɵcmp: ɵɵComponentDeclaration<${MODERN_ARGUMENTS}>;
        }
      `)
    );
  });

  it('does not mistake a same-named export of another module for Angular', () => {
    expectLeftOut(
      analyzeDeclaration(declaring(MODERN_ARGUMENTS).replace(`'@angular/core'`, `'./fake-core'`), {
        'fake-core.d.ts': `
          export type ɵɵComponentDeclaration<T, S, E, I, O, Q, N, IsStandalone> = unknown;
        `,
      })
    );
  });

  it('does not mistake a package whose name merely starts with `@angular/core` for Angular', () => {
    expectLeftOut(
      analyzeDeclaration(
        declaring(MODERN_ARGUMENTS).replace(
          `'@angular/core'`,
          `'./node_modules/@angular/core-extra/index'`
        ),
        {
          'node_modules/@angular/core-extra/index.d.ts': `
            export type ɵɵComponentDeclaration<T, S, E, I, O, Q, N, IsStandalone> = unknown;
          `,
        }
      )
    );
  });

  it('does not read a declaration type whose module does not resolve', () => {
    expectLeftOut(
      analyzeDeclaration(
        declaring(MODERN_ARGUMENTS).replace(`'@angular/core'`, `'@angular/not-installed'`)
      )
    );
  });

  it('reads `ɵcmp` from declaration files only, never from source', () => {
    const meta = analyzeInline(declaring(MODERN_ARGUMENTS).replace('export declare', 'export'));

    expect(meta.components).toEqual([]);
    expect(names(meta.classes)).toEqual(['ButtonComponent']);
  });
});
