import path from 'path';
import initStoryshots, {
  multiSnapshotWithOptions,
  Stories2SnapsConverter,
} from '@storybook/addon-storyshots';

initStoryshots({
  framework: 'svelte',
  configPath: path.join(__dirname, '../.storybook'),
  integrityOptions: { cwd: __dirname },
  stories2snapsConverter: new Stories2SnapsConverter({ storiesExtensions: ['.js', '.svelte'] }),
  test: multiSnapshotWithOptions(),
});
