import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('storybook/internal/node-logger', { spy: true });

import { logger } from 'storybook/internal/node-logger';

import { outputStartupInformation } from './output-startup-information.ts';

const options = {
  updateInfo: { success: false, cached: false, time: 0 },
  version: '11.0.0',
  name: 'react-vite',
  address: 'http://localhost:6006/',
  networkAddress: 'http://192.168.1.1:6006/',
};

describe('outputStartupInformation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logger.logBox).mockImplementation(() => {});
    vi.mocked(logger.info).mockImplementation(() => {});
  });

  it('tells users how to opt into opening a browser', () => {
    outputStartupInformation({ ...options, open: false });

    expect(logger.logBox).toHaveBeenCalledWith(
      expect.stringContaining('Run Storybook with --open'),
      expect.anything()
    );
  });

  it('does not print the opt-in hint when the browser was opened', () => {
    outputStartupInformation({ ...options, open: true });

    expect(logger.logBox).toHaveBeenCalledWith(
      expect.not.stringContaining('Run Storybook with --open'),
      expect.anything()
    );
  });
});
