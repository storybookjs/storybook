import { describe, expect, it } from 'vitest';

import type { CompodocJson } from './compodoc-types.ts';
import { extractArgTypesFromData } from './extract-arg-types.ts';

const logger = { warn: () => {}, debug: () => {} };

const componentWith = (type: string) =>
  ({
    name: 'StatusComponent',
    type: 'component',
    inputsClass: [{ name: 'status', type, optional: false }],
    outputsClass: [],
    propertiesClass: [],
    methodsClass: [],
  }) as never;

const jsonWith = (miscellaneous: CompodocJson['miscellaneous']): CompodocJson =>
  ({
    components: [],
    directives: [],
    pipes: [],
    injectables: [],
    classes: [],
    miscellaneous,
  }) as CompodocJson;

const extract = (type: string, miscellaneous: CompodocJson['miscellaneous']) => {
  const compodocJson = jsonWith(miscellaneous);
  return extractArgTypesFromData(componentWith(type), {
    compodocJson,
    filterNonInputControls: false,
    logger,
    // These cases are about type resolution, not HTML; the host supplies the real unwrapper.
    unwrapHtml: (html: unknown) => String(html),
  });
};

describe('extractArgTypesFromData', () => {
  it('does not recurse forever on a cyclic type alias', () => {
    expect(() =>
      extract('Alpha', {
        typealiases: [
          { name: 'Alpha', rawtype: 'Beta' },
          { name: 'Beta', rawtype: 'Alpha' },
        ] as never,
      })
    ).not.toThrow();
  });

  it('still resolves a non-cyclic alias chain to its underlying enum', () => {
    const argTypes = extract('Alias', {
      typealiases: [
        { name: 'Alias', rawtype: 'Inner' },
        { name: 'Inner', rawtype: 'Status' },
      ] as never,
      enumerations: [
        {
          name: 'Status',
          childs: [
            { name: 'On', value: 'on' },
            { name: 'Off', value: 'off' },
          ],
        },
      ] as never,
    });

    expect(argTypes.status.type).toEqual({ name: 'enum', value: ['on', 'off'] });
  });

  it('does not throw for an enumeration entry with no `childs`', () => {
    expect(() => extract('Status', { enumerations: [{ name: 'Status' }] as never })).not.toThrow();
  });
});
