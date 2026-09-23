import { describe, expect, it } from 'vitest';
import { babelParse } from 'storybook/internal/babel';
import type { AIInstructionContext, Options } from 'storybook/internal/types';

import { experimental_aiInstructions } from './ai-instructions.ts';

describe.each(['ts', 'js'] as const)('AI instruction snippets in %s', (language) => {
  it.each([false, true])(
    'generates parseable examples with factory preview = %s',
    async (hasCsfFactoryPreview) => {
      const aiContext: AIInstructionContext = {
        framework: '@storybook/vue3-vite',
        configDir: 'libs/ui/.storybook',
        language,
        hasCsfFactoryPreview,
      };
      const result = await experimental_aiInstructions(
        { additionalGuidance: 'Existing guidance' },
        { aiContext } as Options & { aiContext: AIInstructionContext }
      );
      expect(result.additionalGuidance).toBe('Existing guidance');
      expect(result.story).toContain("import Button from './Button.vue'");
      expect(result.preview).toContain('<story />');
      expect(result.preview).toContain(`libs/ui/.storybook/preview.${language}`);
      expect(result.preview).toContain(hasCsfFactoryPreview ? 'definePreview({' : 'const preview');
      if (language === 'ts') {
        expect(result.story).toContain(
          "import type { Meta, StoryObj } from '@storybook/vue3-vite'"
        );
        expect(result.story).toContain('StoryObj<typeof meta>');
      } else {
        expect(result.story).not.toContain('import type');
        expect(result.preview).not.toContain('import type');
      }
      for (const snippet of [result.story, result.preview]) {
        const code = snippet!.match(/```[a-z]+\n([\s\S]*?)```/)![1];
        expect(() => babelParse(code)).not.toThrow();
      }
      expect(JSON.stringify(result)).not.toMatch(/react|jsx|tsx|SessionProvider|children:/i);
    }
  );
});
