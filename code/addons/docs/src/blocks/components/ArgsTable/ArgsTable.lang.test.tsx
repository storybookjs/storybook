// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import React from 'react';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import * as ArgRow from './ArgRow.stories';
import { ArgsTable } from './ArgsTable';

const renderTable = () =>
  render(
    <ThemeProvider theme={convert(themes.light)}>
      {/* Wrap in a non-en region to prove chrome re-asserts English */}
      <div lang="de">
        <ArgsTable rows={{ stringType: ArgRow.String.args.row }} />
      </div>
    </ThemeProvider>
  );

describe('ArgsTable chrome stays English', () => {
  afterEach(() => cleanup());

  it('keeps the header row in English', () => {
    const { container } = renderTable();
    expect(container.querySelector('.docblock-argstable-head')?.getAttribute('lang')).toBe('en');
  });

  it('keeps the arg-name cell in English', () => {
    const { container } = renderTable();
    const nameCell = container.querySelector('tbody tr td:first-of-type');
    expect(nameCell?.getAttribute('lang')).toBe('en');
  });
});
