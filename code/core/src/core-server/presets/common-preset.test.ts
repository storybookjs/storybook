import { expect, it, describe, vi } from 'vitest';
import type { Configuration } from 'webpack';
import { webpackFinal } from './common-preset';

// Mock findConfigFile
vi.mock('storybook/internal/common', () => ({
  findConfigFile: vi.fn(),
}));

// Mock the webpack plugins
vi.mock('./webpack/plugins/webpack-mock-plugin', () => ({
  WebpackMockPlugin: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('./webpack/plugins/webpack-inject-mocker-runtime-plugin', () => ({
  WebpackInjectMockerRuntimePlugin: vi.fn().mockImplementation(() => ({})),
}));

describe('webpackFinal mock loader rule', () => {
  const createMockConfig = (): Configuration => ({
    module: {
      rules: [],
    },
    plugins: [],
  });

  const mockOptions = {
    configDir: '.storybook',
  } as any;

  it('should add mock loader rule that only matches preview config files', async () => {
    const { findConfigFile } = await import('storybook/internal/common');
    vi.mocked(findConfigFile).mockReturnValue('.storybook/preview.ts');

    const config = createMockConfig();
    const result = await webpackFinal(config, mockOptions);

    // Find the mock loader rule
    const mockLoaderRule = result.module!.rules!.find((rule: any) => 
      rule.use?.[0]?.loader?.includes('storybook-mock-transform-loader')
    ) as any;

    expect(mockLoaderRule).toBeDefined();
    expect(mockLoaderRule.test).toBeDefined();

    // Test that the regex only matches actual preview config files
    const regex = mockLoaderRule.test;
    
    // Should match actual preview config files (with path separators)
    expect(regex.test('.storybook/preview.ts')).toBe(true);
    expect(regex.test('.storybook/preview.js')).toBe(true);
    expect(regex.test('.storybook/preview.tsx')).toBe(true);
    expect(regex.test('.storybook/preview.jsx')).toBe(true);
    expect(regex.test('config/preview.ts')).toBe(true);
    
    // Should NOT match component files that happen to end with "preview"
    expect(regex.test('my-orders-preview.ts')).toBe(false);
    expect(regex.test('components/user-profile-preview.tsx')).toBe(false);
    expect(regex.test('src/pages/dashboard-preview.js')).toBe(false);
    expect(regex.test('lib/utils/data-preview.ts')).toBe(false);
    expect(regex.test('some-component-preview.jsx')).toBe(false);
    
    // Verify the exact regex pattern
    expect(regex.toString()).toBe('/[\/\\\\]preview\\.(t|j)sx?$/');
  });

  it('should not add mock loader rule when no preview config exists', async () => {
    const { findConfigFile } = await import('storybook/internal/common');
    vi.mocked(findConfigFile).mockReturnValue(null);

    const config = createMockConfig();
    const result = await webpackFinal(config, mockOptions);

    // Should not add any mock loader rules
    const mockLoaderRule = result.module!.rules!.find((rule: any) => 
      rule.use?.[0]?.loader?.includes('storybook-mock-transform-loader')
    );

    expect(mockLoaderRule).toBeUndefined();
  });
});