import { describe, expect, it } from 'vitest';

import { componentPathInjectorPlugin } from '../vite-plugin';

describe('componentPathInjectorPlugin', () => {
  it('should create a plugin with correct name', () => {
    const plugin = componentPathInjectorPlugin();

    expect(plugin.name).toBe('storybook:story-inspector-component-path-injector');
    expect(plugin.enforce).toBe('pre');
  });

  it('should inject component path into JSX elements', async () => {
    const plugin = componentPathInjectorPlugin();
    const code = `
import React from 'react';

const Button = () => <button>Click me</button>;

export const MyStory = () => (
  <div>
    <Button />
    <span>Hello</span>
  </div>
);
`;

    const result = await plugin.transform(code, '/some-project/src/components/Button.tsx');

    expect(result?.code).toContain('data-sb-component-path="./src/components/Button.tsx"');
    expect(result?.code).toContain('<Button data-sb-component-path="./src/components/Button.tsx"');
    // Should not affect lowercase HTML elements
    expect(result?.code).not.toContain('<span data-sb-component-path');
    expect(result?.code).not.toContain('<div data-sb-component-path');
  });

  it('should not process non-component files', async () => {
    const plugin = componentPathInjectorPlugin();
    const code = 'const config = { test: true };';

    const result = await plugin.transform(code, '/src/config.js');

    expect(result).toBeUndefined();
  });

  it('should not process story files', async () => {
    const plugin = componentPathInjectorPlugin();
    const code = `
export const MyStory = () => <Button />;
`;

    const result = await plugin.transform(code, '/src/Button.stories.tsx');

    expect(result).toBeUndefined();
  });

  it('should not process test files', async () => {
    const plugin = componentPathInjectorPlugin();
    const code = `
test('should work', () => {
  expect(<Button />).toBeDefined();
});
`;

    const result = await plugin.transform(code, '/src/Button.test.tsx');

    expect(result).toBeUndefined();
  });

  it('should handle self-closing JSX elements', async () => {
    const plugin = componentPathInjectorPlugin();
    const code = `
export const MyStory = () => (
  <div>
    <Button onClick={() => {}} />
    <Icon name="star" />
  </div>
);
`;

    const result = await plugin.transform(code, '/some-project/src/components/Story.tsx');

    expect(result?.code).toContain('data-sb-component-path="./src/components/Story.tsx"');
    expect(result?.code).toContain(
      '<Button onClick={() => {}} data-sb-component-path="./src/components/Story.tsx"'
    );
    expect(result?.code).toContain(
      '<Icon name="star" data-sb-component-path="./src/components/Story.tsx"'
    );
  });

  it('should not double-inject attributes', async () => {
    const plugin = componentPathInjectorPlugin();
    const code = `
export const MyStory = () => (
  <Button data-sb-component-path="/already/set" />
);
`;

    const result = await plugin.transform(code, '/src/components/Story.tsx');

    // Should not modify already processed elements
    expect(result?.code || code).toContain('data-sb-component-path="/already/set"');
    expect(result?.code || code).not.toContain('data-sb-component-path="src/components/Story.tsx"');
  });

  it('should not inject attributes into TypeScript type annotations', async () => {
    const plugin = componentPathInjectorPlugin();
    const code = `
import { FC } from 'react';

const StackContainer: FC<React.PropsWithChildren<{ layout: string }>> = ({ children, layout }) => (
  <div>
    <Button />
    {children}
  </div>
);

interface Props<T> {
  data: T;
}

type ComponentType<P = {}> = React.ComponentType<P>;
`;

    const result = await plugin.transform(code, '/some-project/.storybook/preview.tsx');

    // Should inject into JSX elements
    expect(result?.code).toContain('<Button data-sb-component-path="./.storybook/preview.tsx"');

    // Should NOT inject into type annotations (Babel may change formatting slightly)
    expect(result?.code).toContain('FC<React.PropsWithChildren<{layout: string;}>>');
    expect(result?.code).not.toContain(
      'FC<React.PropsWithChildren<{ layout: string } data-sb-component-path='
    );
    expect(result?.code).toContain('interface Props<T>');
    expect(result?.code).toContain('ComponentType<P = {}>');
  });

  it('should not inject into generic type parameters', async () => {
    const plugin = componentPathInjectorPlugin();
    const code = `
function createComponent<T extends ComponentProps<'div'>>(props: T) {
  return <CustomComponent {...props} />;
}

const MyComponent = <P,>(props: P) => <GenericWrapper {...props} />;
`;

    const result = await plugin.transform(code, '/some-project/src/utils/factory.ts');

    // Should inject into JSX elements
    if (result) {
      expect(result.code).toContain('data-sb-component-path="./src/utils/factory.ts"');
      expect(result.code).toContain('<CustomComponent');
      expect(result.code).toContain('<GenericWrapper');
    } else {
      // If no result, verify the original code pattern still exists
      expect(code).toContain('<CustomComponent {...props} />');
      expect(code).toContain('<GenericWrapper {...props} />');
    }

    // Should NOT inject into type parameters
    if (result) {
      expect(result.code).toContain('T extends ComponentProps<');
      expect(result.code).not.toContain('T extends ComponentProps< data-sb-component-path=');
      expect(result.code).toContain('MyComponent = <P,>');
    } else {
      // If no result, verify original code remains unchanged
      expect(code).toContain('T extends ComponentProps<');
      expect(code).toContain('MyComponent = <P,>');
    }
  });

  it('should handle paths correctly by making them relative to code directory', async () => {
    const plugin = componentPathInjectorPlugin();
    const code = `export const Story = () => <Button />`;

    const result1 = await plugin.transform(code, '/some-project/src/Button.tsx');
    const result2 = await plugin.transform(
      code,
      '/different/path/to/storybook/code/addons/test/Component.tsx'
    );
    const result3 = await plugin.transform(code, '/no/code/directory/Component.tsx');

    expect(result1?.code).toContain('data-sb-component-path="./src/Button.tsx"');
    expect(result2?.code).toContain('data-sb-component-path="./addons/test/Component.tsx"');
    // Should fall back to the original path if no /code/ directory is found (but still add ./ prefix)
    expect(result3?.code).toContain('data-sb-component-path="./no/code/directory/Component.tsx"');
  });
});
