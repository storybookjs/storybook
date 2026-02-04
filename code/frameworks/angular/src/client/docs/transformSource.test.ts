import { describe, expect, test } from 'vitest';
import { collapseEmptyAngularTags } from './transformSource';

describe('collapseEmptyAngularTags', () => {
  test('returns input when no closing tags present', () => {
    const input = '<div>hello</div><img src="x" />';
    expect(collapseEmptyAngularTags(input)).toBe(input);
  });

  test('collapses empty custom element tags', () => {
    const input = '<hello-world></hello-world>';
    const output = '<hello-world />';
    expect(collapseEmptyAngularTags(input)).toBe(output);
  });

  test('collapses empty custom element tags with attributes', () => {
    const input = '<my-widget data-id="42"></my-widget>';
    const output = '<my-widget data-id="42" />';
    expect(collapseEmptyAngularTags(input)).toBe(output);
  });

  test('does not collapse real void elements', () => {
    const inputs = ['<img src="x" />', '<br />', '<input type="text" />'];
    inputs.forEach((i) => expect(collapseEmptyAngularTags(i)).toBe(i));
  });

  test('does not collapse common HTML container tags', () => {
    const samples = ['<div></div>', '<span></span>', '<button></button>', '<section></section>'];
    samples.forEach((i) => expect(collapseEmptyAngularTags(i)).toBe(i));
  });

  test('collapses unknown non-void tags (likely components) without dash', () => {
    // Some Angular component selectors don’t use a dash
    const input = '<app></app>';
    const output = '<app />';
    expect(collapseEmptyAngularTags(input)).toBe(output);
  });

  test('ignores tags with inner whitespace/text', () => {
    const inputs = [
      '<hello-world> </hello-world>',
      '<hello-world>\n</hello-world>',
      '<hello-world>text</hello-world>',
    ];
    inputs.forEach((i) => expect(collapseEmptyAngularTags(i)).toBe(i));
  });

  test('handles multiple tags in a single string', () => {
    const input = '<a></a><hello-world></hello-world><img />';
    const output = '<a></a><hello-world /><img />';
    expect(collapseEmptyAngularTags(input)).toBe(output);
  });

  test('collapses nested empty custom tags but keeps parents', () => {
    const input = '<div><hello-world></hello-world></div>';
    const output = '<div><hello-world /></div>';
    expect(collapseEmptyAngularTags(input)).toBe(output);
  });

  test('collapses deeper nested empty custom tags', () => {
    const input = '<outer><middle><hello-world></hello-world></middle></outer>';
    const output = '<outer><middle><hello-world /></middle></outer>';
    expect(collapseEmptyAngularTags(input)).toBe(output);
  });

  test('collapses multiple nested custom tags and leaves standard tags as-is', () => {
    const input = '<outer><custom></custom><div><comp2></comp2></div></outer>';
    const output = '<outer><custom /><div><comp2 /></div></outer>';
    expect(collapseEmptyAngularTags(input)).toBe(output);
  });

  test('collapses nested with surrounding whitespace and newlines', () => {
    const input = ['<div>\n<hello-world></hello-world>\n</div>'].join('');
    const output = ['<div>\n<hello-world />\n</div>'].join('');
    expect(collapseEmptyAngularTags(input)).toBe(output);
  });

  test('collapses custom selectors without dash when nested', () => {
    const input = '<outer><app></app><x></x></outer>';
    const output = '<outer><app /><x /></outer>';
    expect(collapseEmptyAngularTags(input)).toBe(output);
  });
});
