// @vitest-environment happy-dom

import { describe, it, expect, vi } from 'vitest';
import * as api from 'storybook/internal/manager-api';
import type { Addon_BaseType } from 'storybook/internal/types';
import { PANEL_ID } from './constants';
import './manager';

vi.mock('storybook/internal/manager-api');
const mockedApi = vi.mocked<api.API>(api as any);
mockedApi.useAddonState = vi.fn();
const mockedAddons = vi.mocked(api.addons);
const registrationImpl = mockedAddons.register.mock.calls[0][1];

const isPanel = (input: Parameters<typeof mockedAddons.add>[1]): input is Addon_BaseType =>
  input.type === api.types.PANEL;
describe('A11yManager', () => {
  it('should register the panels', () => {
    // when
    registrationImpl(mockedApi);

    // then
    expect(mockedAddons.add.mock.calls).toHaveLength(2);
    expect(mockedAddons.add).toHaveBeenCalledWith(PANEL_ID, expect.anything());

    const panel = mockedAddons.add.mock.calls
      .map(([_, def]) => def)
      .find(({ type }) => type === api.types.PANEL);
    const tool = mockedAddons.add.mock.calls
      .map(([_, def]) => def)
      .find(({ type }) => type === api.types.TOOL);
    expect(panel).toBeDefined();
    expect(tool).toBeDefined();
  });

  it('should compute title with no issues', () => {
    // given
    mockedApi.useAddonState.mockImplementation(() => [undefined]);
    registrationImpl(api as unknown as api.API);
    const title = mockedAddons.add.mock.calls.map(([_, def]) => def).find(isPanel)
      ?.title as () => void;

    // when / then
    expect(title()).toMatchInlineSnapshot(`
      <div>
        <Spaced
          col={1}
        >
          <span
            style={
              {
                "display": "inline-block",
                "verticalAlign": "middle",
              }
            }
          >
            Accessibility
          </span>
        </Spaced>
      </div>
    `);
  });

  it('should compute title with issues', () => {
    // given
    mockedApi.useAddonState.mockImplementation(() => [
      {
        violations: [{}],
        incomplete: [{}, {}],
      },
    ]);
    registrationImpl(mockedApi);
    const title = mockedAddons.add.mock.calls.map(([_, def]) => def).find(isPanel)
      ?.title as () => void;

    // when / then
    expect(title()).toMatchInlineSnapshot(`
      <div>
        <Spaced
          col={1}
        >
          <span
            style={
              {
                "display": "inline-block",
                "verticalAlign": "middle",
              }
            }
          >
            Accessibility
          </span>
          <Badge
            status="neutral"
          >
            3
          </Badge>
        </Spaced>
      </div>
    `);
  });
});
