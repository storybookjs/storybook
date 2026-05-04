import { describe, expect, it } from 'vitest';

import { detectReactNativeEntrypointTemplateVariant } from './index.ts';

describe('detectReactNativeEntrypointTemplateVariant', () => {
  it('returns expo when expo dependency is present', () => {
    expect(
      detectReactNativeEntrypointTemplateVariant({
        expo: '^51.0.0',
        'react-native': '0.76.0',
      })
    ).toBe('expo');
  });

  it('returns expo when expo-router dependency is present', () => {
    expect(
      detectReactNativeEntrypointTemplateVariant({
        'expo-router': '^4.0.0',
        'react-native': '0.76.0',
      })
    ).toBe('expo');
  });

  it('returns default when expo dependencies are missing', () => {
    expect(
      detectReactNativeEntrypointTemplateVariant({
        'react-native': '0.76.0',
      })
    ).toBe('default');
  });
});
