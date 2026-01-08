import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getComponentComplexity } from './component-analyzer';
import { getCandidatesForStorybook } from './get-candidates';

vi.mock('node:fs/promises');
vi.mock('glob');
vi.mock('storybook/internal/node-logger');
vi.mock('./component-analyzer');

describe('getCandidatesForStorybook', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns simple candidates when enough are found', async () => {
    const files = ['/path/to/SimpleComponent.tsx', '/path/to/ComplexComponent.tsx'];
    const sampleCount = 1;

    // Mock readFile for both files
    vi.mocked(readFile).mockResolvedValueOnce(`
        export const SimpleComponent = () => <div>Simple</div>;
      `).mockResolvedValueOnce(`
        export const ComplexComponent = () => <div>Complex</div>;
      `);

    // Mock getComponentComplexity
    vi.mocked(getComponentComplexity)
      .mockReturnValueOnce(0.1) // Simple component (below 0.2)
      .mockReturnValueOnce(0.8); // Complex component (above 0.2)

    const result = await getCandidatesForStorybook(files, sampleCount);

    expect(result).toEqual(['/path/to/SimpleComponent.tsx']);
    // Should only read the first file since it found a simple candidate and sampleCount=1
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(readFile).toHaveBeenCalledWith('/path/to/SimpleComponent.tsx', 'utf-8');
    expect(getComponentComplexity).toHaveBeenCalledTimes(1);
  });

  it('returns analyzed candidates when not enough simple ones found', async () => {
    const files = ['/path/to/ComplexComponent1.tsx', '/path/to/ComplexComponent2.tsx'];
    const sampleCount = 2;

    // Mock readFile for both files
    vi.mocked(readFile).mockResolvedValueOnce(`
        export const ComplexComponent = () => <div>Complex</div>;
      `).mockResolvedValueOnce(`
        const ComplexComponent = () => <div>Complex</div>;
        export default ComplexComponent;
      `);

    // Assuming both components are complex
    vi.mocked(getComponentComplexity).mockReturnValueOnce(0.5).mockReturnValueOnce(0.6);

    const result = await getCandidatesForStorybook(files, sampleCount);

    expect(result).toEqual(['/path/to/ComplexComponent1.tsx', '/path/to/ComplexComponent2.tsx']);
    expect(readFile).toHaveBeenCalledTimes(2);
    expect(getComponentComplexity).toHaveBeenCalledTimes(2);
  });

  it('filters out invalid candidates', async () => {
    const files = ['/path/to/ValidComponent.tsx', '/path/to/InvalidComponent.js'];
    const sampleCount = 2;

    // Mock readFile
    vi.mocked(readFile).mockResolvedValueOnce(`
        export const ValidComponent = () => <div>Valid</div>;
      `).mockResolvedValueOnce(`
        console.log('invalid as there is no export nor JSX');
      `);

    vi.mocked(getComponentComplexity).mockReturnValue(0.1);

    const result = await getCandidatesForStorybook(files, sampleCount);

    // Even though the sample count is 2, only one is returned as the invalid component is filtered out
    expect(result).toEqual(['/path/to/ValidComponent.tsx']);
    expect(readFile).toHaveBeenCalledTimes(2);
    expect(getComponentComplexity).toHaveBeenCalledTimes(1);
  });

  it('handles readFile errors gracefully', async () => {
    const files = ['/path/to/ValidComponent.tsx', '/path/to/ErrorComponent.tsx'];
    const sampleCount = 2;

    // Suppose one of the files fails for whatever reason
    vi.mocked(readFile)
      .mockResolvedValueOnce(
        `
        export const ValidComponent = () => <div>Valid</div>;
      `
      )
      .mockRejectedValueOnce(new Error('File not found'));

    vi.mocked(getComponentComplexity).mockReturnValue(0.1);

    const result = await getCandidatesForStorybook(files, sampleCount);

    // Should attempt to read both files and still proceed correctly with the valid ones
    expect(result).toEqual(['/path/to/ValidComponent.tsx']);
    expect(readFile).toHaveBeenCalledTimes(2);
    expect(getComponentComplexity).toHaveBeenCalledTimes(1);
  });

  it('stops reading as soon as enough simple candidates are found', async () => {
    const files = ['/path/to/Complex1.tsx', '/path/to/Simple.tsx'];
    const sampleCount = 1;

    vi.mocked(readFile).mockResolvedValueOnce(`
        export const ComplexComponent = () => <div>Complex</div>;
      `).mockResolvedValueOnce(`
        export const SimpleComponent = () => <div>Simple</div>;
      `).mockResolvedValueOnce(`
        export const SimpleComponent = () => <div>Simple</div>;
      `);

    vi.mocked(getComponentComplexity)
      .mockReturnValueOnce(0.5) // Complex
      .mockReturnValueOnce(0.1); // Simple - should stop after processing this

    const result = await getCandidatesForStorybook(files, sampleCount);

    expect(result).toEqual(['/path/to/Simple.tsx']);
    // Should stop after the second file as the sample count was already fulfilled
    expect(readFile).toHaveBeenCalledTimes(2);
    expect(getComponentComplexity).toHaveBeenCalledTimes(2);
  });

  it('returns all analyzed candidates when sampleCount exceeds amount of detected simple candidates', async () => {
    const files = ['/path/to/Component1.tsx', '/path/to/Component2.tsx'];
    const sampleCount = 3; // More than available

    vi.mocked(readFile).mockResolvedValueOnce(`
      export const SimpleComponent = () => <div>Simple</div>;
      `).mockResolvedValueOnce(`
        export const ComplexComponent = () => <div>Complex</div>;
        `).mockResolvedValueOnce(`
        export const ComplexComponent = () => <div>Complex</div>;
        `);

    vi.mocked(getComponentComplexity)
      .mockReturnValueOnce(0.2) // Simple
      .mockReturnValueOnce(0.3) // Not simple
      .mockReturnValueOnce(0.4); // Not simple

    const result = await getCandidatesForStorybook(files, sampleCount);

    expect(result).toEqual(['/path/to/Component1.tsx', '/path/to/Component2.tsx']);
    expect(readFile).toHaveBeenCalledTimes(2);
    expect(getComponentComplexity).toHaveBeenCalledTimes(2);
  });
});
