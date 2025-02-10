/* eslint-disable import/no-extraneous-dependencies */

/**
 * Mock implementation of a universal store instances manager for testing purposes.
 *
 * This class provides a two-level map structure to manage store instances:
 *
 * - First level: environments (identified by environment key)
 * - Second level: store instances within each environment (identified by instance key)
 *
 * The keys must be in the format "environment:instance".
 */
import { vi } from 'vitest';

import invariant from 'tiny-invariant';

import type { UniversalStore } from '..';

class MockInstancesMap {
  environments = new Map<string, Map<string, UniversalStore<any, any>>>();

  set = vi.fn((key: string, value: UniversalStore<any, any>) => {
    const { environment, instanceKey } = this.getKeys(key);
    environment.set(instanceKey, value);

    return this;
  });

  get = vi.fn((key: string) => {
    const { environment, instanceKey } = this.getKeys(key);
    return environment.get(instanceKey);
  });

  has = vi.fn((key: string) => {
    const { environment, instanceKey } = this.getKeys(key);
    return environment.has(instanceKey);
  });

  delete = vi.fn((key: string) => {
    const { environment, instanceKey } = this.getKeys(key);
    return environment.delete(instanceKey);
  });

  clear = vi.fn((environmentKey: string) => {
    invariant(
      this.environments.has(environmentKey),
      'Environment key is required when clearing instances. To clear all environments, use `clearAllEnvironments`'
    );
    return this.environments.get(environmentKey)!.clear();
  });

  environmentSize = vi.fn((environmentKey: string) => {
    return this.environments.get(environmentKey)?.size ?? 0;
  });

  clearAllEnvironments = vi.fn(() => {
    this.environments.clear();
  });

  private getKeys(key: string) {
    const [environmentKey, instanceKey] = key.split(':');
    invariant(
      environmentKey && instanceKey,
      'Creating instances with the mock requires that the id is in the form "environment:instance"'
    );
    if (!this.environments.has(environmentKey)) {
      this.environments.set(environmentKey, new Map());
    }
    return { environment: this.environments.get(environmentKey)!, instanceKey };
  }
}

export const instances = new MockInstancesMap();
