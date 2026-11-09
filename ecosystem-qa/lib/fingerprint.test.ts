import { describe, expect, it } from 'vitest';

import { fingerprint, normalizeErrorSignature } from './fingerprint.ts';
import type { Finding } from './types.ts';

const finding = (errorText: string): Finding => ({
  checkId: 'core.dev-server',
  title: 'Dev server fails to start',
  baseline: 'pass',
  expected: 'The dev server starts',
  actual: 'The dev server exits',
  errorText,
  reproSteps: ['yarn storybook'],
  evidence: { logs: [] },
  windowsOnly: false,
});

describe('normalizeErrorSignature', () => {
  it('keeps the package path under node_modules and strips the checkout prefix, versions, line:col and whitespace runs', () => {
    const linux = normalizeErrorSignature(
      'Error: Cannot read  properties of undefined\n    at /home/agent/workspace/node_modules/storybook/dist/core-server/index.js:1204:17 (storybook 11.0.0-beta.0)'
    );
    const windows = normalizeErrorSignature(
      'Error: Cannot read properties of undefined\r\n  at C:\\a\\mealdrop\\node_modules\\storybook\\dist\\core-server\\index.js:88:3 (storybook 11.0.1)'
    );

    expect(linux).toBe(
      'error: cannot read properties of undefined at node_modules/storybook/dist/core-server/index.js (storybook <version>)'
    );
    expect(windows).toBe(linux);
  });

  it('keeps the last two segments of a project file path', () => {
    expect(
      normalizeErrorSignature(
        'Failed to load /home/agent/workspace/.storybook/main.ts and ./src/Button.stories.tsx:12:4 and D:\\a\\x\\vite.config.ts'
      )
    ).toBe('failed to load .storybook/main.ts and src/button.stories.tsx and x/vite.config.ts');
  });

  it('tells the same message apart when it names different files', () => {
    const createJs = fingerprint(
      finding(
        '[MISSING_EXPORT] "css" is not exported by "node_modules/storybook/dist/theming/create.js".'
      ),
      'owned'
    );
    const blocksJs = fingerprint(
      finding(
        '[MISSING_EXPORT] "css" is not exported by "node_modules/@storybook/addon-docs/dist/blocks.js".'
      ),
      'owned'
    );

    expect(createJs).not.toBe(blocksJs);
  });

  it('strips commit and chunk hashes but keeps package names', () => {
    expect(
      normalizeErrorSignature(
        "Failed to resolve '@storybook/addon-docs' from chunk 3f9c2ab81d (build a1b2c3d4e5f6)"
      )
    ).toBe("failed to resolve '@storybook/addon-docs' from chunk <hash> (build <hash>)");
  });
});

describe('fingerprint', () => {
  it('is equal for the same failure on different Storybook versions and machines', () => {
    const onBeta = fingerprint(
      finding('Missing addon at /home/runner/work/x/node_modules/a.js:3:9 in 11.0.0-beta.0'),
      'owned'
    );
    const onRc = fingerprint(
      finding('Missing addon at D:\\a\\x\\node_modules\\a.js:4:1 in 11.0.0-rc.2'),
      'owned'
    );

    expect(onBeta).toMatch(/^[0-9a-f]{16}$/);
    expect(onRc).toBe(onBeta);
  });

  it('differs by check, repo class and error', () => {
    const base = finding('Missing addon');

    expect(fingerprint(base, 'owned')).not.toBe(fingerprint(base, 'tier1'));
    expect(fingerprint(base, 'owned')).not.toBe(
      fingerprint({ ...base, checkId: 'build.static' }, 'owned')
    );
    expect(fingerprint(base, 'owned')).not.toBe(fingerprint(finding('Missing preset'), 'owned'));
  });
});
