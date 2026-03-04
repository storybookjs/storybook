// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import { toHaveLiveRegion } from './toHaveLiveRegion';

expect.extend({ toHaveLiveRegion });

describe('toHaveLiveRegion', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('passes when a matching live region with aria-live is found', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div aria-live="polite">Tests passed</div>';
    expect(container).toHaveLiveRegion({ text: 'Tests passed' });
  });

  it('passes when a matching live region with role="status" is found', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div role="status">Tests passed</div>';
    expect(container).toHaveLiveRegion({ text: 'Tests passed' });
  });

  it('passes when a matching live region with role="alert" is found', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div role="alert">Critical error</div>';
    expect(container).toHaveLiveRegion({ text: 'Critical error' });
  });

  it('passes when a matching live region with role="log" is found', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div role="log">Log entry</div>';
    expect(container).toHaveLiveRegion({ text: 'Log entry' });
  });

  it('fails when no matching live region is found', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div aria-live="polite">Tests passed</div>';
    expect(() => {
      expect(container).toHaveLiveRegion({ text: 'Tests failed' });
    }).toThrow();
  });

  it('matches with RegExp', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div aria-live="polite">3 tests passed, 0 failed</div>';
    expect(container).toHaveLiveRegion({ text: /\d+ tests passed/ });
  });

  it('filters by politeness level', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div aria-live="assertive">Error occurred</div>';
    expect(container).toHaveLiveRegion({ text: 'Error occurred', level: 'assertive' });
    expect(() => {
      expect(container).toHaveLiveRegion({ text: 'Error occurred', level: 'polite' });
    }).toThrow();
  });

  it('infers polite level from role="status"', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div role="status">Status update</div>';
    expect(container).toHaveLiveRegion({ text: 'Status update', level: 'polite' });
    expect(() => {
      expect(container).toHaveLiveRegion({ text: 'Status update', level: 'assertive' });
    }).toThrow();
  });

  it('infers assertive level from role="alert"', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div role="alert">Alert message</div>';
    expect(container).toHaveLiveRegion({ text: 'Alert message', level: 'assertive' });
    expect(() => {
      expect(container).toHaveLiveRegion({ text: 'Alert message', level: 'polite' });
    }).toThrow();
  });

  it('works with .not modifier', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div aria-live="polite">Tests passed</div>';
    expect(container).not.toHaveLiveRegion({ text: 'Tests failed' });
  });
});
