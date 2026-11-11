import { describe, expect, it } from 'vitest';

import { angularProjectFiles } from './angular.ts';

/**
 * These snapshots are the generator's documentation. Compodoc reads a directory, not an API, so
 * what matters is the shape of the tree and how a component reaches the decorators it is annotated
 * with - neither of which is visible from the generator's source without running it.
 *
 * The project is asserted as data rather than generated to disk, so nothing here writes a file.
 */
const tree = (files: Record<string, string>) => Object.keys(files).join('\n');

describe('angularProjectFiles', () => {
  it('lays out a project compodoc can be pointed at', () => {
    expect(tree(angularProjectFiles({ components: 3, props: 1 }).files)).toMatchInlineSnapshot(`
      "node_modules/@angular/core/package.json
      node_modules/@angular/core/index.d.ts
      tsconfig.json
      src/app/comp0.component.ts
      src/app/comp1.component.ts
      src/app/comp2.component.ts"
    `);
  });

  it('ships a fake @angular/core so the tree needs no framework install', () => {
    // Compodoc only has to resolve the decorators; it never executes them. `types` points at the
    // .d.ts because that is all a static extractor reads.
    const { files } = angularProjectFiles({ components: 1, props: 0 });
    expect(files['node_modules/@angular/core/package.json']).toMatchInlineSnapshot(`
      "{
        "name": "@angular/core",
        "version": "0.0.0-bench",
        "types": "index.d.ts"
      }"
    `);
    expect(files['node_modules/@angular/core/index.d.ts']).toMatchInlineSnapshot(`
      "export declare function Component(metadata: {
        selector?: string;
        template?: string;
        standalone?: boolean;
      }): ClassDecorator;
      export declare function Input(bindingPropertyName?: string): PropertyDecorator;
      export declare function Output(bindingPropertyName?: string): PropertyDecorator;
      export declare class EventEmitter<T> {
        emit(value?: T): void;
        subscribe(next: (value: T) => void): { unsubscribe(): void };
      }
      "
    `);
  });

  it('points tsconfig at the components and nothing else', () => {
    // `include` is what decides the measured set: compodoc documents what the program contains.
    expect(angularProjectFiles({ components: 1, props: 0 }).files['tsconfig.json'])
      .toMatchInlineSnapshot(`
        "{
          "compilerOptions": {
            "target": "ES2020",
            "module": "ESNext",
            "moduleResolution": "Bundler",
            "strict": true,
            "skipLibCheck": true,
            "experimentalDecorators": true,
            "emitDecoratorMetadata": false
          },
          "include": [
            "src/**/*.ts"
          ]
        }"
      `);
  });

  it('gives every component the same baseline members', () => {
    // The four baseline inputs and one output are fixed, so `props` is the only size lever and two
    // runs at the same props always document the same members.
    expect(angularProjectFiles({ components: 2, props: 0 }).files['src/app/comp0.component.ts'])
      .toMatchInlineSnapshot(`
        "import { Component, EventEmitter, Input, Output } from '@angular/core';

        /**
         * Comp0 - generated bench component.
         */
        @Component({
          selector: 'bench-comp0',
          template: '<div>{{ label }}</div>',
        })
        export class Comp0Component {
          /** Primary label shown to the user. */
          @Input() label = '';
          /** Numeric size token. */
          @Input() size?: number;
          /** Visual variant. */
          @Input() variant?: 'primary' | 'secondary' | 'tertiary';
          /** Disable interaction. */
          @Input() disabled = false;
          /** Emits when the user acts on the component. */
          @Output() action = new EventEmitter<{ id: string; value: number }>();
        }
        "
      `);
  });

  it('grows a component by one input per extra prop, cycling the type', () => {
    // The cycling matters: a union, a number and a string exercise different compodoc paths, and an
    // all-string surface would not show whether it resolves a union.
    expect(angularProjectFiles({ components: 1, props: 4 }).files['src/app/comp0.component.ts'])
      .toMatchInlineSnapshot(`
        "import { Component, EventEmitter, Input, Output } from '@angular/core';

        /**
         * Comp0 - generated bench component.
         */
        @Component({
          selector: 'bench-comp0',
          template: '<div>{{ label }}</div>',
        })
        export class Comp0Component {
          /** Primary label shown to the user. */
          @Input() label = '';
          /** Numeric size token. */
          @Input() size?: number;
          /** Visual variant. */
          @Input() variant?: 'primary' | 'secondary' | 'tertiary';
          /** Disable interaction. */
          @Input() disabled = false;
          /** Extra input 0 for component 0. */
          @Input() extra0?: 'a' | 'b' | 'c';
          /** Extra input 1 for component 0. */
          @Input() extra1?: number;
          /** Extra input 2 for component 0. */
          @Input() extra2?: string;
          /** Extra input 3 for component 0. */
          @Input() extra3?: 'a' | 'b' | 'c';
          /** Emits when the user acts on the component. */
          @Output() action = new EventEmitter<{ id: string; value: number }>();
        }
        "
      `);
  });

  it('names every component file after its index, in order', () => {
    expect(angularProjectFiles({ components: 4, props: 0 }).componentPaths).toMatchInlineSnapshot(`
      [
        "src/app/comp0.component.ts",
        "src/app/comp1.component.ts",
        "src/app/comp2.component.ts",
        "src/app/comp3.component.ts",
      ]
    `);
  });
});
