import { readFile } from 'node:fs/promises';

import { resolveModule } from '../../src/shared/utils/module';

export async function flattenDependencies(
  list: string[],
  output: string[] = [],
  ignore: string[] = []
): Promise<string[]> {
  output.push(...list);

  await Promise.all(
    list.map(async (dep) => {
      let path;
      try {
        path = resolveModule({ pkg: dep });
      } catch (e) {
        console.log(dep + ' not found');
        return;
      }
      const { dependencies = {}, peerDependencies = {} } = JSON.parse(
        await readFile(path, { encoding: 'utf8' })
      );
      const all: string[] = [
        ...new Set([...Object.keys(dependencies), ...Object.keys(peerDependencies)]),
      ]
        .filter((d) => !output.includes(d))
        .filter((d) => !ignore.includes(d));

      await flattenDependencies(all, output, ignore);
    })
  );

  return output;
}
