import { describe, expect, it } from 'vitest';

import { isHttpUrl } from './utils.ts';

describe('isHttpUrl', () => {
  it('accepts http and https links', () => {
    expect(isHttpUrl('https://dequeuniversity.com/rules/axe/4.10/color-contrast')).toBe(true);
    expect(isHttpUrl('http://localhost:6006/?path=/story/button--primary')).toBe(true);
    expect(isHttpUrl('HTTPS://dequeuniversity.com/')).toBe(true);
  });

  it('rejects links with other schemes', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isHttpUrl('vbscript:MsgBox(1)')).toBe(false);
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpUrl('mailto:someone@example.com')).toBe(false);
  });

  it('rejects values that are not absolute URLs', () => {
    expect(isHttpUrl('/rules/axe/color-contrast')).toBe(false);
    expect(isHttpUrl('//dequeuniversity.com/rules')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
    expect(isHttpUrl(undefined)).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
    expect(isHttpUrl(42)).toBe(false);
  });
});
