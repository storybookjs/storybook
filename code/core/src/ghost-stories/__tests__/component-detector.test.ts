import { describe, expect, it } from 'vitest';

import {
  analyzeComponentProps,
  detectReactComponents,
  extractComponentName,
  generateFakeValue,
  isComponentFile,
  shouldExcludeFile,
} from '../component-detector';

describe('ComponentDetector', () => {
  describe('isComponentFile', () => {
    it('should identify component files', () => {
      expect(isComponentFile('Button.tsx')).toBe(true);
      expect(isComponentFile('Button.jsx')).toBe(true);
      expect(isComponentFile('Button.ts')).toBe(true);
      expect(isComponentFile('Button.js')).toBe(true);
      expect(isComponentFile('Button.vue')).toBe(true);
      expect(isComponentFile('Button.svelte')).toBe(true);
    });

    it('should exclude story files', () => {
      expect(isComponentFile('Button.stories.tsx')).toBe(false);
      expect(isComponentFile('Button.test.tsx')).toBe(false);
      expect(isComponentFile('Button.spec.tsx')).toBe(false);
    });

    it('should exclude other file types', () => {
      expect(isComponentFile('Button.css')).toBe(false);
      expect(isComponentFile('Button.md')).toBe(false);
      expect(isComponentFile('Button.json')).toBe(false);
    });
  });

  describe('shouldExcludeFile', () => {
    it('should exclude story files', () => {
      expect(shouldExcludeFile('Button.stories.tsx')).toBe(true);
      expect(shouldExcludeFile('Button.stories.jsx')).toBe(true);
    });

    it('should exclude test files', () => {
      expect(shouldExcludeFile('Button.test.tsx')).toBe(true);
      expect(shouldExcludeFile('Button.spec.tsx')).toBe(true);
    });

    it('should exclude config files', () => {
      expect(shouldExcludeFile('Button.config.ts')).toBe(true);
      expect(shouldExcludeFile('Button.setup.ts')).toBe(true);
    });

    it('should exclude index files', () => {
      expect(shouldExcludeFile('index.ts')).toBe(true);
      expect(shouldExcludeFile('index.tsx')).toBe(true);
    });

    it('should exclude type definition files', () => {
      expect(shouldExcludeFile('Button.d.ts')).toBe(true);
    });

    it('should not exclude regular component files', () => {
      expect(shouldExcludeFile('Button.tsx')).toBe(false);
      expect(shouldExcludeFile('Button.jsx')).toBe(false);
    });
  });

  describe('extractComponentName', () => {
    it('should extract component name from file path', () => {
      expect(extractComponentName('Button.tsx')).toBe('Button');
      expect(extractComponentName('MyButton.tsx')).toBe('MyButton');
      expect(extractComponentName('my-button.tsx')).toBe('MyButton');
      expect(extractComponentName('my-awesome-button.tsx')).toBe('MyAwesomeButton');
    });
  });

  describe('detectReactComponents', () => {
    it('should detect default function exports', () => {
      const content = `
export default function Button() {
  return <button>Click me</button>;
}
`;
      const components = detectReactComponents('Button.tsx', content);
      expect(components).toContain('Button');
    });

    it('should detect named function exports', () => {
      const content = `
export function Button() {
  return <button>Click me</button>;
}

export function Icon() {
  return <span>Icon</span>;
}
`;
      const components = detectReactComponents('components.tsx', content);
      expect(components).toContain('Button');
      expect(components).toContain('Icon');
    });

    it('should detect const exports with arrow functions', () => {
      const content = `
export const Button = () => {
  return <button>Click me</button>;
};

export const Icon = () => <span>Icon</span>;
`;
      const components = detectReactComponents('components.tsx', content);
      expect(components).toContain('Button');
      expect(components).toContain('Icon');
    });

    it('should remove duplicates', () => {
      const content = `
export function Button() {
  return <button>Click me</button>;
}

export const Button = () => {
  return <button>Click me</button>;
};
`;
      const components = detectReactComponents('components.tsx', content);
      expect(components).toHaveLength(1);
      expect(components).toContain('Button');
    });

    it('should return empty array for non-component files', () => {
      const content = `
const utils = {
  formatDate: (date) => date.toISOString(),
};
`;
      const components = detectReactComponents('utils.ts', content);
      expect(components).toHaveLength(0);
    });
  });

  describe('analyzeComponentProps', () => {
    it('should analyze interface props', () => {
      const content = `
interface ButtonProps {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  count: number;
  items: string[];
  theme: 'light' | 'dark';
}

export const Button: React.FC<ButtonProps> = (props) => {
  return <button>{props.label}</button>;
};
`;
      const props = analyzeComponentProps(content, 'Button');

      expect(props).toHaveLength(6);

      const labelProp = props.find((p) => p.name === 'label');
      expect(labelProp).toMatchObject({
        name: 'label',
        type: { name: 'string', category: 'primitive' },
        required: true,
      });

      const disabledProp = props.find((p) => p.name === 'disabled');
      expect(disabledProp).toMatchObject({
        name: 'disabled',
        type: { name: 'boolean', category: 'primitive' },
        required: false,
      });

      const themeProp = props.find((p) => p.name === 'theme');
      expect(themeProp).toMatchObject({
        name: 'theme',
        type: {
          name: 'union',
          category: 'union',
          options: ['light', 'dark'],
        },
        required: true,
      });
    });

    it('should analyze type props', () => {
      const content = `
type ButtonProps = {
  label: string;
  disabled?: boolean;
};

export const Button: React.FC<ButtonProps> = (props) => {
  return <button>{props.label}</button>;
};
`;
      const props = analyzeComponentProps(content, 'Button');

      expect(props).toHaveLength(2);
      expect(props[0]).toMatchObject({
        name: 'label',
        type: { name: 'string', category: 'primitive' },
        required: true,
      });
    });

    it('should handle complex types', () => {
      const content = `
interface ComplexProps {
  user: { id: number; name: string };
  permissions: string[];
  onSave: (data: any) => void;
  status: 'loading' | 'success' | 'error';
}

export const ComplexComponent: React.FC<ComplexProps> = (props) => {
  return <div>{props.user.name}</div>;
};
`;
      const props = analyzeComponentProps(content, 'ComplexComponent');

      expect(props.length).toBeGreaterThan(0);

      const userProp = props.find((p) => p.name === 'user');
      if (userProp) {
        expect(userProp.type).toMatchObject({
          name: 'object',
          category: 'object',
        });
      }

      const permissionsProp = props.find((p) => p.name === 'permissions');
      if (permissionsProp) {
        expect(permissionsProp.type).toMatchObject({
          name: 'array',
          category: 'array',
        });
      }

      const onSaveProp = props.find((p) => p.name === 'onSave');
      if (onSaveProp) {
        expect(onSaveProp.type).toMatchObject({
          name: 'function',
          category: 'function',
        });
      }
    });
  });

  describe('generateFakeValue', () => {
    it('should generate appropriate fake values for primitive types', () => {
      expect(generateFakeValue({ name: 'string', category: 'primitive' })).toBe('Sample text');
      expect(generateFakeValue({ name: 'number', category: 'primitive' })).toBe(42);
      expect(generateFakeValue({ name: 'boolean', category: 'primitive' })).toBe(false);
    });

    it('should generate appropriate fake values for complex types', () => {
      expect(generateFakeValue({ name: 'array', category: 'array' })).toEqual([]);
      expect(generateFakeValue({ name: 'function', category: 'function' })).toBeInstanceOf(
        Function
      );
      expect(generateFakeValue({ name: 'object', category: 'object' })).toEqual({});
    });

    it('should generate appropriate fake values for union types', () => {
      const unionType = {
        name: 'union',
        category: 'union' as const,
        options: ['option1', 'option2', 'option3'],
      };
      expect(generateFakeValue(unionType)).toBe('option1');
    });

    it('should handle union types without options', () => {
      const unionType = {
        name: 'union',
        category: 'union' as const,
      };
      expect(generateFakeValue(unionType)).toBe('Sample value');
    });
  });
});
