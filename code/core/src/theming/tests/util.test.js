// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import {
  darkenColor as darken,
  getPreferredColorScheme,
  lightenColor as lighten,
  opacify,
  transparentize,
} from '../utils';

describe('utils', () => {
  it('should apply polished when valid arguments are passed', () => {
    const lightColor = '#F6F9FC';
    const darkColor = '#2f2f2f';
    const darkenedColor = darken(lightColor);
    const lightenedColor = lighten(darkColor);

    expect(darkenedColor).toEqual('rgba(0,0,0,0.95)');
    expect(lightenedColor).toEqual('rgba(255,255,255,0.95)');
  });

  it('should guard non-string value is being passed to color of theme object', () => {
    const result = () => {
      return lighten(1234);
    };

    expect(result).toThrow();
  });

  it('should guard anything that is not working with polished', () => {
    const color = '1234';

    const result = lighten(color);

    expect(result).toEqual(color);
  });

  it('should guard css variables is being passed to polished functions', () => {
    const color = 'var(--my-var, blue)';

    const result = lighten(color);

    expect(result).toEqual(color);
  });

  it('should guard css calc is being passed to polished functions', () => {
    const color = 'rgb(calc(0 + 100), calc(0 + 100), calc(0 + 100))';

    const result = lighten(color);

    expect(result).toEqual(color);
  });

  it('should guard linear-gradient is being passed to polished functions', () => {
    const color = `linear-gradient(to bottom, white, blue)`;

    const result = lighten(color);

    expect(result).toEqual(color);
  });

  it('should guard radial-gradient is being passed to polished functions', () => {
    const color = `radial-gradient(red, green, blue)`;

    const result = lighten(color);

    expect(result).toEqual(color);
  });

  it('should guard repeating-linear-gradient is being passed to polished functions', () => {
    const color = `repeating-linear-gradient(red, yellow 10%, green 20%)`;

    const result = lighten(color);

    expect(result).toEqual(color);
  });

  it('should guard repeating-radial-gradient is being passed to polished functions', () => {
    const color = `repeating-radial-gradient(red, yellow 10%, green 20%)`;

    const result = lighten(color);

    expect(result).toEqual(color);
  });

  describe('darken', () => {
    it('should accept amount parameter', () => {
      const input = '#444';
      const result = darken(0.2, input);

      expect(result).not.toEqual(input);
    });

    it('should return unmodifed color when invalid color string is passed', () => {
      const color = 'var(--foo)';

      const result = darken(0.2, color);

      expect(result).toEqual(color);
    });
  });

  describe('lighten', () => {
    it('should accept amount parameter', () => {
      const input = '#444';

      const result = lighten(0.1, input);

      expect(result).not.toEqual(input);
    });

    it('should return unmodifed color when invalid color string is passed', () => {
      const color = 'var(--bar)';

      const result = lighten(0.1, color);

      expect(result).toEqual(color);
    });
  });

  describe('transparentize', () => {
    it('should call function imported from polished', () => {
      const input = '#fff';

      const result = transparentize(0.1, input);

      expect(result).not.toEqual(input);
    });

    it('should return unmodifed color when invalid color string is passed', () => {
      const color = 'var(--baz)';

      const result = transparentize(0.1, color);

      expect(result).toEqual(color);
    });
  });

  describe('opacify', () => {
    it('should call function imported from polished', () => {
      const input = '#fffa';

      const result = opacify(0.1, input);

      expect(result).not.toEqual(input);
    });

    it('should return unmodifed color when invalid color string is passed', () => {
      const color = 'var(--qux)';

      const result = opacify(0.1, color);

      expect(result).toEqual(color);
    });
  });

  describe('getPreferredColorScheme', () => {
    it('should return "light" if "matchMedia" is unavailable', () => {
      vi.stubGlobal('matchMedia', undefined);

      const colorScheme = getPreferredColorScheme();
      expect(colorScheme).toBe('light');
    });

    it('should return "light" if the preferred color scheme is light or undefined', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({
          matches: false,
        })
      );

      const colorScheme = getPreferredColorScheme();
      expect(colorScheme).toBe('light');
    });

    it('should return "dark" if the preferred color scheme is dark', () => {
      // By setting matches to always be true any checks for prefer-color-scheme
      // will match and since we only check if the preferred scheme is dark this
      // is a simple way to test it
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({
          matches: true,
        })
      );

      const colorScheme = getPreferredColorScheme();
      expect(colorScheme).toBe('dark');
    });
  });
});
