import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCopyToClipboardFunction } from './createCopyToClipboardFunction';

const writeText = vi.fn();

Object.assign(navigator, {
  clipboard: {
    writeText,
  },
});

global.document = {
  createElement: vi.fn(),
} as any as Document;

describe('createCopyToClipboardFunction', () => {
  describe('when navigator.clipboard is available', () => {
    it('returns a function', () => {
      const copyToClipboard = createCopyToClipboardFunction();

      expect(copyToClipboard).toBeTypeOf('function');
    });

    it('returns a function that uses navigator.clipboard.writeText', () => {
      const copyToClipboard = createCopyToClipboardFunction();

      copyToClipboard('text');

      expect(writeText).toHaveBeenCalledWith('text');
    });

    it('does not instantiate HTML elements', () => {
      const copyToClipboard = createCopyToClipboardFunction();

      copyToClipboard('text');

      expect(document.createElement).not.toHaveBeenCalled();
    });
  });

  describe('when navigator.clipboard is not available', () => {
    beforeEach(() => {
      delete (navigator as any).clipboard;
    });

    it('returns a function', () => {
      const copyToClipboard = createCopyToClipboardFunction();

      expect(copyToClipboard).toBeTypeOf('function');
    });

    it('never calls navigator.clipboard.writeText', async () => {
      const copyToClipboard = createCopyToClipboardFunction();

      // DOM mocking is not enabled which will cause the function to throw
      try {
        await copyToClipboard('text');
      } catch (e) {}

      expect(writeText).not.toHaveBeenCalled();
    });
  });
});
