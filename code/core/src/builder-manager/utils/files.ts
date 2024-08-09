import type { OutputFile } from 'esbuild';
import { ensureFile } from '@ndelangen/fs-extra-unified';
import { join, normalize } from 'node:path';
import slash from 'slash';
import type { Compilation } from '../types';
import { writeFile } from 'node:fs/promises';

export async function readOrderedFiles(
  addonsDir: string,
  outputFiles: Compilation['outputFiles'] | undefined
) {
  const files = await Promise.all(
    outputFiles?.map(async (file) => {
      // convert deeply nested paths to a single level, also remove special characters
      const { location, url } = sanitizePath(file, addonsDir);

      await ensureFile(location);
      await writeFile(location, file.contents);
      return url;
    }) || []
  );

  const jsFiles = files.filter((file) => file.endsWith('.js'));
  const cssFiles = files.filter((file) => file.endsWith('.css'));
  return { cssFiles, jsFiles };
}

export function sanitizePath(file: OutputFile, addonsDir: string) {
  const filePath = file.path.replace(addonsDir, '');
  const location = normalize(join(addonsDir, filePath));
  const url = `./sb-addons${slash(filePath).split('/').map(encodeURIComponent).join('/')}`;

  return { location, url };
}
