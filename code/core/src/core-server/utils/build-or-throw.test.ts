import { describe, expect, it } from 'vitest';

import { NoMatchingExportError } from 'storybook/internal/server-errors';

import { buildOrThrow, formatNoMatchingExportDetail } from './build-or-throw.ts';

const noMatchingExportBuilderError = {
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
};

describe('buildOrThrow', () => {
  it('throws a NoMatchingExportError including the matched builder error text and importing file', async () => {
    const builderError = {
      errors: [noMatchingExportBuilderError],
    };

    const thrown = await buildOrThrow(async () => {
      throw builderError;
    }).catch((err) => err);

    expect(thrown).toBeInstanceOf(NoMatchingExportError);
    expect(thrown.message).toContain(
      'No matching export in "global-externals:storybook/internal/components" for import "WithTooltip"'
    );
    expect(thrown.message).toContain(
      'imported from node_modules/storybook-addon-mock-date/dist/manager.js'
    );
  });

  it('rethrows errors without a "No matching export" builder error unchanged', async () => {
    const builderError = {
      errors: [{ text: 'Some other builder failure' }],
      unrelated: true,
    };

    const thrown = await buildOrThrow(async () => {
      throw builderError;
    }).catch((err) => err);

    expect(thrown).toBe(builderError);
    expect(thrown).not.toBeInstanceOf(NoMatchingExportError);
  });

  it('omits the imported-from line when the builder error carries no location', async () => {
    const builderError = {
      errors: [{ text: noMatchingExportBuilderError.text }],
    };

    const thrown = await buildOrThrow(async () => {
      throw builderError;
    }).catch((err) => err);

    expect(thrown).toBeInstanceOf(NoMatchingExportError);
    expect(thrown.message).toContain(noMatchingExportBuilderError.text);
    expect(thrown.message).not.toContain('imported from');
  });
});

describe('formatNoMatchingExportDetail', () => {
  it('appends the importing file from the esbuild location', () => {
    expect(formatNoMatchingExportDetail(noMatchingExportBuilderError)).toBe(
      'No matching export in "global-externals:storybook/internal/components" for import "WithTooltip"\nimported from node_modules/storybook-addon-mock-date/dist/manager.js'
    );
  });

  it('returns only the text when no location is present', () => {
    expect(formatNoMatchingExportDetail({ text: noMatchingExportBuilderError.text })).toBe(
      noMatchingExportBuilderError.text
    );
  });
});
