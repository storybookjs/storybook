import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { rscTransform } from './rsc-transform';

// Add a snapshot serializer that converts values to strings
expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? val : String(val)),
  test: () => true,
});

describe('rscTransform', () => {
  it('should skip client code', () => {
    expect(
      rscTransform(dedent`
        'use client';
        export const Foo = async () => <div>Hello</div>;
      `)
    ).toMatchInlineSnapshot(`
      'use client';
      export const Foo = async () => <div>Hello</div>;
    `);
  });

  it('should transform basic code', () => {
    expect(
      rscTransform(dedent`
        export const Foo = () => <div>Hello</div>;
      `)
    ).toMatchInlineSnapshot(`export const Foo = () => <div>Hello</div>;`);
  });

  it('should make async components sync', () => {
    expect(
      rscTransform(dedent`
        export const Foo = async () => <div>Hello</div>;
      `)
    ).toMatchInlineSnapshot(`export const Foo = () => <div>Hello</div>;`);
  });

  it('should transform async calls into use hooks', () => {
    expect(
      rscTransform(dedent`
        export const Foo = async () => {
          const data = await fetch('https://api.example.com/data');
          return <div>{data}</div>;
        };
      `)
    ).toMatchInlineSnapshot(`
      import React, { use } from 'react';
      import memoize from 'memoizee';

      const __memoized_promise_0 = memoize(() => fetch('https://api.example.com/data'), {
        primitive: true,
        max: 100,
      });

      export const Foo = () => {
        const data = React.use(__memoized_promise_0());
        return <div>{data}</div>;
      };
    `);
  });

  it('blah', () => {
    expect(
      rscTransform(dedent`
        import React from 'react';

        import 'server-only';

        export const RSC = async ({ label }: { label: string }) => <>RSC {label}</>;

        export const Nested = async ({ children }: any) => <>Nested {children}</>;

        export async function ServerComponentWithOneAwait() {
          const md1 = await getMockData(1);
          return <p>{md1}</p>;
        }

        export async function ServerComponentWithManyAwaits() {
          const md1 = await getMockData(1);
          const md2 = await getMockData(2);
          return (
            <p>
              {md1} + {md2}
            </p>
          );
        }

        export function getMockData(i: number): Promise<string> {
          return new Promise((resolve) => setTimeout(() => resolve('mock data' + i), 1000));
        }
      `)
    ).toMatchInlineSnapshot(`
      import memoize from 'memoizee';

      const __memoized_promise_2 = memoize(() => getMockData(2), {
        primitive: true,
        max: 100,
      });

      const __memoized_promise_1 = memoize(() => getMockData(1), {
        primitive: true,
        max: 100,
      });

      const __memoized_promise_0 = memoize(() => getMockData(1), {
        primitive: true,
        max: 100,
      });

      import React, { use } from 'react';

      import 'server-only';

      export const RSC = async ({ label }: { label: string }) => <>RSC {label}</>;

      export const Nested = async ({ children }: any) => <>Nested {children}</>;

      export function ServerComponentWithOneAwait() {
        const md1 = React.use(__memoized_promise_0());
        return <p>{md1}</p>;
      }

      export function ServerComponentWithManyAwaits() {
        const md1 = React.use(__memoized_promise_1());
        const md2 = React.use(__memoized_promise_2());
        return (
          <p>
            {md1} + {md2}
          </p>
        );
      }

      export function getMockData(i: number): Promise<string> {
        return new Promise((resolve) => setTimeout(() => resolve('mock data' + i), 1000));
      }
    `);
  });
});
