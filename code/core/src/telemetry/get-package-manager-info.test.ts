import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as fs from 'node:fs';

import * as memfs from 'memfs';
import { vol } from 'memfs';
import { detect } from 'package-manager-detector';

import { getProjectRoot } from '../common/index.ts';
import { getPackageManagerInfo } from './get-package-manager-info.ts';

vi.mock('node:fs', { spy: true });
vi.mock('package-manager-detector', { spy: true });
vi.mock('../common/index.ts', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(fs.readFileSync).mockImplementation(memfs.fs.readFileSync as typeof fs.readFileSync);
  vi.mocked(getProjectRoot).mockReturnValue('/mock/project/root');
  vi.spyOn(process, 'cwd').mockReturnValue('/mock/project/root/apps/web');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('getPackageManagerInfo', () => {
  describe('when no package manager is detected', () => {
    beforeEach(() => {
      vi.mocked(detect).mockResolvedValue(null);
    });

    it('returns undefined', async () => {
      expect(await getPackageManagerInfo()).toBeUndefined();
    });
  });

  describe('when yarn berry is detected', () => {
    beforeEach(() => {
      vi.mocked(detect).mockResolvedValue({ name: 'yarn', version: '3.6.0', agent: 'yarn@berry' });
    });

    it('defaults to pnp without a .yarnrc.yml', async () => {
      expect(await getPackageManagerInfo()).toEqual({
        type: 'yarn',
        version: '3.6.0',
        agent: 'yarn@berry',
        nodeLinker: 'pnp',
      });
    });

    it('reads nodeLinker from the project root .yarnrc.yml', async () => {
      vol.fromJSON({
        '/mock/project/root/.yarnrc.yml':
          'yarnPath: .yarn/releases/yarn.cjs\nnodeLinker: node-modules\n',
      });

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'node-modules' });
    });

    it('reads a flow-style mapping and an anchored value like yarn does', async () => {
      vol.fromJSON({
        '/mock/project/root/.yarnrc.yml': '{ nodeLinker: pnpm, enableGlobalCache: true }\n',
      });
      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'pnpm' });

      vol.fromJSON({ '/mock/project/root/.yarnrc.yml': 'nodeLinker: &linker node-modules\n' });
      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'node-modules' });
    });

    it('treats a .yarnrc.yml that is not valid YAML as one without the setting', async () => {
      vol.fromJSON({ '/mock/project/root/.yarnrc.yml': 'nodeLinker: [unterminated\n' });

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'pnp' });
    });

    it('lets YARN_NODE_LINKER override the config file, like yarn does', async () => {
      vol.fromJSON({ '/mock/project/root/.yarnrc.yml': 'nodeLinker: node-modules\n' });
      vi.stubEnv('YARN_NODE_LINKER', 'pnpm');

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'pnpm' });
    });

    it('prefers the .yarnrc.yml in the working directory', async () => {
      vol.fromJSON({
        '/mock/project/root/.yarnrc.yml': 'nodeLinker: node-modules\n',
        '/mock/project/root/apps/web/.yarnrc.yml': 'nodeLinker: "pnpm"\n',
      });

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'pnpm' });
    });
  });

  describe('when yarn classic is detected', () => {
    beforeEach(() => {
      vi.mocked(detect).mockResolvedValue({ name: 'yarn', version: '1.22.0', agent: 'yarn' });
    });

    it('reports node_modules and ignores .yarnrc.yml, which Yarn 1 does not read', async () => {
      vol.fromJSON({ '/mock/project/root/.yarnrc.yml': 'nodeLinker: pnp\n' });
      vi.stubEnv('YARN_NODE_LINKER', 'pnp');

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'node_modules' });
      expect(vi.mocked(fs.readFileSync)).not.toHaveBeenCalled();
    });
  });

  describe('when pnpm is detected', () => {
    beforeEach(() => {
      vi.mocked(detect).mockResolvedValue({ name: 'pnpm', version: '8.15.0', agent: 'pnpm' });
    });

    it('defaults to isolated without an .npmrc', async () => {
      expect(await getPackageManagerInfo()).toEqual({
        type: 'pnpm',
        version: '8.15.0',
        agent: 'pnpm',
        nodeLinker: 'isolated',
      });
    });

    it('reads node-linker from .npmrc', async () => {
      vol.fromJSON({
        '/mock/project/root/.npmrc': 'shamefully-hoist=true\nnode-linker = hoisted\n',
      });

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'hoisted' });
    });

    it('lets npm_config_node_linker override the config files, like pnpm does', async () => {
      vol.fromJSON({ '/mock/project/root/.npmrc': 'node-linker=hoisted\n' });
      vi.stubEnv('npm_config_node_linker', 'isolated');

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'isolated' });
    });

    it('accepts a quoted node-linker value the way pnpm does', async () => {
      vol.fromJSON({ '/mock/project/root/.npmrc': 'node-linker="hoisted"\n' });
      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'hoisted' });

      vol.fromJSON({ '/mock/project/root/.npmrc': "node-linker='pnp'\n" });
      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'pnp' });
    });

    it('prefers pnpm_config_node_linker over npm_config_node_linker', async () => {
      vi.stubEnv('pnpm_config_node_linker', 'hoisted');
      vi.stubEnv('npm_config_node_linker', 'pnp');

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'hoisted' });
    });

    it('prefers the config files in the working directory', async () => {
      vol.fromJSON({
        '/mock/project/root/pnpm-workspace.yaml': 'nodeLinker: isolated\n',
        '/mock/project/root/apps/web/pnpm-workspace.yaml': 'nodeLinker: hoisted\n',
      });
      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'hoisted' });

      vol.reset();
      vol.fromJSON({
        '/mock/project/root/.npmrc': 'node-linker=isolated\n',
        '/mock/project/root/apps/web/.npmrc': 'node-linker=hoisted\n',
      });
      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'hoisted' });
    });

    it('ignores an .npmrc without node-linker', async () => {
      vol.fromJSON({ '/mock/project/root/.npmrc': 'shamefully-hoist=true\n' });

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'isolated' });
    });

    it('reads nodeLinker from pnpm-workspace.yaml', async () => {
      vol.fromJSON({
        '/mock/project/root/pnpm-workspace.yaml': 'packages:\n  - apps/*\nnodeLinker: hoisted\n',
      });

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'hoisted' });
    });

    it('falls back to the default for a value pnpm does not support', async () => {
      vol.fromJSON({ '/mock/project/root/.npmrc': 'node-linker=whatever\n' });

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'isolated' });
    });

    it('prefers pnpm-workspace.yaml over .npmrc, like pnpm does', async () => {
      vol.fromJSON({
        '/mock/project/root/.npmrc': 'node-linker=isolated\n',
        '/mock/project/root/pnpm-workspace.yaml': 'nodeLinker: hoisted\n',
      });

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'hoisted' });
    });

    it('skips a config file it cannot read and keeps looking', async () => {
      vol.fromJSON({
        '/mock/project/root/pnpm-workspace.yaml/placeholder': '',
        '/mock/project/root/.npmrc': 'node-linker=hoisted\n',
      });

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'hoisted' });
    });

    it('reads .npmrc when the pnpm version is unknown', async () => {
      vi.mocked(detect).mockResolvedValue({ name: 'pnpm', agent: 'pnpm' });
      vol.fromJSON({ '/mock/project/root/.npmrc': 'node-linker=hoisted\n' });

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'hoisted' });
    });
  });

  describe('when pnpm 11 is detected', () => {
    beforeEach(() => {
      vi.mocked(detect).mockResolvedValue({ name: 'pnpm', version: '11.0.8', agent: 'pnpm' });
    });

    it('ignores .npmrc and npm_config_node_linker, which pnpm 11 no longer reads', async () => {
      vol.fromJSON({ '/mock/project/root/.npmrc': 'node-linker=hoisted\n' });
      vi.stubEnv('npm_config_node_linker', 'hoisted');

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'isolated' });
    });

    it('lets pnpm_config_node_linker override pnpm-workspace.yaml, like pnpm 11 does', async () => {
      vol.fromJSON({ '/mock/project/root/pnpm-workspace.yaml': 'nodeLinker: isolated\n' });
      vi.stubEnv('pnpm_config_node_linker', 'hoisted');

      expect(await getPackageManagerInfo()).toMatchObject({ nodeLinker: 'hoisted' });
    });
  });

  describe('when npm is detected', () => {
    beforeEach(() => {
      vi.mocked(detect).mockResolvedValue({ name: 'npm', version: '9.8.0', agent: 'npm' });
    });

    it('reports node_modules without reading any config', async () => {
      expect(await getPackageManagerInfo()).toMatchObject({
        type: 'npm',
        nodeLinker: 'node_modules',
      });
      expect(vi.mocked(fs.readFileSync)).not.toHaveBeenCalled();
    });
  });

  describe('when bun is detected', () => {
    beforeEach(() => {
      vi.mocked(detect).mockResolvedValue({ name: 'bun', version: '1.0.0', agent: 'bun' });
    });

    it('reports node_modules without reading any config', async () => {
      expect(await getPackageManagerInfo()).toMatchObject({
        type: 'bun',
        nodeLinker: 'node_modules',
      });
      expect(vi.mocked(fs.readFileSync)).not.toHaveBeenCalled();
    });
  });
});
