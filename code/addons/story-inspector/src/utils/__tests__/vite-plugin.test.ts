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

    const result = await plugin.transform(code, '/src/components/Button.tsx');

    expect(result?.code).toContain('data-sb-component-path="/src/components/Button.tsx"');
    expect(result?.code).toContain('<Button data-sb-component-path="/src/components/Button.tsx"');
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

    const result = await plugin.transform(code, '/src/components/Story.tsx');

    expect(result?.code).toContain(
      '<Button data-sb-component-path="/src/components/Story.tsx" onClick={() => {}} />'
    );
    expect(result?.code).toContain(
      '<Icon data-sb-component-path="/src/components/Story.tsx" name="star" />'
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
    expect(result?.code || code).not.toContain(
      'data-sb-component-path="/src/components/Story.tsx"'
    );
  });
});
