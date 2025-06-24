import { readFile } from 'node:fs/promises';

export async function readTemplate(filename: string) {
  return readFile(filename, {
    encoding: 'utf8',
  });
}
