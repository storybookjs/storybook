import { copy } from '@ndelangen/fs-extra-unified';
import { join } from 'path';

const src = join(__dirname, '..', 'src');
const dist = join(__dirname, '..', 'dist');

// relative to src directory
const PATHS_TO_COPY = ['createSvelte5Props.svelte.js', 'components'];

const run = async () => {
  console.log('Copying unbundled files to dist...');
  await Promise.all(
    PATHS_TO_COPY.map((pathToCopy) =>
      copy(join(src, pathToCopy), join(dist, pathToCopy), { overwrite: true })
    )
  );
  console.log('Done!');
};

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
