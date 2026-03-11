import { writeFile } from 'node:fs/promises';

type File = Parameters<typeof writeFile>[0];
type Data = Parameters<typeof writeFile>[1];
type Options = Parameters<typeof writeFile>[2];

export async function writeFileWithRetry(file: File, data: Data, options: Options): Promise<void> {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await writeFile(file, data, options);
      return;
    } catch (err) {
      // If an EBUSY error occurs on any attempt except
      // the last, then wait for a bit and try again.
      // https://github.com/storybookjs/storybook/issues/23131
      if (attempt < MAX_ATTEMPTS && err instanceof Error && 'code' in err && err.code === 'EBUSY') {
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else {
        throw err;
      }
    }
  }
}
