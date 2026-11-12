// @vitest-environment happy-dom
import type { SyntheticEvent } from 'react';

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { API } from 'storybook/manager-api';

import { useMenu } from './Menu.tsx';

vi.mock('../components/sidebar/useChecklist.ts', () => ({
  useChecklist: () => ({ progress: 100 }),
}));

describe('useMenu', () => {
  it('runs the action an addon registered last when its menu item is clicked', () => {
    const first = vi.fn();
    const second = vi.fn();
    const registration = {
      label: 'Do it',
      defaultShortcut: ['O'],
      actionName: 'doIt',
      showInMenu: true,
      action: first,
    };
    const addonsShortcuts = { 'my-addon-doIt': registration };
    const api = {
      getShortcutKeys: () => ({}),
      getAddonsShortcuts: () => addonsShortcuts,
      getDocsUrl: () => 'https://storybook.js.org/docs',
    } as unknown as API;

    const { result } = renderHook(() =>
      useMenu({
        api,
        showToolbar: true,
        isPanelShown: true,
        isNavShown: true,
        enableShortcuts: true,
      })
    );
    const item = result.current.flat().find((menuItem) => menuItem.id === 'my-addon-doIt');
    expect(item).toBeDefined();

    // The addon registers again with a new closure. Nothing in the store changes, so the menu
    // list is not rebuilt.
    addonsShortcuts['my-addon-doIt'] = { ...registration, action: second };
    item?.onClick?.({} as SyntheticEvent, item);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
