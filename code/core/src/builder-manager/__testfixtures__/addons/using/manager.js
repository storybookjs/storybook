import { addons } from 'storybook/manager-api';

{
  using resource = { [Symbol.dispose]: () => addons.register('disposed', () => {}) };
  addons.register('using', () => {});
}
