import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, vi } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { internal_getArgTypesData } from './preset.ts';

// Ghost stories infer the required args of components with this preset. On the docgen server it
// must not need the optional builder docgen packages.
vi.mock('react-docgen', () => {
  throw new Error('react-docgen must not load on the docgen server');
});
vi.mock('react-docgen-typescript', () => {
  throw new Error('react-docgen-typescript must not load on the docgen server');
});

const presets = {
  apply: async (name: string) => (name === 'features' ? { docgenServer: true } : {}),
} as unknown as Options['presets'];

test('infers required args with the docgen server engine', async () => {
  const argTypes = await internal_getArgTypesData(null, {
    componentFilePath: join(import.meta.dirname, '../template/cli/ts/Button.tsx'),
    componentExportName: 'Button',
    presets,
  });

  expect(argTypes?.label).toMatchObject({ name: 'label', type: { required: true } });
}, 60_000);

test('infers required args of a default export', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sb-ghost-default-'));
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { jsx: 'react-jsx', strict: true }, include: ['*.tsx'] })
  );
  writeFileSync(
    join(dir, 'Card.tsx'),
    'export default function Card({ title }: { title: string; subtitle?: string }) { return <h1>{title}</h1>; }'
  );

  const argTypes = await internal_getArgTypesData(null, {
    componentFilePath: join(dir, 'Card.tsx'),
    componentExportName: 'default',
    presets,
  });

  expect(argTypes?.title).toMatchObject({ type: { required: true } });
  expect(argTypes?.subtitle).toMatchObject({ type: { required: false } });
}, 60_000);
