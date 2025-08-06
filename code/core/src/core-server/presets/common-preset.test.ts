import { expect, it, describe, vi } from 'vitest';
import type { Configuration } from 'webpack';
import { webpackFinal, viteFinal } from './common-preset';

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

// Mock the vite plugins  
vi.mock('./vitePlugins/vite-inject-mocker/plugin', () => ({
  viteInjectMockerRuntime: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('./vitePlugins/vite-mock/plugin', () => ({
  viteMockPlugin: vi.fn().mockImplementation(() => ({})),
}));

describe('webpackFinal mock loader rule', () => {
  const createMockConfig = (): Configuration => ({
    module: {
      rules: [],
    },
    plugins: [],
  });

  const createMockOptions = (coreOptions = {}) => ({
    configDir: '.storybook',
    presets: {
      apply: vi.fn().mockResolvedValue(coreOptions),
    },
  } as any);

  it('should add mock loader rule that only matches preview config files', async () => {
    const { findConfigFile } = await import('storybook/internal/common');
    vi.mocked(findConfigFile).mockReturnValue('.storybook/preview.ts');

    const config = createMockConfig();
    const options = createMockOptions();
    const result = await webpackFinal(config, options);

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
    const options = createMockOptions();
    const result = await webpackFinal(config, options);

    // Should not add any mock loader rules
    const mockLoaderRule = result.module!.rules!.find((rule: any) => 
      rule.use?.[0]?.loader?.includes('storybook-mock-transform-loader')
    );

    expect(mockLoaderRule).toBeUndefined();
  });

  it('should not add mock loader rule when mocking is disabled', async () => {
    const { findConfigFile } = await import('storybook/internal/common');
    vi.mocked(findConfigFile).mockReturnValue('.storybook/preview.ts');

    const config = createMockConfig();
    const options = createMockOptions({ disableMocking: true });
    const result = await webpackFinal(config, options);

    // Should not add any mock loader rules when mocking is disabled
    const mockLoaderRule = result.module!.rules!.find((rule: any) => 
      rule.use?.[0]?.loader?.includes('storybook-mock-transform-loader')
    );

    expect(mockLoaderRule).toBeUndefined();
  });
});

describe('viteFinal mock plugins', () => {
  const createMockViteConfig = () => ({
    plugins: [],
  });

  const createMockOptions = (coreOptions = {}) => ({
    configDir: '.storybook',
    presets: {
      apply: vi.fn().mockResolvedValue(coreOptions),
    },
  } as any);

  it('should add mock plugins when preview config exists', async () => {
    const { findConfigFile } = await import('storybook/internal/common');
    const { viteInjectMockerRuntime } = await import('./vitePlugins/vite-inject-mocker/plugin');
    const { viteMockPlugin } = await import('./vitePlugins/vite-mock/plugin');
    
    vi.mocked(findConfigFile).mockReturnValue('.storybook/preview.ts');

    const config = createMockViteConfig();
    const options = createMockOptions();
    const result = await viteFinal(config, options);

    expect(viteInjectMockerRuntime).toHaveBeenCalledWith({ previewConfigPath: '.storybook/preview.ts' });
    expect(viteMockPlugin).toHaveBeenCalledWith({ 
      previewConfigPath: '.storybook/preview.ts', 
      coreOptions: {}, 
      configDir: '.storybook' 
    });
  });

  it('should not add mock plugins when no preview config exists', async () => {
    const { findConfigFile } = await import('storybook/internal/common');
    const { viteInjectMockerRuntime } = await import('./vitePlugins/vite-inject-mocker/plugin');
    const { viteMockPlugin } = await import('./vitePlugins/vite-mock/plugin');
    
    vi.mocked(findConfigFile).mockReturnValue(null);

    const config = createMockViteConfig();
    const options = createMockOptions();
    const result = await viteFinal(config, options);

    expect(viteInjectMockerRuntime).not.toHaveBeenCalled();
    expect(viteMockPlugin).not.toHaveBeenCalled();
  });

  it('should not add mock plugins when mocking is disabled', async () => {
    const { findConfigFile } = await import('storybook/internal/common');
    const { viteInjectMockerRuntime } = await import('./vitePlugins/vite-inject-mocker/plugin');
    const { viteMockPlugin } = await import('./vitePlugins/vite-mock/plugin');
    
    vi.mocked(findConfigFile).mockReturnValue('.storybook/preview.ts');

    const config = createMockViteConfig();
    const options = createMockOptions({ disableMocking: true });
    const result = await viteFinal(config, options);

    expect(viteInjectMockerRuntime).not.toHaveBeenCalled();
    expect(viteMockPlugin).not.toHaveBeenCalled();
  });
});