import { describe, it, expect, vi } from 'vitest';
import { externalGlobalsPlugin } from './external-globals-plugin';
import { injectExportOrderPlugin } from './inject-export-order-plugin';
import { stripStoryHMRBoundary } from './strip-story-hmr-boundaries';

describe('Native MagicString Support', () => {
  describe('external-globals-plugin', () => {
    it('should use native MagicString when available', async () => {
      const plugin = await externalGlobalsPlugin({ 'react': '__REACT__' });
      const transform = (plugin as any).transform;
      
      const mockMagicString = {
        slice: vi.fn().mockReturnValue('import React from "react"'),
        update: vi.fn(),
      };
      
      const meta = { magicString: mockMagicString };
      const code = 'import React from "react"; const a = 1;';
      
      const result = await transform.handler(code, 'test.js', meta);
      
      // Should return the magicString object directly, not toString()
      expect(result?.code).toBe(mockMagicString);
      expect(result?.map).toBeUndefined();
    });
    
    it('should fallback to regular MagicString when not available', async () => {
      const plugin = await externalGlobalsPlugin({ 'react': '__REACT__' });
      const transform = (plugin as any).transform;
      
      const code = 'import React from "react"; const a = 1;';
      const result = await transform.handler(code, 'test.js', undefined);
      
      // Should return a string when no native MagicString
      expect(typeof result?.code).toBe('string');
      expect(result?.map).toBeNull();
    });
  });
  
  describe('inject-export-order-plugin', () => {
    it('should use native MagicString when available', async () => {
      const plugin = await injectExportOrderPlugin();
      const transform = (plugin as any).transform;
      
      const mockMagicString = {
        append: vi.fn(),
      };
      
      const meta = { magicString: mockMagicString };
      const code = 'export const Button = () => {}; export const Input = () => {};';
      
      const result = await transform.handler(code, 'test.stories.js', meta);
      
      // Should return the magicString object directly
      expect(result?.code).toBe(mockMagicString);
      expect(result?.map).toBeUndefined();
      expect(mockMagicString.append).toHaveBeenCalled();
    });
  });
  
  describe('strip-story-hmr-boundaries', () => {
    it('should use native MagicString when available', async () => {
      const plugin = await stripStoryHMRBoundary();
      const transform = (plugin as any).transform;
      
      const mockMagicString = {
        replace: vi.fn(),
      };
      
      const meta = { magicString: mockMagicString };
      const code = 'import.meta.hot.accept(); export const Story = () => {};';
      
      const result = await transform.handler(code, 'test.stories.js', meta);
      
      // Should return the magicString object directly
      expect(result?.code).toBe(mockMagicString);
      expect(result?.map).toBeUndefined();
      expect(mockMagicString.replace).toHaveBeenCalled();
    });
  });
});
