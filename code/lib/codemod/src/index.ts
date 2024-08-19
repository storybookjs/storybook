/* eslint import/prefer-default-export: "off" */
import { readdirSync } from 'node:fs';
import { rename as renameAsync } from 'node:fs/promises';
import { extname } from 'node:path';

import { sync as spawnSync } from 'cross-spawn';

import { jscodeshiftToPrettierParser } from './lib/utils';

export {
  default as updateOrganisationName,
  packageNames,
} from './transforms/update-organisation-name';

export { default as updateAddonInfo } from './transforms/update-addon-info';

const TRANSFORM_DIR = `${__dirname}/transforms`;

export function listCodemods() {
  return readdirSync(TRANSFORM_DIR)
    .filter((fname) => fname.endsWith('.js'))
    .map((fname) => fname.slice(0, -3));
}

async function renameFile(file: any, from: any, to: any, { logger }: any) {
  const newFile = file.replace(from, to);
  logger.log(`Rename: ${file} ${newFile}`);
  return renameAsync(file, newFile);
}

export async function runCodemod(
  codemod: any,
  {
    glob,
    logger,
    dryRun,
    rename,
    parser,
  }: { glob: any; logger: any; dryRun?: any; rename?: any; parser?: any }
) {
  const codemods = listCodemods();
  if (!codemods.includes(codemod)) {
    throw new Error(`Unknown codemod ${codemod}. Run --list for options.`);
  }

  let renameParts = null;
  if (rename) {
    renameParts = rename.split(':');
    if (renameParts.length !== 2) {
      throw new Error(`Codemod rename: expected format "from:to", got "${rename}"`);
    }
  }

  // jscodeshift/prettier know how to handle .ts/.tsx extensions,
  // so if the user uses one of those globs, we can auto-infer
  let inferredParser = parser;

  if (!parser) {
    const extension = extname(glob).slice(1);
    const knownParser = jscodeshiftToPrettierParser(extension);

    if (knownParser !== 'babel') {
      inferredParser = extension;
    }
  }

  // Dynamically import globby because it is a pure ESM module
  const { globby } = await import('globby');

  const files = await globby([glob, '!**/node_modules', '!**/dist']);
  const extensions = new Set(files.map((file) => extname(file).slice(1)));
  const commaSeparatedExtensions = Array.from(extensions).join(',');

  logger.log(`=> Applying ${codemod}: ${files.length} files`);

  if (files.length === 0) {
    logger.log(`=> No matching files for glob: ${glob}`);
    return;
  }

  if (!dryRun && files.length > 0) {
    const parserArgs = inferredParser ? ['--parser', inferredParser] : [];
    const result = spawnSync(
      'node',
      [
        require.resolve('jscodeshift/bin/jscodeshift'),
        // this makes sure codeshift doesn't transform our own source code with babel
        // which is faster, and also makes sure the user won't see babel messages such as:
        // [BABEL] Note: The code generator has deoptimised the styling of repo/node_modules/prettier/index.js as it exceeds the max of 500KB.
        '--no-babel',
        `--extensions=${commaSeparatedExtensions}`,
        '--fail-on-error',
        '-t',
        `${TRANSFORM_DIR}/${codemod}.js`,
        ...parserArgs,
        ...files.map((file) => `"${file}"`),
      ],
      {
        stdio: 'inherit',
        shell: true,
      }
    );

    if (codemod === 'mdx-to-csf' && result.status === 1) {
      logger.log(
        'The codemod was not able to transform the files mentioned above. We have renamed the files to .mdx.broken. Please check the files and rename them back to .mdx after you have either manually transformed them to mdx + csf or fixed the issues so that the codemod can transform them.'
      );
    } else if (result.status === 1) {
      logger.log('Skipped renaming because of errors.');
      return;
    }
  }

  if (renameParts) {
    const [from, to] = renameParts;
    logger.log(`=> Renaming ${rename}: ${files.length} files`);
    await Promise.all(
      files.map((file) => renameFile(file, new RegExp(`${from}$`), to, { logger }))
    );
  }
}
