import { storiesOf } from '@storybook/react';

const foo = 'some|generated/path';

storiesOf(foo, module).add('foobar', () => <>hmm</>);
