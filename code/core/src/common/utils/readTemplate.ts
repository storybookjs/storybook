import { readFile } from 'node:fs/promises';

export async function readTemplate(filename: string): Promise<string> {
  return readFile(filename, {
    encoding: 'utf8',
  });
}
