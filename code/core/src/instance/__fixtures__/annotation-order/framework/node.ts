import { defineBuilder, defineFramework } from '../../../addons.ts';
import renderer from '../native-renderer/node.ts';

const builder = defineBuilder(() => ({
  meta: { name: 'fixture-annotation-builder' },
  setup(): void {},
  dev: unsupported,
  build: unsupported,
  changeDetectionAdapter: unsupported,
}));

export default defineFramework(() => ({
  meta: { name: 'fixture-annotation-framework' },
  builder: builder(),
  renderer: renderer(),
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => ['/framework-preview.ts']);
  },
}));

function unsupported(): never {
  throw new TypeError('The fixture builder only supports setup.');
}
