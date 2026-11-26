import type { Message } from 'esbuild';

import { describe, expect, it } from 'vitest';

import { NoMatchingExportError } from 'storybook/internal/server-errors';

import { buildOrThrow } from './build-or-throw.ts';

const noMatchingExportBuilderError = {
  id: '0',
  pluginName: '',
  text: 'No matching export in "global-externals:storybook/internal/components" for import "WithTooltip"',
  location: {
    file: 'node_modules/storybook-addon-mock-date/dist/manager.js',
    namespace: 'file',
    line: 25,
    column: 27,
    length: 11,
    lineText: 'import { WithTooltip } from "storybook/internal/components";',
    suggestion: '',
  },
  notes: [],
  detail: undefined,
} satisfies Message;

const secondNoMatchingExportBuilderError = {
  ...noMatchingExportBuilderError,
  id: '1',
  text: 'No matching export in "global-externals:storybook/internal/components" for import "AddonPanel"',
} satisfies Message;

describe('buildOrThrow', () => {
  it('throws a NoMatchingExportError including the matched builder error text and importing file', async () => {
    const builderError = {
      errors: [noMatchingExportBuilderError],
    };

    const thrown = await buildOrThrow(async () => {
      throw builderError;
    }).catch((err) => err);

    expect(thrown).toBeInstanceOf(NoMatchingExportError);
    // The original builder error stays reachable for programmatic consumers.
    expect(thrown.data.error).toBe(builderError);
    // The card must not claim which build (manager or preview) failed: in dev the wrapper
    // spans both, so the lead wording stays build-neutral.
    expect(thrown.message).toContain("while building Storybook's UI");
    expect(thrown.message).not.toContain('manager UI');
    expect(thrown.message).toMatchInlineSnapshot(`
      "An import in your Storybook setup could not be resolved while building Storybook's UI.

      No matching export in "global-externals:storybook/internal/components" for import "WithTooltip"
      imported from node_modules/storybook-addon-mock-date/dist/manager.js

      This usually happens because the installed Storybook core package versions don't match, or an addon you're using is built for an older Storybook version. Run \`npx storybook doctor\` to identify version discrepancies.

      More info: 
      "
    `);
  });

  it('lists every matched "No matching export" error in one card', async () => {
    const builderError = {
      errors: [noMatchingExportBuilderError, secondNoMatchingExportBuilderError],
    };

    const thrown = await buildOrThrow(async () => {
      throw builderError;
    }).catch((err) => err);

    expect(thrown).toBeInstanceOf(NoMatchingExportError);
    expect(thrown.message).toContain('for import "WithTooltip"');
    expect(thrown.message).toContain('for import "AddonPanel"');
  });

  it('rethrows errors without a "No matching export" builder error unchanged', async () => {
    const builderError = {
      errors: [{ id: '0', pluginName: '', text: 'Some other builder failure', notes: [] }],
      unrelated: true,
    };

    const thrown = await buildOrThrow(async () => {
      throw builderError;
    }).catch((err) => err);

    expect(thrown).toBe(builderError);
    expect(thrown).not.toBeInstanceOf(NoMatchingExportError);
  });

  it('rethrows non-esbuild errors carrying an errors array unchanged (e.g. AggregateError)', async () => {
    // buildOrThrow wraps the whole dev server and static build, not only esbuild: Node's
    // AggregateError (connection failures etc.) carries an `errors` array of plain Errors with
    // no string `text`, and must reach the user as-is rather than crash inside the catch.
    const aggregateError = new AggregateError(
      [new Error('connect ECONNREFUSED ::1:6006')],
      'connect failed'
    );

    const thrown = await buildOrThrow(async () => {
      throw aggregateError;
    }).catch((err) => err);

    expect(thrown).toBe(aggregateError);
    expect(thrown).not.toBeInstanceOf(NoMatchingExportError);
  });

  it('rethrows unchanged when the errors array holds Error objects without string text', async () => {
    const builderError = { errors: [new Error('x')] };

    const thrown = await buildOrThrow(async () => {
      throw builderError;
    }).catch((err) => err);

    expect(thrown).toBe(builderError);
    expect(thrown).not.toBeInstanceOf(NoMatchingExportError);
  });

  it('omits the imported-from line when the builder error carries no location', async () => {
    const builderError = {
      errors: [{ ...noMatchingExportBuilderError, location: null } satisfies Message],
    };

    const thrown = await buildOrThrow(async () => {
      throw builderError;
    }).catch((err) => err);

    expect(thrown).toBeInstanceOf(NoMatchingExportError);
    expect(thrown.message).toContain(noMatchingExportBuilderError.text);
    expect(thrown.message).not.toContain('imported from');
  });
});
