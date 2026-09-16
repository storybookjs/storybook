import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CaptureRequestError,
  componentImportFor,
  handleCapture,
  parseCaptureBody,
  resolveComponentFile,
  storyPathFor,
} from './capture-handler.ts';

// Real tmp directories: the handler spans fs existence checks + the csf-tools
// writer, so an on-disk fixture proves the whole chain without mocks.
let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'sb-devtools-capture-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const setup = async (): Promise<{ componentsDir: string }> => {
  const componentsDir = join(root, 'components');
  await mkdir(componentsDir, { recursive: true });
  await writeFile(join(componentsDir, 'Button.tsx'), 'export const Button = () => null;\n');
  return { componentsDir };
};

const bodyOf = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    componentName: 'Button',
    source: { file: 'components/Button.tsx', line: 1, column: 0, regime: 'componentStack' },
    props: [
      { name: 'label', kind: 'primitive', value: 'Hello' },
      { name: 'count', kind: 'primitive', value: 3 },
      { name: 'disabled', kind: 'primitive', value: false },
      { name: 'onClick', kind: 'function', preview: 'ƒ anonymous' },
    ],
    reactVersion: 'react>=19.2',
    capturedAt: 0,
    ...overrides,
  });

const options = (glob = join(root, 'components', '**')) => ({
  storiesGlob: glob,
  roots: { codeRoot: root, cwd: root },
});

describe('parseCaptureBody', () => {
  it('round-trips a valid payload', () => {
    const payload = parseCaptureBody(bodyOf());
    expect(payload.componentName).toBe('Button');
    expect(payload.props).toHaveLength(4);
  });

  it('rejects non-JSON bodies', () => {
    expect(() => parseCaptureBody('not json')).toThrow(CaptureRequestError);
    try {
      parseCaptureBody('not json');
    } catch (error) {
      expect((error as CaptureRequestError).kind).toBe('invalid_payload');
    }
  });

  it('rejects payloads with a component name containing path separators', () => {
    expect(() => parseCaptureBody(bodyOf({ componentName: '../Button' }))).toThrow(
      /valid CapturePayload/
    );
  });
});

describe('resolveComponentFile', () => {
  const fileExists = (path: string) => path === '/exists/Button.tsx' || path.startsWith('/exists/');

  it('accepts an absolute source path when it exists', () => {
    expect(
      resolveComponentFile('/exists/Button.tsx', { codeRoot: '/code', cwd: '/cwd' }, fileExists)
    ).toBe('/exists/Button.tsx');
  });

  it('resolves relative paths against the demo cwd before the code root', () => {
    expect(
      resolveComponentFile(
        'components/Button.tsx',
        { codeRoot: '/code', cwd: '/exists' },
        fileExists
      )
    ).toBe(join('/exists', 'components', 'Button.tsx'));
  });

  it('falls back to the code root, then null — never a guess', () => {
    expect(
      resolveComponentFile('lib/x/Button.tsx', { codeRoot: '/exists', cwd: '/cwd' }, fileExists)
    ).toBe(join('/exists', 'lib', 'x', 'Button.tsx'));
    expect(
      resolveComponentFile('nowhere/Button.tsx', { codeRoot: '/code', cwd: '/cwd' }, fileExists)
    ).toBeNull();
  });
});

describe('path helpers', () => {
  it('writes stories next to the component, named after it', () => {
    expect(storyPathFor('/app/src/components/Button.tsx', 'Button')).toBe(
      join('/app/src/components', 'Button.stories.ts')
    );
  });

  it('builds a relative component import specifier', () => {
    expect(
      componentImportFor(
        '/app/src/components/Button.stories.ts',
        '/app/src/components/Button.tsx',
        'Button'
      )
    ).toEqual({ componentName: 'Button', importPath: './Button.tsx' });
  });
});

describe('handleCapture', () => {
  it('writes a new story next to the component and reports its id and flagged props', async () => {
    const { componentsDir } = await setup();

    const result = await handleCapture(bodyOf(), options());

    expect(result.storyName).toBe('Primary');
    expect(result.storyId).toBe('button--primary');
    expect(result.filePath).toBe('components/Button.stories.ts');
    expect(result.flagged.map((prop) => prop.name)).toEqual(['onClick']);
    const written = await import('node:fs/promises').then((fs) =>
      fs.readFile(join(componentsDir, 'Button.stories.ts'), 'utf-8')
    );
    expect(written).toContain('Primary');
    expect(written).toContain('label: "Hello"');
    expect(written).toContain('onClick');
  });

  it('appends a variant on the second capture instead of overwriting', async () => {
    await setup();
    await handleCapture(bodyOf(), options());

    const second = await handleCapture(
      bodyOf({
        props: [{ name: 'label', kind: 'primitive', value: 'Again' }],
      }),
      options()
    );

    expect(second.storyName).toBe('Primary2');
    expect(second.storyId).toBe('button--primary2');
  });

  it('fails with source_unknown when the payload has no source location', async () => {
    await setup();
    await expect(handleCapture(bodyOf({ source: null }), options())).rejects.toMatchObject({
      kind: 'source_unknown',
    });
  });

  it('fails with component_not_found when the component file is not on disk', async () => {
    await expect(handleCapture(bodyOf(), options())).rejects.toMatchObject({
      kind: 'component_not_found',
      filePath: 'components/Button.tsx',
    });
  });

  it('surfaces write failures with the attempted story path', async () => {
    await setup();
    // A directory where the story file should be forces the writer to fail.
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(root, 'components', 'Button.stories.ts'));

    try {
      await handleCapture(bodyOf(), options());
      throw new Error('expected handleCapture to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CaptureRequestError);
      expect((error as CaptureRequestError).kind).toBe('write_failed');
      expect((error as CaptureRequestError).filePath).toContain('Button.stories.ts');
    }
  });
});
