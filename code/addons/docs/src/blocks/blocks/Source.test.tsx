import { describe, expect, it, vi } from 'vitest';
import { SourceType } from 'storybook/internal/docs-tools';
import { useCode } from './Source.tsx';

describe('useCode', () => {
  it('does not apply sourceParameters.transform twice when snippet is already provided (issue #35889)', () => {
    const transform = vi.fn((code: string) => /*transformed*/ );

    const result = useCode({
      snippet: '/*transformed*/ <Button />', // already transformed by emitTransformCode
      serviceSnippet: '',
      storyContext: {
        parameters: {
          __isArgsStory: true,
          docs: {
            source: {
              type: SourceType.DYNAMIC,
              transform,
            },
          },
        },
      } as any,
      typeFromProps: SourceType.DYNAMIC,
    });

    expect(transform).not.toHaveBeenCalled();
    expect(result).toBe('/*transformed*/ <Button />');
  });

  it('applies transformFromProps if explicitly provided on props', () => {
    const propTransform = vi.fn((code: string) => /*prop*/ );

    const result = useCode({
      snippet: '<Button />',
      serviceSnippet: '',
      storyContext: {
        parameters: {
          __isArgsStory: true,
          docs: {
            source: {
              type: SourceType.DYNAMIC,
            },
          },
        },
      } as any,
      typeFromProps: SourceType.DYNAMIC,
      transformFromProps: propTransform,
    });

    expect(propTransform).toHaveBeenCalledWith('<Button />', expect.anything());
    expect(result).toBe('/*prop*/ <Button />');
  });

  it('applies sourceParameters.transform when using originalSource fallback', () => {
    const transform = vi.fn((code: string) => /*transformed*/ );

    const result = useCode({
      snippet: '',
      serviceSnippet: '',
      storyContext: {
        parameters: {
          __isArgsStory: false,
          docs: {
            source: {
              type: SourceType.CODE,
              originalSource: '<Button />',
              transform,
            },
          },
        },
      } as any,
      typeFromProps: SourceType.CODE,
    });

    expect(transform).toHaveBeenCalledWith('<Button />', expect.anything());
    expect(result).toBe('/*transformed*/ <Button />');
  });
});
