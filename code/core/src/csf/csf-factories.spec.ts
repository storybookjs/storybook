import { describe, it, expect } from 'vitest';
import { defineMeta, defineStory } from './csf-factories';

describe('CSF Next play inheritance', () => {
  it('should inherit play from meta to story and composed', () => {
    const meta = defineMeta({
      play: async () => {/* meta play */},
    } as any, {} as any);
    const Story = defineStory({ render: () => null }, meta);
    expect(Story.play).toBeDefined();
    expect(typeof Story.play).toBe('function');
    expect(Story.composed.play).toBeDefined();
    expect(typeof Story.composed.play).toBe('function');
  });
});
