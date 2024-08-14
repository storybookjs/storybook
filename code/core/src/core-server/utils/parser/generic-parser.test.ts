import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GenericParser } from './generic-parser';

const genericParser = new GenericParser();

const TEST_DIR = join(__dirname, '..', '__search-files-tests__');

describe('generic-parser', () => {
  it('should correctly return exports from ES modules', async () => {
    const content = readFileSync(join(TEST_DIR, 'src', 'es-module.js'), 'utf-8');
    const { exports } = await genericParser.parse(content);

    expect(exports).toEqual([
      {
        default: false,
        name: 'p',
      },
      {
        default: false,
        name: 'q',
      },
      {
        default: false,
        name: 'C',
      },
      {
        default: false,
        name: 'externalName',
      },
      {
        default: false,
        name: 'ns',
      },
      {
        default: true,
        name: 'default',
      },
    ]);
  });
});
