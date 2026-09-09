import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';

import { dedent } from 'ts-dedent';

import { loadCsf, printCsf } from './CsfFile.ts';

const parse = (source: string) =>
  loadCsf(source, { makeTitle: (title) => title ?? 'title' }).parse();

describe('CsfObject values', () => {
  it('sets primitive values', () => {
    const csf = parse(`export default {};`);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.set(['title'], 'Example')).toEqual({ ok: true, changed: true });
    expect(meta.set(['parameters', 'count'], 2)).toEqual({ ok: true, changed: true });
    expect(meta.set(['parameters', 'enabled'], true)).toEqual({ ok: true, changed: true });

    expect(printCsf(csf).code).toBe(dedent`
      export default {
        title: "Example",

        parameters: {
          count: 2,
          enabled: true
        }
      };
    `);
  });

  it('preserves comments on source nodes returned by a transform callback', () => {
    const csf = parse(dedent`
      export default {
        parameters: {
          backgrounds: {
            values: [
              // Keep the original color description.
              { name: 'Gray', value: '#CCC' },
            ],
          },
        },
      };
    `);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(
      meta.transform(['parameters', 'backgrounds', 'values'], (value) => {
        if (!t.isArrayExpression(value)) {
          return undefined;
        }
        const [gray] = value.elements;
        return t.isObjectExpression(gray)
          ? t.objectExpression([t.objectProperty(t.identifier('gray'), gray)])
          : undefined;
      })
    ).toEqual({ ok: true, changed: true });

    expect(printCsf(csf).code).toBe(dedent`
      export default {
        parameters: {
          backgrounds: {
            values: {
              gray: // Keep the original color description.
              { name: 'Gray', value: '#CCC' }
            },
          },
        },
      };
    `);
  });

  it('keeps a transformed field when the callback returns undefined', () => {
    const source = `export default { title: 'Example' };`;
    const csf = parse(source);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.transform(['title'], () => undefined)).toEqual({ ok: true, changed: false });
    expect(printCsf(csf).code).toBe(source);
  });
});
