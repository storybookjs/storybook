import React from 'react';

import preview from '../../../../.storybook/preview';
import { fn } from './ModuleAutoMocking.utils';

const Component = () => {
  return (
    <div style={{ padding: '20px' }}>
      <p>
        This story demonstrates module mocking. The imported util function is automocked, because a{' '}
        <strong>{`__mocks__/ModuleAutoMocking.utils.ts`}</strong> file exists.
      </p>
      <ul>
        <li>Function: {fn().join(', ')}</li>
      </ul>
    </div>
  );
};

const meta = preview.meta({
  title: 'ModuleAutoMocking',
  component: Component,
  parameters: {
    layout: 'fullscreen',
  },
});

export const Original = meta.story({});
