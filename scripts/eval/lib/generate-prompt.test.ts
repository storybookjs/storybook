import { describe, expect, it } from 'vitest';

import { generatePrompt, listPrompts } from './generate-prompt';

describe('listPrompts', () => {
  it('lists available prompt names', () => {
    const prompts = listPrompts();
    expect(prompts).toContain('setup');
    expect(prompts).toContain('self-heal');
  });

  it('returns only names without .md extension', () => {
    const prompts = listPrompts();
    for (const name of prompts) {
      expect(name).not.toContain('.md');
    }
  });
});

describe('generatePrompt', () => {
  it('loads setup prompt by default', () => {
    const prompt = generatePrompt();
    expect(prompt).toContain('Storybook');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('loads setup prompt by name', () => {
    const prompt = generatePrompt('setup');
    expect(prompt).toContain('Storybook setup');
  });

  it('loads self-heal prompt', () => {
    const prompt = generatePrompt('self-heal');
    expect(prompt).toContain('Self-healing');
    expect(prompt).toContain('vitest');
  });

  it('throws for unknown prompt', () => {
    expect(() => generatePrompt('nonexistent-prompt-xyz')).toThrow('Prompt not found');
  });

  it('returns trimmed content', () => {
    const prompt = generatePrompt('setup');
    expect(prompt).toBe(prompt.trim());
  });
});
