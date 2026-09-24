import { describe, expect, it } from 'vitest';

import { opaqueFileDiagnostic } from './react-dom-shim-file.ts';

describe('opaqueFileDiagnostic', () => {
  it.each([
    ['.browserslistrc', 'defaults and fully supports es6-module'],
    ['.circleci/config.yml', 'version: 2.1\njobs: {}\n'],
    ['scripts/check.sh', '#!/bin/sh\necho ready\n'],
    ['guide.mdx', '# Guide\n<Component answer={40 + 2} />\n'],
    ['broken.mdx', '# Guide\n<Component answer={\n'],
    ['logo.svg', '<svg><path d="M0 0h10v10z" /></svg>'],
    ['.toolrc', '@storybook/addon-a11y'],
  ])('accepts no-signal opaque text in %s', (filePath, source) => {
    expect(opaqueFileDiagnostic(source, `/project/${filePath}`)).toBeUndefined();
  });

  it.each([
    ['guide.mdx', "import '@storybook/react-dom-shim'"],
    ['scripts/check.sh', 'name="@storybook/react-dom-\\x73him"'],
    ['config.yml', 'package: "@storybook/react-dom-\\u0073him"'],
    ['config.yaml', 'package: "@storybook/react-dom-\\u{73}him"'],
    ['.toolrc', 'package=@storybook/react-dom-%73him'],
    ['logo.svg', '<text>@storybook/react-dom-&#115;him</text>'],
    ['logo.svg', '<text>@storybook/react-dom-&#x73;him</text>'],
    ['config.yml', "parts: ['@storybook', 'react', 'dom', 'shim']"],
    ['config.yml', 'package: "@storybook/react-dom-\\u{110000}shim"'],
    ['scripts/check.sh', 'package="@storybook/react-dom-\\xZZshim"'],
  ])('refuses static shim spellings in %s', (filePath, source) => {
    expect(opaqueFileDiagnostic(source, `/project/${filePath}`)).toBe(
      `/project/${filePath}: contains a possible react-dom-shim consumer that cannot be removed safely`
    );
  });

  it.each([
    ['guide.mdx', 'import(name)'],
    ['scripts/check.sh', 'require(name)'],
    ['config.yml', 'loader: require.resolve'],
    ['.toolrc', 'factory: createRequire'],
    ['notes', 'loader: module.require'],
    ['config.yaml', 'loader: import.meta.resolve'],
  ])('refuses loader capabilities in %s', (filePath, source) => {
    expect(opaqueFileDiagnostic(source, `/project/${filePath}`)).toBeDefined();
  });

  it.each([
    ['<svg><script>run()</script></svg>'],
    ['<svg onload="run()"></svg>'],
    ['<svg><a href="javascript:run()">run</a></svg>'],
    ['<svg><foreignObject /></svg>'],
    ['<svg><iframe /></svg>'],
    ['<svg><object /></svg>'],
    ['<svg><embed /></svg>'],
  ])('refuses executable SVG', (source) => {
    expect(opaqueFileDiagnostic(source, '/project/logo.svg')).toBeDefined();
  });

  it('ignores an invalid encoding that does not participate in a shim candidate', () => {
    expect(opaqueFileDiagnostic('value: "\\u{110000}"', '/project/config.yml')).toBeUndefined();
  });
});
