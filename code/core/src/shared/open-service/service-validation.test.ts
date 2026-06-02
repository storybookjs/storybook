import * as v from 'valibot';
import { dedent } from 'ts-dedent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defineService } from './service-definition.ts';
import { clearRegistry, registerService } from './server.ts';
import { buildStaticFiles } from './server.ts';
import {
  createInvalidCommandOutputServiceDef,
  createInvalidQueryOutputServiceDef,
  createInvalidStaticInputServiceDef,
  mutableRecordLookupServiceDef,
} from './fixtures.ts';

/**
 * Asserts the exact validation text we document for callers.
 *
 * `vi.defineHelper()` keeps failure stacks anchored at the individual test callsite. The helper
 * accepts both sync and async producers so it can target sync queries and async commands with the
 * same assertion shape.
 */
const expectValidationMessage = vi.defineHelper(
  async (run: () => unknown, expectedMessage: string): Promise<void> => {
    await expect(async () => {
      const result = run();
      if (result instanceof Promise) {
        await result;
      }
    }).rejects.toMatchObject({
      fromStorybook: true,
      code: 5,
      message: expectedMessage,
    });
  }
);

afterEach(() => {
  clearRegistry();
});

describe('service validation', () => {
  it('shows the full actionable message for invalid query input', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    await expectValidationMessage(
      () => service.queries.getRecordFields({} as unknown as { entryId: string }),
      dedent`
        Invalid input for query "internal-fixture/mutable-record-lookup.getRecordFields":
        entryId: Invalid key: Expected "entryId" but received undefined
      `
    );
  });

  it('shows the full actionable message for invalid query output', async () => {
    const service = registerService(createInvalidQueryOutputServiceDef());

    await expectValidationMessage(
      () => service.queries.getBrokenValue(undefined),
      dedent`
        Invalid output for query "internal-fixture/invalid-query-output.getBrokenValue":
        Invalid type: Expected string but received 42
      `
    );
  });

  it('shows the full actionable message for invalid command input', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    await expectValidationMessage(
      () =>
        service.commands.assignRecordField({
          entryId: 'entry-a',
          fieldKey: 'marker',
          fieldValue: 1,
        } as unknown as {
          entryId: string;
          fieldKey: string;
          fieldValue: string;
        }),
      dedent`
        Invalid input for command "internal-fixture/mutable-record-lookup.assignRecordField":
        fieldValue: Invalid type: Expected string but received 1
      `
    );
  });

  it('shows the full actionable message for invalid command output', async () => {
    const service = registerService(createInvalidCommandOutputServiceDef());

    await expectValidationMessage(
      () => service.commands.runBrokenCommand(undefined),
      dedent`
        Invalid output for command "internal-fixture/invalid-command-output.runBrokenCommand":
        Invalid type: Expected string but received 42
      `
    );
  });

  it('shows the full actionable message for invalid static load input', async () => {
    registerService(createInvalidStaticInputServiceDef());

    await expectValidationMessage(
      () => buildStaticFiles(),
      dedent`
        Invalid input for query "internal-fixture/invalid-static-input.getPreloadedValue":
        entryId: Invalid key: Expected "entryId" but received undefined
      `
    );
  });

  it('shows nested field paths for validation issues inside arrays and objects', async () => {
    const service = registerService(
      defineService({
        id: 'internal-fixture/nested-query-output',
        initialState: {} as Record<string, never>,
        queries: {
          getBrokenTree: {
            input: v.undefined(),
            output: v.object({
              items: v.array(
                v.object({
                  name: v.string(),
                })
              ),
            }),
            handler: () => ({
              items: [{ name: 1 as unknown as string }] as Array<{ name: string }>,
            }),
          },
        },
        commands: {},
      })
    );

    await expectValidationMessage(
      () => service.queries.getBrokenTree(undefined),
      dedent`
        Invalid output for query "internal-fixture/nested-query-output.getBrokenTree":
        items[0].name: Invalid type: Expected string but received 1
      `
    );
  });

  it('wraps zod schema issues in the same actionable validation error shape', async () => {
    const service = registerService(
      defineService({
        id: 'internal-fixture/zod-query-input',
        initialState: {} as Record<string, never>,
        queries: {
          getGreeting: {
            input: z.object({
              name: z.string().min(2, 'Name must be at least 2 characters'),
            }),
            output: z.string(),
            handler: ({ name }) => `Hello ${name}`,
          },
        },
        commands: {},
      })
    );

    await expectValidationMessage(
      () => service.queries.getGreeting({ name: 'x' }),
      dedent`
        Invalid input for query "internal-fixture/zod-query-input.getGreeting":
        name: Name must be at least 2 characters
      `
    );
  });

  it('accepts unexpected query input fields when the schema allows them', () => {
    const service = registerService(mutableRecordLookupServiceDef);

    expect(
      service.queries.getRecordFields({
        entryId: 'entry-a',
        unexpected: 'extra',
      } as unknown as { entryId: string })
    ).toBeNull();
  });

  it('accepts unexpected command input fields when the schema allows them', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    await expect(
      service.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'match',
        unexpected: 'extra',
      } as unknown as {
        entryId: string;
        fieldKey: string;
        fieldValue: string;
      })
    ).resolves.toBeUndefined();

    expect(service.queries.getRecordFields({ entryId: 'entry-a' })).toEqual({
      marker: 'match',
    });
  });

  it('stores optional description metadata on services, queries, and commands', () => {
    expect(mutableRecordLookupServiceDef.description).toBe(
      'Provides a mutable record lookup keyed by entry id.'
    );
    expect(mutableRecordLookupServiceDef.queries.getRecordFields.description).toBe(
      'Returns all stored fields for one entry, or null when absent.'
    );
    expect(mutableRecordLookupServiceDef.commands.assignRecordField.description).toBe(
      'Writes one field value onto the selected entry.'
    );
  });
});
