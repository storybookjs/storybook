import { join } from 'node:path';

import { format } from 'oxfmt';
import { createJiti } from 'jiti';

import config from '../build-config.ts';

import { writeGeneratedFile } from '../../../../scripts/build/utils/write-generated-file.ts';

const PRODUCT_ROOT_DIR = join(import.meta.dirname, '..');

const localAlias = Object.fromEntries(
  Object.values(config.entries).flatMap((entries) =>
    entries.flatMap(({ exportEntries = [], entryPoint }) =>
      exportEntries.map((entry) => [
        `storybook${entry.slice(1)}`,
        join(PRODUCT_ROOT_DIR, entryPoint),
      ])
    )
  )
);

async function generateManagerFile(): Promise<void> {
  const jiti = createJiti(import.meta.url, {
    alias: {
      ...localAlias,
      // Metadata loading must not compose the features it is still importing.
      'storybook/internal/csf': join(PRODUCT_ROOT_DIR, '../../core/src/csf/index.ts'),
    },
  });
  const { getBuiltInManagerEntries } = await jiti.import<
    typeof import('../src/storybook/server/presets/manager-entries.ts')
  >(join(PRODUCT_ROOT_DIR, 'src/storybook/server/presets/manager-entries.ts'));
  // Product entries are package-relative paths; entries of other packages are module specifiers.
  const imports = getBuiltInManagerEntries().map(
    (entry, index) =>
      `import manager${index} from '${entry.startsWith('src/') ? `../../../${entry.slice('src/'.length)}` : entry}';`
  );
  const names = imports.map((_, index) => `manager${index}`);
  const { code } = await format(
    'common-manager.ts',
    `${imports.join('\n')}\n\nexport default [${names.join(', ')}];\n`,
    { singleQuote: true }
  );
  await writeGeneratedFile(
    join(PRODUCT_ROOT_DIR, 'src/storybook/server/presets/common-manager.ts'),
    code
  );
}

generateManagerFile();
