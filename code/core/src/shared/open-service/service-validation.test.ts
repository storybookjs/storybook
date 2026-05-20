import { dedent } from 'ts-dedent';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildStaticFiles } from './static-build.ts';
import { clearRegistry, createService, getService } from './service-runtime.ts';
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
      code: 1001,
      message: expectedMessage,
    });
  }
);

afterEach(() => {
  clearRegistry();
});

describe('service validation', () => {
  it('shows the full actionable message for invalid query input', async () => {
    const service = getService(mutableRecordLookupServiceDef);

    await expectValidationMessage(
      () => service.queries.getRecordFields({} as unknown as { entryId: string }),
      dedent`
        Invalid input for query "test/mutable-record-lookup.getRecordFields":
        entryId: Invalid key: Expected "entryId" but received undefined
      `
    );
  });

  it('shows the full actionable message for invalid query output', async () => {
    const service = createService(createInvalidQueryOutputServiceDef());

    await expectValidationMessage(
      () => service.queries.getBrokenValue(undefined),
      dedent`
        Invalid output for query "test/invalid-query-output.getBrokenValue":
        Invalid type: Expected string but received 42
      `
    );
  });

  it('shows the full actionable message for invalid command input', async () => {
    const service = getService(mutableRecordLookupServiceDef);

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
    const service = createService(createInvalidCommandOutputServiceDef());

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

  it('accepts unexpected query input fields when the schema allows them', async () => {
    const service = getService(mutableRecordLookupServiceDef);

    await expect(
      service.queries.getRecordFields({
        entryId: 'entry-a',
        unexpected: 'extra',
      } as unknown as { entryId: string })
    ).resolves.toBeNull();
  });

  it('accepts unexpected command input fields when the schema allows them', async () => {
    const service = getService(mutableRecordLookupServiceDef);

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
