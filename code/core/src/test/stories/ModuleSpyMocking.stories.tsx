import React from 'react';

import { expect, mocked } from 'storybook/test';

import preview from '../../../../.storybook/preview';
import { fn } from './ModuleSpyMocking.utils';

const Component = () => {
  return (
    <div style={{ padding: '20px' }}>
      <p>
        This story demonstrates module mocking <strong>with spies</strong>. The imported util
        function is autospied, meaning that it is mocked automatically by Storybook, because the
        <br />
        <strong>.storybook/preview.js</strong> file contains a{' '}
        <strong>{`sb.mock(module, {spy: true})`}</strong> call for it.
      </p>
      <p>
        The play function verifies that the function is called by calling{' '}
        {`expect(mocked(fn)).toHaveBeenCalledWith();`}
      </p>
      <ul>
        <li>Function: {fn().join(', ')}</li>
      </ul>
    </div>
  );
};

const meta = preview.meta({
  title: 'ModuleSpyMocking',
  component: Component,
  parameters: {
    layout: 'fullscreen',
  },
  beforeEach() {
    mocked(fn).mockReset?.();
  },
});

export const Original = meta.story({
  play: async ({ canvas }) => {
    expect(mocked(fn)).toHaveBeenCalledWith();
    await expect(canvas.getByText('Function: original value')).toBeInTheDocument();
  },
});
