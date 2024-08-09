import { readFile, writeFile } from 'node:fs/promises';

/* I wish this wasn't needed..
 * There seems to be some bug in tsup / the unlaying lib that does DTS bundling
 * ...that makes it mess up the generation.
 */
const run = async () => {
  const content = await readFile('./dist/index.d.ts', 'utf-8');

  const regexp = /'lib\/preview-api/;
  const replaced = content.replace(regexp, "'@storybook/preview-api");

  await writeFile('./dist/index.d.ts', replaced);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
