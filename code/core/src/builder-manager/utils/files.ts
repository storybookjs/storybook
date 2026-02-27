import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';

import type { OutputAsset, OutputChunk } from 'rolldown';
// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';

export async function readOrderedFiles(
  addonsDir: string,
  outputFiles: (OutputChunk | OutputAsset)[] | undefined
) {
  const files = await Promise.all(
    outputFiles?.map(async (file) => {
      // convert deeply nested paths to a single level, also remove special characters
      const { location, url } = sanitizePath(file, addonsDir);

      if (!existsSync(location)) {
        const directory = dirname(location);
        await mkdir(directory, { recursive: true });
      }
      const contents = file.type === 'chunk' ? file.code : file.source;
      await writeFile(location, contents);
      return url;
    }) || []
  );

  const jsFiles = files.filter((file) => file.endsWith('.js'));
  const cssFiles = files.filter((file) => file.endsWith('.css'));
  return { cssFiles, jsFiles };
}

export function sanitizePath(file: { fileName: string }, addonsDir: string) {
  const filePath = file.fileName;
  const location = normalize(join(addonsDir, filePath));
  const url = `./sb-addons/${slash(filePath).split('/').map(encodeURIComponent).join('/')}`;

  return { location, url };
}
