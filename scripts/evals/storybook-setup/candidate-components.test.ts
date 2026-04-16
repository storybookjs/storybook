import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { selectCandidateComponents } from './candidate-components';

const TEST_ROOT = join(process.cwd(), '.tmp-storybook-setup-eval-candidates');

afterEach(async () => {
  await import('node:fs/promises').then((fs) => fs.rm(TEST_ROOT, { recursive: true, force: true }));
});

describe('selectCandidateComponents', () => {
  it('returns simple exported JSX files before more complex ones', async () => {
    await mkdir(join(TEST_ROOT, 'src'), { recursive: true });
    await mkdir(join(TEST_ROOT, 'src', 'stories'), { recursive: true });
    await writeFile(
      join(TEST_ROOT, 'src', 'Simple.tsx'),
      `export function Simple() { return <div>simple</div>; }\n`
    );
    await writeFile(
      join(TEST_ROOT, 'src', 'Complex.tsx'),
      `import { memo } from 'react';
import { useStore } from './store';

export const Complex = memo(function Complex() {
  const value = useStore();
  return (
    <section>
      <div>{value}</div>
      <div>extra</div>
      <div>content</div>
    </section>
  );
});
`
    );
    await writeFile(
      join(TEST_ROOT, 'src', 'stories', 'Button.tsx'),
      `export function Button() { return <button>storybook sample</button>; }\n`
    );

    const candidates = await selectCandidateComponents(TEST_ROOT, 2);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.path.endsWith('Simple.tsx')).toBe(true);
    expect(candidates[1]?.path.endsWith('Complex.tsx')).toBe(true);
  });
});
