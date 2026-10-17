import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs, vol } from 'memfs';

import { loadCsf, writeCsf } from './CsfFile.ts';

vi.mock('node:fs/promises', { spy: true });

const fileName = resolve('Button.stories.ts');
const source = "export default { title: 'Button' };\r\nexport const Primary = {};\r\n";

beforeEach(() => {
  vol.reset();
  vol.fromJSON({ [fileName]: source });
  vi.mocked(writeFile).mockImplementation(async (file, data) => {
    await fs.promises.writeFile(file.toString(), data.toString());
  });
});

describe('writeCsf', () => {
  it('writes an edited CRLF file back to the file it was loaded from, with CRLF', async () => {
    const csf = loadCsf(source, { fileName, makeTitle: (title) => title ?? 'Untitled' }).parse();
    const [story] = csf.objects({ meta: false });
    story.set(['args', 'label'], 'Hi');

    await writeCsf(csf);

    expect(fs.readFileSync(fileName, 'utf8')).toBe(
      "export default { title: 'Button' };\r\nexport const Primary = { args: { label: 'Hi' } };\r\n"
    );
  });
});
