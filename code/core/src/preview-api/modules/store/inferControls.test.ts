import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/client-logger';
import type { StoryContextForEnhancers } from 'storybook/internal/types';

import { argTypesEnhancers } from './inferControls.ts';

const getStoryContext = (overrides: any = {}): StoryContextForEnhancers => ({
 id: '',
 title: '',
 kind: '',
 name: '',
 story: '',
 initialArgs: {},
 argTypes: {
 label: { control: 'text' },
 labelName: { control: 'text' },
 borderWidth: { control: { type: 'number', min: 0, max: 10 } },
 },
 ...overrides,
 parameters: {
 __isArgsStory: true,
 ...overrides.parameters,
 },
});

const [inferControls] = argTypesEnhancers;
describe('inferControls', () => {
 describe('with custom matchers', () => {
 let warnSpy: MockInstance;
 beforeEach(() => {
 warnSpy = vi.spyOn(logger, 'warn');
 warnSpy.mockImplementation(() => {});
 });
 afterEach(() => {
 warnSpy.mockRestore();
 });

 it('should return color type when using color matcher', () => {
 const inferredControls = inferControls(
 getStoryContext({
 argTypes: {
 background: {
 type: {
 name: 'string',
 },
 name: 'background',
 },
 },
 parameters: {
 controls: {
 matchers: {
 color: /background/,
 },
 },
 },
 })
 );

 const control = inferredControls.background.control;
 expect(typeof control === 'object' && control.type).toEqual('color');
 });

 it('should return inferred type when using color matcher but arg passed is not a string', () => {
 const sampleTypes = [
 {
 name: 'object',
 value: {
 rgb: {
 name: 'number',
 },
 },
 },
 { name: 'number' },
 { name: 'boolean' },
 ];

 sampleTypes.forEach((type) => {
 const inferredControls = inferControls(
 getStoryContext({
 argTypes: {
 background: {
 type,
 name: 'background',
 },
 },
 parameters: {
 controls: {
 matchers: {
 color: /background/,
 },
 },
 },
 })
 );

 expect(warnSpy).toHaveBeenCalled();
 const control = inferredControls.background.control;
 expect(typeof control === 'object' && control.type).toEqual(type.name);
 });
 });
 });

 it('should return argTypes as is when no exclude or include is passed', () => {
 const controls = inferControls(getStoryContext());
 expect(Object.keys(controls)).toEqual(['label', 'labelName', 'borderWidth']);
 });

 it('should return filtered argTypes when include is passed', () => {
 const [includeString, includeArray, includeRegex] = [
 inferControls(getStoryContext({ parameters: { controls: { include: 'label' } } })),
 inferControls(getStoryContext({ parameters: { controls: { include: ['label'] } } })),
 inferControls(getStoryContext({ parameters: { controls: { include: /label*/ } } })),
 ];

 expect(Object.keys(includeString)).toEqual(['label', 'labelName']);
 expect(Object.keys(includeArray)).toEqual(['label']);
 expect(Object.keys(includeRegex)).toEqual(['label', 'labelName']);
 });

 it('should return filtered argTypes when exclude is passed', () => {
 const [excludeString, excludeArray, excludeRegex] = [
 inferControls(getStoryContext({ parameters: { controls: { exclude: 'label' } } })),
 inferControls(getStoryContext({ parameters: { controls: { exclude: ['label'] } } })),
 inferControls(getStoryContext({ parameters: { controls: { exclude: /label*/ } } })),
 ];

 expect(Object.keys(excludeString)).toEqual(['borderWidth']);
 expect(Object.keys(excludeArray)).toEqual(['labelName', 'borderWidth']);
 expect(Object.keys(excludeRegex)).toEqual(['borderWidth']);
 });

 describe('with union types containing string literals', () => {
 it('should infer radio control for union of string literals (<=5)', () => {
 const inferredControls = inferControls(
 getStoryContext({
 argTypes: {
 size: {
 type: {
 name: 'union',
 value: [
 { name: 'literal', value: 'S' },
 { name: 'literal', value: 'M' },
 { name: 'literal', value: 'L' },
 ],
 },
 name: 'size',
 },
 },
 })
 );

 const control = inferredControls.size.control;
 expect(typeof control === 'object' && control.type).toEqual('radio');
 expect(inferredControls.size.options).toEqual(['S', 'M', 'L']);
 });

 it('should infer select control for union with many string literals (>5)', () => {
 const inferredControls = inferControls(
 getStoryContext({
 argTypes: {
 theme: {
 type: {
 name: 'union',
 value: [
 { name: 'literal', value: 'light' },
 { name: 'literal', value: 'dark' },
 { name: 'literal', value: 'blue' },
 { name: 'literal', value: 'green' },
 { name: 'literal', value: 'red' },
 { name: 'literal', value: 'purple' },
 ],
 },
 name: 'theme',
 },
 },
 })
 );

 const control = inferredControls.theme.control;
 expect(typeof control === 'object' && control.type).toEqual('select');
 expect(inferredControls.theme.options).toEqual(['light', 'dark', 'blue', 'green', 'red', 'purple']);
 });

 it('should not infer select for union with non-literal members', () => {
 const inferredControls = inferControls(
 getStoryContext({
 argTypes: {
 value: {
 type: {
 name: 'union',
 value: [
 { name: 'literal', value: 'foo' },
 { name: 'string' },
 ],
 },
 name: 'value',
 },
 },
 })
 );

 // Falls through to default — object control
 const control = inferredControls.value.control;
 expect(typeof control === 'object' && control.type).toEqual('object');
 });

 it('should not infer select for union with number literals', () => {
 const inferredControls = inferControls(
 getStoryContext({
 argTypes: {
 level: {
 type: {
 name: 'union',
 value: [
 { name: 'literal', value: 1 },
 { name: 'literal', value: 2 },
 ],
 },
 name: 'level',
 },
 },
 })
 );

 const control = inferredControls.level.control;
 expect(typeof control === 'object' && control.type).toEqual('object');
 });
 });
});