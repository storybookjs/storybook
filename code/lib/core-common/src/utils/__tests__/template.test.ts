import mock from '../../mock';
import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { getPreviewHeadTemplate, getPreviewBodyTemplate } from '../template';

const HEAD_HTML_CONTENTS = '<script>console.log("custom script!");</script>';
const BASE_HTML_CONTENTS = '<script>console.log("base script!");</script>';

const BASE_BODY_HTML_CONTENTS = '<div>story contents</div>';
const BODY_HTML_CONTENTS = '<div>custom body contents</div>';

describe('server.getPreviewHeadHtml', () => {
  describe('when .storybook/preview-head.html does not exist', () => {
    beforeEach(() => {
      mock({
        [`undefined/templates/base-preview-head.html`]: BASE_HTML_CONTENTS,
        config: {},
      });
    });

    afterEach(() => {
      mock.restore();
    });

    it('return an empty string', () => {
      const result = getPreviewHeadTemplate('./config');
      expect(result).toEqual(BASE_HTML_CONTENTS);
    });
  });

  describe('when .storybook/preview-head.html exists', () => {
    beforeEach(() => {
      mock({
        [`undefined/templates/base-preview-head.html`]: BASE_HTML_CONTENTS,
        config: {
          'preview-head.html': HEAD_HTML_CONTENTS,
        },
      });
    });

    afterEach(() => {
      mock.restore();
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
      mock({
        [`undefined/templates/base-preview-body.html`]: BASE_BODY_HTML_CONTENTS,
        config: {},
      });
    });

    afterEach(() => {
      mock.restore();
    });

    it('return an empty string', () => {
      const result = getPreviewBodyTemplate('./config');
      expect(result).toEqual(BASE_BODY_HTML_CONTENTS);
    });
  });

  describe('when .storybook/preview-body.html exists', () => {
    beforeEach(() => {
      mock({
        [`undefined/templates/base-preview-body.html`]: BASE_BODY_HTML_CONTENTS,
        config: {
          'preview-body.html': BODY_HTML_CONTENTS,
        },
      });
    });

    afterEach(() => {
      mock.restore();
    });

    it('return the contents of the file', () => {
      const result = getPreviewBodyTemplate('./config');
      expect(result).toEqual(BODY_HTML_CONTENTS + BASE_BODY_HTML_CONTENTS);
    });
  });
});
