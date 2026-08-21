// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';

import { useTransformCode } from './useTransformCode.tsx';

const storyContext = {} as Parameters<typeof useTransformCode>[2];

it('supports adding and removing a transform without changing hook order', () => {
  const transform = (source: string) => `transformed ${source}`;
  const { result, rerender } = renderHook(
    ({ source, active }: { source: string; active: boolean }) =>
      useTransformCode(source, active ? transform : undefined, storyContext),
    { initialProps: { source: 'first', active: false } }
  );

  expect(result.current).toBe('first');

  rerender({ source: 'second', active: true });
  expect(result.current).toBe('transformed second');

  rerender({ source: 'third', active: false });
  expect(result.current).toBe('third');
});

it('publishes an asynchronous transform result', async () => {
  let resolve: (value: string) => void = () => {};
  const transformed = new Promise<string>((done) => {
    resolve = done;
  });
  const { result } = renderHook(() => useTransformCode('source', () => transformed, storyContext));

  expect(result.current).toBe('Transforming...');

  act(() => resolve('transformed source'));

  await waitFor(() => expect(result.current).toBe('transformed source'));
});
