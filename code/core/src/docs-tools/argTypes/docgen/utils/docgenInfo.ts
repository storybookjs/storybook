/* eslint-disable no-underscore-dangle */
import type { Component } from '../../types';
import { str } from './string';

export function hasDocgen<T = any>(
  component: Component
): component is object & { __docgenInfo: T } {
  return !!component.__docgenInfo;
}

export function isValidDocgenSection(docgenSection: any) {
  return docgenSection != null && Object.keys(docgenSection).length > 0;
}

export function getDocgenSection(component: Component, section: string): any {
  return hasDocgen(component) ? component.__docgenInfo[section] : null;
}

export function getDocgenDescription(component: Component): string {
  return hasDocgen(component) ? str(component.__docgenInfo.description) : '';
}
