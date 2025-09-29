import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import { getPreviewBodyTemplate, getPreviewHeadTemplate } from '../template';

vi.mock('fs', async () => {
  const memfs = await vi.importActual('memfs');

  return { default: memfs.fs, ...(memfs as any).fs };
});

const HEAD_HTML_CONTENTS = '<script>console.log("custom script!");</script>';
const BASE_HTML_CONTENTS = '<script>console.log("base script!");</script>';

const BASE_BODY_HTML_CONTENTS = '<div>story contents</div>';
const BODY_HTML_CONTENTS = '<div>custom body contents</div>';

const BASE_CORE_PKG_DIR = join(import.meta.url, '..', '..', '..', '..', '..');

vi.mock('../../../shared/utils/module', () => {
  return {
    resolvePackageDir: () => BASE_CORE_PKG_DIR,
  };
});

afterEach(() => {
  vol.reset();
});

describe('server.getPreviewHeadHtml', () => {
  it('return an empty string when .storybook/preview-head.html does NOT exist', () => {
    vol.fromNestedJSON({
      [`${BASE_CORE_PKG_DIR}/assets/server/base-preview-head.html`]: BASE_HTML_CONTENTS,
      config: {},
    });

    expect(getPreviewHeadTemplate('./config')).toEqual(BASE_HTML_CONTENTS);
  });

  it('return the contents of the file when .storybook/preview-head.html exists', () => {
    vol.fromNestedJSON({
      [`${BASE_CORE_PKG_DIR}/assets/server/base-preview-head.html`]: BASE_HTML_CONTENTS,
      config: {
        'preview-head.html': HEAD_HTML_CONTENTS,
      },
    });

    expect(getPreviewHeadTemplate('./config')).toEqual(BASE_HTML_CONTENTS + HEAD_HTML_CONTENTS);
  });
});

describe('server.getPreviewBodyHtml', () => {
  it('return an empty string when .storybook/preview-body.html does NOT exist', () => {
    vol.fromNestedJSON({
      [`${BASE_CORE_PKG_DIR}/assets/server/base-preview-body.html`]: BASE_BODY_HTML_CONTENTS,
      config: {},
    });

    expect(getPreviewBodyTemplate('./config')).toEqual(BASE_BODY_HTML_CONTENTS);
  });

  it('return the contents of the file when .storybook/preview-body.html exists', () => {
    vol.fromNestedJSON({
      [`${BASE_CORE_PKG_DIR}/assets/server/base-preview-body.html`]: BASE_BODY_HTML_CONTENTS,
      config: {
        'preview-body.html': BODY_HTML_CONTENTS,
      },
    });

    expect(getPreviewBodyTemplate('./config')).toEqual(
      BODY_HTML_CONTENTS + BASE_BODY_HTML_CONTENTS
    );
  });
});
