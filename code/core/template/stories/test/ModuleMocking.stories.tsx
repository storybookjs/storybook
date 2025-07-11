import React, { useState } from 'react';

import { expect, mocked } from 'storybook/test';

import { fn } from './ModuleMocking.utils';

const Component = () => {
  const [state, setState] = useState((fn() ?? []).join(', '));
  return (
    <div style={{ padding: '20px' }}>
      <p>
        This story demonstrates auto module mocking. The imported util function is mocked in the
        <br />
        <strong>.storybook/preview.js</strong> file via <strong>{`sb.mock(module)`}</strong> but a
        mock is <strong>not</strong> provided via{' '}
        <strong>{`__mocks__/ModuleMocking.utils.ts`}</strong>, meaning that the implementation of
        the mock has to happen at runtime.
        <br />
        The play function verifies that the function is called by calling{' '}
        <strong>{`expect(mocked(fn)).toHaveBeenCalledWith();`}</strong> and the mocked value is set
        to <strong>mocked value</strong>.
        <br />
        These stories should also show that the mock can be dynamically changed in the play
        function.
      </p>
      <button onClick={() => setState((fn() ?? []).join(', '))}>Update State</button>
      <ul>
        <li>Function: {state === '' ? 'no value' : state}</li>
      </ul>
    </div>
  );
};

export default {
  component: Component,
  parameters: {
    layout: 'fullscreen',
  },
  beforeEach() {
    mocked(fn).mockReset();
  },
};

export const Original = {
  play: async ({ canvas }: any) => {
    await expect(mocked(fn)).toHaveBeenCalledWith();
    await expect(canvas.getByText('Function: no value')).toBeInTheDocument();
  },
};

export const Mocked = {
  beforeEach() {
    mocked(fn).mockReturnValue(['mocked value']);
  },
  play: async ({ canvas }: any) => {
    await expect(canvas.getByText('Function: mocked value')).toBeInTheDocument();
  },
};

export const MockInPlay = {
  play: async ({ canvasElement, userEvent }: any) => {
    expect(canvasElement).toHaveTextContent('Function:');
    await userEvent.click(canvasElement.querySelector('button')!);
    expect(canvasElement).toHaveTextContent('Function:');
    mocked(fn).mockReturnValue(['mocked value']);
    await userEvent.click(canvasElement.querySelector('button')!);
    expect(canvasElement).toHaveTextContent('Function: mocked value');
  },
};
