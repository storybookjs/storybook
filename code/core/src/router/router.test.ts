// @vitest-environment happy-dom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NAVIGATE_URL } from 'storybook/internal/core-events';

import { useNavigate } from './router.tsx';

const { emit, navigate } = vi.hoisted(() => ({ emit: vi.fn(), navigate: vi.fn() }));

vi.mock('@storybook/global', () => ({
  global: {
    document: { location: { pathname: '/', search: '?path=/docs/current--docs' } },
  },
}));
vi.mock('storybook/manager-api', () => ({ addons: { getChannel: () => ({ emit }) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('fragment navigation', () => {
  it('retains replacement and state when dispatching a same-page anchor', () => {
    const { result } = renderHook(useNavigate);
    const options = { replace: true, state: { restored: true }, preventScrollReset: true };
    act(() => result.current('/docs/current--docs#anchor', options));
    expect(emit).toHaveBeenCalledWith(NAVIGATE_URL, '#anchor', options);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('retains explicit push behavior for a plain same-page URL', () => {
    const { result } = renderHook(useNavigate);
    act(() => result.current('?path=/docs/current--docs#anchor', { plain: true, replace: false }));
    expect(emit).toHaveBeenCalledWith(NAVIGATE_URL, '#anchor', { replace: false });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('replaces a direct fragment through the router without another channel event', () => {
    const { result } = renderHook(useNavigate);
    act(() => result.current('#anchor', { replace: true }));
    expect(navigate).toHaveBeenCalledWith('?path=/docs/current--docs#anchor', { replace: true });
    expect(emit).not.toHaveBeenCalled();
  });

  it('retains options when moving to another chapter', () => {
    const { result } = renderHook(useNavigate);
    act(() => result.current('/docs/other--docs#anchor', { replace: true }));
    expect(navigate).toHaveBeenCalledWith('?path=/docs/other--docs#anchor', { replace: true });
    expect(emit).not.toHaveBeenCalled();
  });
});
