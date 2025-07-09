import React from 'react';

// eslint-disable-next-line depend/ban-dependencies
import lodash from 'lodash-es';
// eslint-disable-next-line depend/ban-dependencies
import add from 'lodash-es/add';
// eslint-disable-next-line depend/ban-dependencies
import sum from 'lodash-es/sum';
import { mocked } from 'storybook/test';

import preview from '../../../../.storybook/preview';

const Component = () => {
  return (
    <div style={{ padding: '20px' }}>
      <p>This story is used to test the node module mocking.</p>
      <ul>
        <li>
          <strong>lodash</strong> is mocked, because <strong>{`sb.mock('lodash')`}</strong> is
          called in the <strong>.storybook/preview.js</strong> and the <strong>`__mocks__`</strong>{' '}
          directory contains a <strong>`lodash.js`</strong> file.
        </li>
        <li>
          <strong>lodash/add</strong> is mocked, because <strong>{`sb.mock('lodash/add')`}</strong>{' '}
          is called in the <strong>.storybook/preview.js</strong> and the{' '}
          <strong>`__mocks__`</strong> directory contains a <strong>`lodash/add.js`</strong> file.
        </li>
        <li>
          <strong>lodash/sum</strong> is automocked, because{' '}
          <strong>{`sb.mock('lodash/sum')`}</strong> is called in the{' '}
          <strong>.storybook/preview.js</strong> and the <strong>`__mocks__`</strong> does{' '}
          <strong>not</strong> contain a <strong>`lodash/sum.js`</strong> file. Mocking has to
          happen at runtime.
        </li>
      </ul>

      <p>Lodash Version: {lodash.VERSION}</p>
      <p>Mocked Add (1,2): {add(1, 2)}</p>
      <p>Inline Sum (2,2): {sum([2, 2])}</p>
    </div>
  );
};

const meta = preview.meta({
  title: 'NodeModuleMocking',
  component: Component,
  parameters: {
    layout: 'fullscreen',
  },
  beforeEach: () => {
    mocked(sum).mockImplementation(() => {
      return 'mocked 10' as any;
    });
  },
});

export const Original = meta.story({});
