import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  instanceIdFromSearch,
  isEventForInstance,
  storyFrameQuery,
} from './preview-participant.ts';

const forbidden = [
  /addon-docs/,
  /@storybook\/blocks/,
  /@mdx-js\/react/,
  /from ['"]react['"]/,
  /react-dom/,
];

describe('preview entry', () => {
  it('does not import React, addon-docs, or docs renderers', () => {
    for (const name of ['preview.ts', 'preview-participant.ts', 'mdx.ts']) {
      const source = readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8');
      for (const pattern of forbidden) {
        expect(source, name).not.toMatch(pattern);
      }
    }
  });

  it('addresses a story iframe by instance id', () => {
    const query = storyFrameQuery('button--primary', 'button--primary#4:1');
    expect(instanceIdFromSearch(`?${query}`)).toBe('button--primary#4:1');
    expect(isEventForInstance('button--primary#4:1', { instanceId: 'button--primary#4:1' })).toBe(
      true
    );
    expect(isEventForInstance('button--primary#4:1', { instanceId: 'button--primary#6:1' })).toBe(
      false
    );
    expect(isEventForInstance('button--primary#4:1', {})).toBe(false);
  });
});
