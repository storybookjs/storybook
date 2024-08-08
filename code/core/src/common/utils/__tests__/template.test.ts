import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { getPreviewHeadTemplate, getPreviewBodyTemplate } from '../template';
import { dirname } from 'node:path';

import { vol } from 'memfs';

vi.mock('fs', async () => {
  const memfs = await vi.importActual('memfs');

  return { default: memfs.fs, ...(memfs as any).fs };
});

const HEAD_HTML_CONTENTS = '<script>console.log("custom script!");</script>';
const BASE_HTML_CONTENTS = '<script>console.log("base script!");</script>';

const BASE_BODY_HTML_CONTENTS = '<div>story contents</div>';
const BODY_HTML_CONTENTS = '<div>custom body contents</div>';

const base = dirname(require.resolve('@storybook/core/package.json'));

describe('server.getPreviewHeadHtml', () => {
  afterEach(() => {
    vol.reset();
  });
  describe('when .storybook/preview-head.html does not exist', () => {
    beforeEach(() => {
      vol.fromNestedJSON({
        [`${base}/assets/server/base-preview-head.html`]: BASE_HTML_CONTENTS,
        config: {},
      });
    });

    it('return an empty string', () => {
      const result = getPreviewHeadTemplate('./config');
      expect(result).toEqual(BASE_HTML_CONTENTS);
    });
  });

  describe('when .storybook/preview-head.html exists', () => {
    beforeEach(() => {
      vol.fromNestedJSON({
        [`${base}/assets/server/base-preview-head.html`]: BASE_HTML_CONTENTS,
        config: {
          'preview-head.html': HEAD_HTML_CONTENTS,
        },
      });
    });

    it('return the contents of the file', () => {
      const result = getPreviewHeadTemplate('./config');
      expect(result).toEqual(BASE_HTML_CONTENTS + HEAD_HTML_CONTENTS);
    });
  });
});

describe('server.getPreviewBodyHtml', () => {
  describe('when .storybook/preview-body.html does not exist', () => {
    beforeEach(() => {
      vol.fromNestedJSON({
        [`${base}/assets/server/base-preview-body.html`]: BASE_BODY_HTML_CONTENTS,
        config: {},
      });
    });

    it('return an empty string', () => {
      const result = getPreviewBodyTemplate('./config');
      expect(result).toEqual(BASE_BODY_HTML_CONTENTS);
    });
  });

  describe('when .storybook/preview-body.html exists', () => {
    beforeEach(() => {
      vol.fromNestedJSON({
        [`${base}/assets/server/base-preview-body.html`]: BASE_BODY_HTML_CONTENTS,
        config: {
          'preview-body.html': BODY_HTML_CONTENTS,
        },
      });
    });

    it('return the contents of the file', () => {
      const result = getPreviewBodyTemplate('./config');
      expect(result).toEqual(BODY_HTML_CONTENTS + BASE_BODY_HTML_CONTENTS);
    });
  });
});
