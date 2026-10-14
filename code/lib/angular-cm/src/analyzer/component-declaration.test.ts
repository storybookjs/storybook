import { describe, expect, it } from 'vitest';

import { analyzeFiles, analyzeInline, names } from './__testutils__/inline-source.ts';

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

describe('a .d.ts class whose `ɵcmp` is not an Angular component declaration', () => {
  const expectPlainClass = (meta: ReturnType<typeof analyzeDeclaration>) => {
    expect(meta.components).toEqual([]);
    expect(names(meta.classes)).toContain('ButtonComponent');
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
  ])('stays a plain class when `ɵcmp` has %s', (_, member) => {
    expectPlainClass(analyzeDeclaration(declaringMember(member)));
  });

  it('does not mistake a locally declared `ɵɵComponentDeclaration` for Angular', () => {
    expectPlainClass(
      analyzeDeclaration(`
        type ɵɵComponentDeclaration<T, S, E, I, O, Q, N, IsStandalone> = unknown;

        export declare class ButtonComponent {
          static ɵcmp: ɵɵComponentDeclaration<${MODERN_ARGUMENTS}>;
        }
      `)
    );
  });

  it('does not mistake a same-named export of another module for Angular', () => {
    expectPlainClass(
      analyzeDeclaration(declaring(MODERN_ARGUMENTS).replace(`'@angular/core'`, `'./fake-core'`), {
        'fake-core.d.ts': `
          export type ɵɵComponentDeclaration<T, S, E, I, O, Q, N, IsStandalone> = unknown;
        `,
      })
    );
  });

  it('does not mistake a package whose name merely starts with `@angular/core` for Angular', () => {
    expectPlainClass(
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
    expectPlainClass(
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
