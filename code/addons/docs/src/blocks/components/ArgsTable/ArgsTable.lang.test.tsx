// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import React from 'react';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import * as ArgRow from './ArgRow.stories';
import { ArgsTable } from './ArgsTable';

const renderTable = (docsLang?: string) =>
  render(
    <ThemeProvider theme={convert(themes.light)}>
      {/* Wrap in a non-en region to prove chrome re-asserts English */}
      <div lang="de">
        <ArgsTable rows={{ stringType: ArgRow.String.args.row }} docsLang={docsLang} />
      </div>
    </ThemeProvider>
  );

describe('ArgsTable chrome stays English', () => {
  afterEach(() => cleanup());

  it('declares English on the table so the chrome stays English under a non-en region', () => {
    const { container } = renderTable();
    expect(container.querySelector('.docblock-argstable')?.getAttribute('lang')).toBe('en');
  });

  it('keeps the arg-name cell announced in English', () => {
    const { container } = renderTable();
    const nameCell = container.querySelector('tbody tr td:first-of-type');
    // The cell inherits English from the table wrapper rather than declaring its own lang.
    expect(nameCell?.closest('[lang]')?.getAttribute('lang')).toBe('en');
  });

  it('languages argument descriptions with docs.lang', () => {
    const { container } = renderTable('de');
    const description = container.querySelector('tbody tr td:nth-of-type(2) > div');
    expect(description?.getAttribute('lang')).toBe('de');
  });
});
