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
 * `vi.defineHelper()` keeps failure stacks anchored at the individual test callsite.
 */
const expectValidationMessage = vi.defineHelper(
  async (run: () => Promise<unknown>, expectedMessage: string): Promise<void> => {
    await expect(run()).rejects.toMatchObject({
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
        Invalid input for query "test/mutable-record-lookup.getRecordFields":
        entryId: Invalid key: Expected "entryId" but received undefined
      `
    );
  });

  it('shows the full actionable message for invalid query output', async () => {
    const service = registerService(createInvalidQueryOutputServiceDef());

    await expectValidationMessage(
      () => service.queries.getBrokenValue(undefined),
      dedent`
        Invalid output for query "test/invalid-query-output.getBrokenValue":
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
        Invalid input for command "test/mutable-record-lookup.assignRecordField":
        fieldValue: Invalid type: Expected string but received 1
      `
    );
  });

  it('shows the full actionable message for invalid command output', async () => {
    const service = registerService(createInvalidCommandOutputServiceDef());

    await expectValidationMessage(
      () => service.commands.runBrokenCommand(undefined),
      dedent`
        Invalid output for command "test/invalid-command-output.runBrokenCommand":
        Invalid type: Expected string but received 42
      `
    );
  });

  it('shows the full actionable message for invalid static preload input', async () => {
    await expectValidationMessage(
      () => buildStaticFiles([createInvalidStaticInputServiceDef()]),
      dedent`
        Invalid input for query "test/invalid-static-input.getPreloadedValue":
        entryId: Invalid key: Expected "entryId" but received undefined
      `
    );
  });

  it('shows nested field paths for validation issues inside arrays and objects', async () => {
    const service = registerService(
      defineService({
        id: 'test/nested-query-output',
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
        Invalid output for query "test/nested-query-output.getBrokenTree":
        items[0].name: Invalid type: Expected string but received 1
      `
    );
  });

  it('wraps zod schema issues in the same actionable validation error shape', async () => {
    const service = registerService(
      defineService({
        id: 'test/zod-query-input',
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
        Invalid input for query "test/zod-query-input.getGreeting":
        name: Name must be at least 2 characters
      `
    );
  });

  it('accepts unexpected query input fields when the schema allows them', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    await expect(
      service.queries.getRecordFields({
        entryId: 'entry-a',
        unexpected: 'extra',
      } as unknown as { entryId: string })
    ).resolves.toBeNull();
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

    await expect(service.queries.getRecordFields({ entryId: 'entry-a' })).resolves.toEqual({
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
