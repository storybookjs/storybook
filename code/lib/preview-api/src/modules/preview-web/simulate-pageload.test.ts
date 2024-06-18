// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';

import { global } from '@storybook/global';
import { simulatePageLoad } from './simulate-pageload';

const { document } = global;

describe('simulatePageLoad', () => {
  it('should add script with type module to scripts root', () => {
    const container = document.createElement('div');
    const script = document.createElement('script');
    script.type = 'module';
    container.appendChild(script);

    simulatePageLoad(container);

    expect(document.body.innerHTML).toEqual(
      '<div id="scripts-root"><script type="module"></script></div>'
    );
  });

  it('should add script with proper mime type to scripts root', () => {
    const container = document.createElement('div');
    const script = document.createElement('script');
    script.type = 'application/javascript';
    container.appendChild(script);

    simulatePageLoad(container);

    expect(document.body.innerHTML).toEqual(
      '<div id="scripts-root"><script type="text/javascript"></script></div>'
    );
  });

  it('should add script without type to scripts root', () => {
    const container = document.createElement('div');
    const script = document.createElement('script');
    container.appendChild(script);

    simulatePageLoad(container);

    expect(document.body.innerHTML).toEqual(
      '<div id="scripts-root"><script type="text/javascript"></script></div>'
    );
  });
});
