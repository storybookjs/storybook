import React, { useState } from 'react';

import { expect, mocked } from 'storybook/test';

import preview from '../../../../.storybook/preview';
import { fn } from './ModuleMocking.utils';
import * as utils from './ModuleMocking.utils';

const Component = () => {
  const [state, setState] = useState(utils.fn().join(', '));
  return (
    <div>
      <button onClick={() => setState(utils.fn().join(', '))}>Update State</button>
      <ul>
        <li>Function: {state}</li>
      </ul>
    </div>
  );
};

const meta = preview.meta({
  title: 'ModuleMocking',
  component: Component,
  parameters: {
    layout: 'fullscreen',
  },
  beforeEach() {
    mocked(utils.fn).mockReset();
  },
});

export const Original = meta.story({
  play: async () => {
    expect(mocked(fn)).toHaveBeenCalledWith();
  },
});

export const Mocked = meta.story({
  beforeEach() {
    mocked(fn).mockReturnValue(['mocked value']);
  },
});

export const SecondMocked = meta.story({
  beforeEach() {
    mocked(fn).mockReturnValue(['second mocked value']);
  },
});

export const MockInPlay = meta.story({
  play: async ({ canvasElement, userEvent }) => {
    expect(canvasElement).toHaveTextContent('Function: original value');
    await userEvent.click(canvasElement.querySelector('button')!);
    expect(canvasElement).toHaveTextContent('Function: original value');
    mocked(fn).mockReturnValue(['mocked value']);
    await userEvent.click(canvasElement.querySelector('button')!);
    expect(canvasElement).toHaveTextContent('Function: mocked value');
  },
});
