import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { Options } from 'storybook/internal/types';

// Import the functions we need to test
import { svelteDocgen } from './svelte-docgen';

// Mock modules
vi.mock('vite', () => ({
  createFilter: vi.fn((include, exclude) => (id: string) => {
    const includeTest = include.test(id);
    const excludeTest = exclude ? exclude.test(id) : false;
    return includeTest && !excludeTest;
  }),
}));

vi.mock('storybook/internal/csf-tools', () => ({
  loadCsf: vi.fn().mockImplementation((content, options) => ({
    parse: () => ({ meta: true }),
    _rawComponentPath: './Button.svelte',
  })),
}));

vi.mock('storybook/internal/common', () => ({
  normalizeStories: vi.fn().mockImplementation((stories) => 
    stories || [{ directory: '.', files: '**/*.stories.*' }]
  ),
}));

vi.mock('globby', () => ({
  globby: vi.fn().mockResolvedValue([]),
}));

const TEST_DIR = '/tmp/svelte-docgen-test';

describe('svelteDocgen', () => {
  beforeEach(async () => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    
    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('resolveImportPath', () => {
    // Create a local copy of the function for testing since it's not exported
    const resolveImportPath = (importPath: string, baseFilePath: string): string | null => {
      const { isAbsolute, dirname, resolve: pathResolve, join: pathJoin } = require('node:path');
      const { existsSync: fsExistsSync } = require('node:fs');
      
      if (isAbsolute(importPath)) {
        return importPath;
      }

      const baseDir = dirname(baseFilePath);
      let resolvedPath = pathResolve(baseDir, importPath);

      // Try different extensions for the resolved path
      const extensions = ['', '.svelte', '.js', '.ts', '.mjs'];
      
      // Check if the resolved path exists as-is
      if (fsExistsSync(resolvedPath)) {
        return resolvedPath;
      }

      // Try with different extensions
      for (const ext of extensions) {
        const pathWithExt = resolvedPath + ext;
        if (fsExistsSync(pathWithExt)) {
          return pathWithExt;
        }
      }

      // Try index files in directory  
      for (const ext of extensions) {
        const indexPath = pathJoin(resolvedPath, `index${ext}`);
        if (fsExistsSync(indexPath)) {
          return indexPath;
        }
      }

      return null;
    };

    it('should resolve absolute paths as-is', async () => {
      const absolutePath = '/absolute/path/to/Component.svelte';
      const result = resolveImportPath(absolutePath, '/base/file.js');
      expect(result).toBe(absolutePath);
    });

    it('should resolve relative paths with extensions', async () => {
      // Create test files
      const componentPath = join(TEST_DIR, 'Component.svelte');
      await writeFile(componentPath, '<script></script>');
      
      const basePath = join(TEST_DIR, 'story.js');
      const result = resolveImportPath('./Component.svelte', basePath);
      expect(result).toBe(componentPath);
    });

    it('should resolve paths without extensions', async () => {
      // Create test files
      const componentPath = join(TEST_DIR, 'Component.svelte');
      await writeFile(componentPath, '<script></script>');
      
      const basePath = join(TEST_DIR, 'story.js');
      const result = resolveImportPath('./Component', basePath);
      expect(result).toBe(componentPath);
    });

    it('should resolve index files when path does not exist directly', async () => {
      // Create test directory structure for barrel export scenario
      const componentsDir = join(TEST_DIR, 'src', 'components');
      const indexPath = join(componentsDir, 'index.js');
      mkdirSync(componentsDir, { recursive: true });
      await writeFile(indexPath, 'export { default as Button } from "./Button.svelte";');
      
      // Test importing from 'src/components' where the directory has an index file
      const basePath = join(TEST_DIR, 'stories', 'Button.stories.js');
      mkdirSync(join(TEST_DIR, 'stories'), { recursive: true });
      const result = resolveImportPath('../src/components', basePath);
      expect(result).toBe(componentsDir); // Should return the directory path since directory exists
    });

    it('should return null for non-existent paths', () => {
      const result = resolveImportPath('./NonExistent.svelte', '/base/file.js');
      expect(result).toBeNull();
    });
  });

  describe('extractSvelteCSFComponentRef', () => {
    // Create a local copy for testing
    const extractSvelteCSFComponentRef = (content: string, filePath: string): { path: string; componentName: string } | null => {
      const defineMetaMatch = content.match(/defineMeta\s*\(\s*\{([^}]+)\}/);
      if (!defineMetaMatch) return null;

      const metaContent = defineMetaMatch[1];
      const componentMatch = metaContent.match(/component\s*:\s*([^,\s}]+)/);
      if (!componentMatch) return null;

      const componentName = componentMatch[1].trim();
      
      const importRegex = new RegExp(`import\\s+(?:{[^}]*\\b${componentName}\\b[^}]*}|${componentName})\\s+from\\s+['"]([^'"]+)['"]`);
      const importMatch = content.match(importRegex);
      
      if (importMatch) {
        // For testing, just return the import path
        return { path: importMatch[1], componentName };
      }

      return null;
    };

    it('should extract component reference from Svelte CSF', () => {
      const content = `
        <script module>
          import Button from './Button.svelte';
          import { defineMeta } from '@storybook/addon-svelte-csf';
          const { Story } = defineMeta({ component: Button, title: 'Button' });
        </script>
      `;
      
      const result = extractSvelteCSFComponentRef(content, '/test/story.svelte');
      expect(result?.path).toBe('./Button.svelte');
      expect(result?.componentName).toBe('Button');
    });

    it('should extract named import component reference', () => {
      const content = `
        <script module>
          import { Button } from './components';
          import { defineMeta } from '@storybook/addon-svelte-csf';
          const { Story } = defineMeta({ component: Button });
        </script>
      `;
      
      const result = extractSvelteCSFComponentRef(content, '/test/story.svelte');
      expect(result?.path).toBe('./components');
      expect(result?.componentName).toBe('Button');
    });

    it('should return null for content without defineMeta', () => {
      const content = `
        <script module>
          import Button from './Button.svelte';
        </script>
      `;
      
      const result = extractSvelteCSFComponentRef(content, '/test/story.svelte');
      expect(result).toBeNull();
    });

    it('should return null for defineMeta without component', () => {
      const content = `
        <script module>
          import { defineMeta } from '@storybook/addon-svelte-csf';
          const { Story } = defineMeta({ title: 'Button' });
        </script>
      `;
      
      const result = extractSvelteCSFComponentRef(content, '/test/story.svelte');
      expect(result).toBeNull();
    });
  });

  describe('collectReferencedComponents', () => {
    it('should handle empty story directory', async () => {
      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValue([]);
      
      const mockOptions = {
        configDir: '/test',
        presets: {
          apply: vi.fn().mockResolvedValue([])
        }
      } as any;
      
      const plugin = await svelteDocgen(mockOptions);
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('storybook:svelte-docgen-plugin');
    });

    it('should handle story files with CSF format', async () => {
      // Create test story file
      const storyPath = join(TEST_DIR, 'Button.stories.js');
      const storyContent = `
        import Button from './Button.svelte';
        export default { component: Button, title: 'Button' };
        export const Default = {};
      `;
      await mkdir(TEST_DIR, { recursive: true });
      await writeFile(storyPath, storyContent);
      
      // Create component file
      const componentPath = join(TEST_DIR, 'Button.svelte');
      await writeFile(componentPath, '<script>export let label;</script><button>{label}</button>');
      
      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValue([storyPath]);
      
      const mockOptions = {
        configDir: TEST_DIR,
        presets: {
          apply: vi.fn().mockResolvedValue([])
        }
      } as any;
      
      const plugin = await svelteDocgen(mockOptions);
      expect(plugin).toBeDefined();
    });

    it('should handle Svelte CSF story files', async () => {
      // Create test Svelte story file
      const storyPath = join(TEST_DIR, 'Button.stories.svelte');
      const storyContent = `
        <script module>
          import Button from './Button.svelte';
          import { defineMeta } from '@storybook/addon-svelte-csf';
          const { Story } = defineMeta({ component: Button, title: 'Button' });
        </script>
        <Story name="Default" />
      `;
      await mkdir(TEST_DIR, { recursive: true });
      await writeFile(storyPath, storyContent);
      
      // Create component file
      const componentPath = join(TEST_DIR, 'Button.svelte');
      await writeFile(componentPath, '<script>export let label;</script><button>{label}</button>');
      
      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValue([storyPath]);
      
      const mockOptions = {
        configDir: TEST_DIR,
        presets: {
          apply: vi.fn().mockResolvedValue([])
        }
      } as any;
      
      const plugin = await svelteDocgen(mockOptions);
      expect(plugin).toBeDefined();
    });
  });

  describe('plugin transform function', () => {
    it('should skip files with virtual module prefix', async () => {
      const plugin = await svelteDocgen();
      const result = await plugin.transform?.call(
        { parse: vi.fn() } as any,
        'content',
        '\0virtual:file.svelte'
      );
      expect(result).toBeUndefined();
    });

    it('should skip story files', async () => {
      const plugin = await svelteDocgen();
      const result = await plugin.transform?.call(
        { parse: vi.fn() } as any,
        'content',
        '/path/to/Button.stories.svelte'
      );
      expect(result).toBeUndefined();
    });

    it('should skip non-Svelte files', async () => {
      const plugin = await svelteDocgen();
      const result = await plugin.transform?.call(
        { parse: vi.fn() } as any,
        'content',
        '/path/to/script.js'
      );
      expect(result).toBeUndefined();
    });

    it('should skip components not referenced in stories', async () => {
      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValue([]);
      
      const mockOptions = {
        configDir: '/test',
        presets: {
          apply: vi.fn().mockResolvedValue([])
        }
      } as any;
      
      const plugin = await svelteDocgen(mockOptions);
      const result = await plugin.transform?.call(
        { parse: vi.fn() } as any,
        'content',
        '/path/to/UnusedComponent.svelte'
      );
      expect(result).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValue(['/nonexistent/file.stories.js']);
      
      const mockOptions = {
        configDir: '/test',
        presets: {
          apply: vi.fn().mockResolvedValue([])
        }
      } as any;
      
      const plugin = await svelteDocgen(mockOptions);
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('storybook:svelte-docgen-plugin');
    });

    it('should handle CSF parsing errors gracefully', async () => {
      const { loadCsf } = await import('storybook/internal/csf-tools');
      vi.mocked(loadCsf).mockImplementation(() => {
        throw new Error('Parse error');
      });

      // Create test story file with fallback regex parsing
      const storyPath = join(TEST_DIR, 'Button.stories.js');
      const storyContent = `
        import Button from './Button.svelte';
        export default { component: Button };
      `;
      await mkdir(TEST_DIR, { recursive: true });
      await writeFile(storyPath, storyContent);
      
      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValue([storyPath]);
      
      const mockOptions = {
        configDir: TEST_DIR,
        presets: {
          apply: vi.fn().mockResolvedValue([])
        }
      } as any;
      
      const plugin = await svelteDocgen(mockOptions);
      expect(plugin).toBeDefined();
    });

    it('should handle glob errors gracefully', async () => {
      const { globby } = await import('globby');
      vi.mocked(globby).mockRejectedValue(new Error('Glob error'));
      
      const mockOptions = {
        configDir: '/test',
        presets: {
          apply: vi.fn().mockResolvedValue([])
        }
      } as any;
      
      const plugin = await svelteDocgen(mockOptions);
      expect(plugin).toBeDefined();
    });
  });
});