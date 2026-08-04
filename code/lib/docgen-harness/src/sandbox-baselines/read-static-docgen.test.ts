import { beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import type { DocgenPayload } from '../../../../core/src/shared/open-service/services/docgen/types.ts';
import { SANDBOX_TOKEN, readStaticDocgen, toBaseline } from './read-static-docgen.ts';

vi.mock('node:fs', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return { ...memfs.fs, default: memfs.fs };
});

const SANDBOX = '/sandboxes/my-sandbox';
const STATIC = `${SANDBOX}/storybook-static`;
const DOCGEN = `${STATIC}/services/core/docgen`;

const snapshot = (id: string, payload: Partial<DocgenPayload>) =>
  JSON.stringify({
    components: { [id]: { id, name: id, path: `./${id}.stories.ts`, ...payload } },
  });

beforeEach(() => {
  vol.reset();
});

describe('readStaticDocgen', () => {
  it('reads one component per snapshot file, sorted by id', () => {
    vol.fromJSON({
      [`${DOCGEN}/zeta.json`]: snapshot('zeta', { jsDocTags: {} }),
      [`${DOCGEN}/alpha.json`]: snapshot('alpha', { jsDocTags: {} }),
    });

    expect(Object.keys(readStaticDocgen({ staticDir: STATIC, sandboxDir: SANDBOX }))).toEqual([
      'alpha',
      'zeta',
    ]);
  });

  it('ignores non-JSON files in the snapshot directory', () => {
    vol.fromJSON({
      [`${DOCGEN}/alpha.json`]: snapshot('alpha', { jsDocTags: {} }),
      [`${DOCGEN}/README.md`]: 'not a snapshot',
    });

    expect(Object.keys(readStaticDocgen({ staticDir: STATIC, sandboxDir: SANDBOX }))).toEqual([
      'alpha',
    ]);
  });

  it('explains how to produce the snapshots when the directory is absent', () => {
    vol.fromJSON({ [`${STATIC}/index.html`]: '<html></html>' });

    expect(() => readStaticDocgen({ staticDir: STATIC, sandboxDir: SANDBOX })).toThrow(
      /experimentalDocgenServer/
    );
  });

  it('refuses to record a build whose snapshots hold no components', () => {
    vol.fromJSON({ [`${DOCGEN}/empty.json`]: JSON.stringify({ components: {} }) });

    expect(() => readStaticDocgen({ staticDir: STATIC, sandboxDir: SANDBOX })).toThrow(
      /refusing to record an empty run/
    );
  });

  it('skips components referenced through a global, which have no import to resolve', () => {
    vol.fromJSON({
      [`${DOCGEN}/global.json`]: snapshot('global', {
        name: 'globalThis.__TEMPLATE_COMPONENTS__.Html',
        jsDocTags: {},
      }),
      [`${DOCGEN}/real.json`]: snapshot('real', { name: 'ButtonComponent', jsDocTags: {} }),
    });

    expect(Object.keys(readStaticDocgen({ staticDir: STATIC, sandboxDir: SANDBOX }))).toEqual([
      'real',
    ]);
  });

  it('refuses to record when every component is globally referenced', () => {
    vol.fromJSON({
      [`${DOCGEN}/global.json`]: snapshot('global', {
        name: 'globalThis.__TEMPLATE_COMPONENTS__.Html',
        jsDocTags: {},
      }),
    });

    expect(() => readStaticDocgen({ staticDir: STATIC, sandboxDir: SANDBOX })).toThrow(
      /globally referenced/
    );
  });
});

describe('toBaseline', () => {
  const payload = (extra: Partial<DocgenPayload> = {}): DocgenPayload => ({
    id: 'button',
    name: 'ButtonComponent',
    path: './src/button.stories.ts',
    jsDocTags: {},
    ...extra,
  });

  it('drops engine-specific fields that are not part of the portable payload', () => {
    const result = toBaseline(
      payload({
        argTypes: {},
        compodoc: { name: 'ButtonComponent', sourceCode: 'x'.repeat(5000) },
      }),
      SANDBOX
    );

    expect(result).not.toHaveProperty('compodoc');
    expect(result).toHaveProperty('argTypes');
  });

  it('omits absent optional fields rather than recording them as undefined', () => {
    expect(Object.keys(toBaseline(payload(), SANDBOX))).toEqual([
      'id',
      'name',
      'path',
      'jsDocTags',
    ]);
  });

  it('replaces the sandbox path inside nested error messages', () => {
    const result = toBaseline(
      payload({
        error: { name: 'ComponentNotDocumented', message: `Source: ${SANDBOX}/documentation.json` },
      }),
      SANDBOX
    );

    expect(result.error?.message).toBe(`Source: ${SANDBOX_TOKEN}/documentation.json`);
  });

  it('replaces the sandbox path in its POSIX spelling so baselines cross platforms', () => {
    const windowsSandbox = 'C:\\sandboxes\\my-sandbox';
    const result = toBaseline(
      payload({
        error: {
          name: 'ComponentNotDocumented',
          message: 'Source: C:/sandboxes/my-sandbox/documentation.json',
        },
      }),
      windowsSandbox
    );

    expect(result.error?.message).toBe(`Source: ${SANDBOX_TOKEN}/documentation.json`);
  });
});
