import { global as globalThis } from '@storybook/global';

import { withActions } from 'storybook/actions/decorator';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  args: {
    label: 'Click Me!',
  },
  parameters: {
    chromatic: { disable: true },
  },
};

export const Basic = {
  parameters: {
    actions: {
      handles: [{ click: 'clicked', contextmenu: 'right clicked' }],
    },
  },
  decorators: [withActions],
};

export const WithAllConsoleMethods = {
  // we throw errors when console.error is called, so we disable Vitest for this story
  tags: ['!vitest'],
  args: {
    label: "See console output in the actions panel and in the browser's console",
  },
  parameters: {
    actions: {
      console: true,
    },
  },
  play: async () => {
    console.clear();

    console.debug('This is a debug message');
    console.info('This is an info message');
    console.log('This is a log message', { some: 'data' });
    console.warn('This is a warning message');
    console.error('This is an error message');

    console.trace('This is a trace message');

    console.group('This is a group');
    console.log('Inside group');
    console.groupCollapsed('This is a collapsed group');
    console.log('Inside collapsed group');
    console.groupEnd();
    console.groupEnd();

    console.table([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]);
    console.dir({ key: 'value' }, { depth: 2 });
    console.dirxml(document.body);
    console.assert(false, 'This assertion will fail');
    console.assert(true, 'This assertion will pass');

    console.profile('Profile 1');
    console.profileEnd('Profile 1');
    console.time('Timer');
    console.timeLog('Timer', 'Additional log');
    console.timeEnd('Timer');
    console.timeStamp('Timestamp 1');

    console.count('Count');
    console.countReset('Count');
  },
};

export const WithSomeConsoleMethods = {
  ...WithAllConsoleMethods,
  parameters: {
    actions: {
      console: {
        log: true,
        dir: true,
      },
    },
  },
  play: async () => {
    console.log('This is a log message');
    console.dir({ key: 'value' }, { depth: 2 });
    console.info(
      'This is an info message that will not be logged because console.info is not enabled'
    );
  },
};
