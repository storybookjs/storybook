export const Foo = 1;
const Bar = 1;
const _Bar = 1;
const Baz = 1;
const __Baz = 1;

storiesOf('foo', module)
  .add('foo', () => <button />)
  .add('bar', () => <button />)
  .add('_baz', () => <button />)
  .add('baz', () => <button />);
