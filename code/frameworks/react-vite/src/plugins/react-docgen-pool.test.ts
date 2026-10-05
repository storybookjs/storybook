import { afterAll, describe, expect, it } from 'vitest';

import { ReactDocgenPool } from './react-docgen-pool.ts';
import { transformWithReactDocgen } from './react-docgen-transform.ts';

const id = '/project/src/Button.tsx';
const component = `
import React from 'react';

export interface ButtonProps {
  /** Text inside the button */
  label: string;
  primary?: boolean;
}

/** A button */
export const Button = ({ label, primary = false }: ButtonProps) => (
  <button className={primary ? 'primary' : undefined}>{label}</button>
);
`;

describe('ReactDocgenPool', () => {
  const pool = new ReactDocgenPool(2);
  afterAll(() => pool.close());

  it('produces the same transform as parsing on the main thread', async () => {
    const result = await pool.transform(component, id, undefined);

    expect(result?.code).toContain(';Button.__docgenInfo=');
    expect(result).toEqual(transformWithReactDocgen(component, id, undefined));
  });

  it('skips modules without components', async () => {
    await expect(pool.transform('export const answer = 42;', id, undefined)).resolves.toBe(
      undefined
    );
  });

  it('rejects with the parse error of an invalid module', async () => {
    const inline = (() => {
      try {
        transformWithReactDocgen('export const = ;', id, undefined);
      } catch (error) {
        return error as Error;
      }
    })();

    await expect(pool.transform('export const = ;', id, undefined)).rejects.toMatchObject({
      name: inline?.name,
      message: inline?.message,
      code: (inline as { code?: string } | undefined)?.code,
    });
  });

  it('handles concurrent transforms across workers', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        pool.transform(component.replaceAll('Button', `Button${index}`), id, undefined)
      )
    );

    results.forEach((result, index) => {
      expect(result?.code).toContain(`;Button${index}.__docgenInfo=`);
    });
  });
});
