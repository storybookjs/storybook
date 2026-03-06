const os = require('os');
const fs = require('fs');
const path = require('path');

const swcrc = JSON.parse(fs.readFileSync('.swcrc', 'utf8'));

/**
 * TODO: Some windows related tasks are still commented out, because they are behaving differently on
 * a local Windows machine compared to the Windows Server 2022 machine running in GitHub Actions.
 * The main issue is that path.sep is behaving differently on the two machines. Some more investagations
 * are necessary!
 * */
const skipOnWindows = [
  'lib/core-server/src/utils/__tests__/server-statics.test.ts',
  'lib/core-common/src/utils/__tests__/template.test.ts',
  'addons/storyshots-core/src/frameworks/configure.test.ts',
  'lib/core-common/src/utils/__tests__/interpret-files.test.ts',
  'lib/cli/src/helpers.test.ts',
  'lib/csf-tools/src/enrichCsf.test.ts',
];

const modulesToTransform = [
  '@angular',
  '@lit',
  '@mdx-js',
  '@vitest',
  'ccount',
  'character-entities',
  'decode-named-character-reference',
  'estree',
  'is-absolute-url',
  'lit-html',
  'lit',
  'mdast',
  'micromark',
  'nanoid',
  'node-fetch',
  'remark',
  'rxjs',
  'data-uri-to-buffer',
  'fetch-blob',
  'formdata-polyfill',
  'slash',
  'space-separated-tokens',
  'stringify-entities',
  'unified',
  'unist',
  'uuid',
  'vfile-message',
  'vfile',
  'zwitch',
];

/** @type { import('jest').Config } */
module.exports = {
  cacheDirectory: path.resolve('.cache/jest'),
  clearMocks: true,
  moduleNameMapper: {
    // non-js files
    '\\.(jpg|jpeg|png|apng|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      path.resolve('./__mocks__/fileMock.js'),
    '\\.(css|scss|stylesheet)$': path.resolve('./__mocks__/styleMock.js'),
    '\\.(md)$': path.resolve('./__mocks__/htmlMock.js'),
    '@vitest/utils/(.*)': '@vitest/utils/dist/$1.js',
    '@vitest/utils': '@vitest/utils/dist/index.js',
  },
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', swcrc],
    '^.+\\.mdx$': '@storybook/addon-docs/jest-transform-mdx',
  },
  transformIgnorePatterns: [`(?<!node_modules.+)node_modules/(?!${modulesToTransform.join('|')})`],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: [
    '/storybook-static/',
    '/node_modules/',
    '/dist/',
    '/prebuilt/',
    '/template/',
    'addon-jest.test.js',
    // TODO: Can not get svelte-jester to work, but also not necessary for this test, as it is run by tsc/svelte-check.
    '/renderers/svelte/src/public-types.test.ts',
    '/renderers/vue/src/public-types.test.ts',
    '/renderers/vue3/src/public-types.test.ts',
    ...(process.platform === 'win32' ? skipOnWindows : []),
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/cli/test/',
    '/dist/',
    '/prebuilt/',
    '/generators/',
    '/template/',
    // The export format used in the following file is not supported by jest.
    '/code/frameworks/nextjs/src/next-image-loader-stub.ts',
    '/__mocks__ /',
    '/__mockdata__/',
    '/__mocks-ng-workspace__/',
    '/__testfixtures__/',
    '^.*\\.stories\\.[jt]sx?$',
    'typings.d.ts$',
  ],
  globals: {
    PREVIEW_URL: undefined,
    SNAPSHOT_OS: os.platform() === 'win32' ? 'windows' : 'posix',
  },
  snapshotSerializers: ['@emotion/jest/serializer', 'jest-serializer-html'],
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
  modulePathIgnorePatterns: [
    //
    '/dist/.*/__mocks__/',
    '/storybook-static/',
    '/template/',
  ],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true,
  },
};
