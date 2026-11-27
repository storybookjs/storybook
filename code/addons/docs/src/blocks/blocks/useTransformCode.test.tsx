// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/client-logger';

import { useTransformCode } from './useTransformCode.tsx';

vi.mock('storybook/internal/client-logger', { spy: true });

type StoryContext = Parameters<typeof useTransformCode>[2];

const storyContext = {
  id: 'story--primary',
  args: { label: 'Hello' },
  argTypes: { label: { name: 'label' } },
  parameters: {},
} as unknown as StoryContext;

const source = { code: '<Button />', language: 'jsx' as const };

describe('useTransformCode', () => {
  afterEach(() => {
    vi.mocked(logger.error).mockClear();
  });

  it('returns the transformed code', () => {
    const { result } = renderHook(() =>
      useTransformCode(source, (code) => `T:${code}`, storyContext)
    );

    expect(result.current).toEqual({ code: 'T:<Button />', language: 'jsx' });
  });

  it('falls back to the untransformed code and logs when the transform throws', () => {
    const error = new Error('transform failed');
    vi.mocked(logger.error).mockImplementation(() => {});

    const { result } = renderHook(() =>
      useTransformCode(
        source,
        () => {
          throw error;
        },
        storyContext
      )
    );

    expect(result.current).toEqual(source);
    expect(logger.error).toHaveBeenCalledWith(error);
  });

  it('falls back to the untransformed code when the transform reads argTypes', () => {
    vi.mocked(logger.error).mockImplementation(() => {});

    const { result } = renderHook(() =>
      useTransformCode(
        source,
        (code, { argTypes }) => `${code} ${Object.keys(argTypes).join(',')}`,
        storyContext
      )
    );

    expect(result.current).toEqual(source);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('no longer part of the story'),
      })
    );
  });

  it('falls back to the untransformed code and logs when an async transform rejects', async () => {
    const error = new Error('async transform failed');
    vi.mocked(logger.error).mockImplementation(() => {});
    // The hook calls the transform on every render; share one promise and mark it handled so the
    // rejection is not reported as unhandled before the effect subscribes to it.
    const rejected = Promise.reject(error);
    rejected.catch(() => {});

    const { result } = renderHook(() => useTransformCode(source, () => rejected, storyContext));

    expect(result.current.code).toBe('Transforming...');
    await waitFor(() => expect(result.current).toEqual(source));
    expect(logger.error).toHaveBeenCalledWith(error);
  });
});
