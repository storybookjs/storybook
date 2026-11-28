import { createHash } from 'node:crypto';

import { DesignExportError } from 'storybook/internal/server-errors';

import type { APIRequestContext } from 'playwright';
import { type AtRule, type Container, atRule, parse } from 'postcss';
import valueParser from 'postcss-value-parser';

export const MAX_EXPORT_BYTES = 256 * 1024 * 1024;

type FontCondition = (kind: 'media' | 'supports', condition: string) => Promise<boolean>;

const decodeCSS = (value: string) =>
  value.replace(/\\([0-9a-f]{1,6}\s?|[^\r\n])/gi, (_, escaped: string) =>
    /^[0-9a-f]/i.test(escaped)
      ? String.fromCodePoint(parseInt(escaped.trim(), 16) || 0xfffd)
      : escaped
  );

export function createResources(request: APIRequestContext, timeout: number) {
  const assets: Record<string, Uint8Array> = {};
  const cache = new Map<string, string>();
  let bytes = 0;
  const asset = async (value: string, base: string): Promise<string> => {
    if (value.startsWith('#') || value.startsWith('data:')) {
      return value;
    }
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new DesignExportError({
        message: `Cannot export resource with protocol ${url.protocol}`,
      });
    }
    const fragment = url.hash;
    url.hash = '';
    const key = url.href;
    let file = cache.get(key);
    if (!file) {
      const response = await request.get(key, { timeout });
      try {
        if (!response.ok()) {
          throw new DesignExportError({
            message: `Resource returned HTTP ${response.status()}: ${url.origin}${url.pathname}`,
          });
        }
        const data = await response.body();
        bytes += data.byteLength;
        if (bytes > MAX_EXPORT_BYTES) {
          throw new DesignExportError({
            message: 'Export resources exceed 256 MiB. Reduce the library or its asset sizes.',
          });
        }
        const mime = response.headers()['content-type']?.split(';')[0];
        const extensions: Record<string, string> = {
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/svg+xml': 'svg',
          'image/gif': 'gif',
          'image/webp': 'webp',
          'image/avif': 'avif',
          'font/woff2': 'woff2',
          'font/woff': 'woff',
          'font/ttf': 'ttf',
          'font/otf': 'otf',
        };
        const extension = extensions[mime ?? ''] ?? 'bin';
        file = `assets/${createHash('sha256').update(data).digest('hex')}.${extension}`;
        assets[file] = data;
        cache.set(key, file);
      } finally {
        await response.dispose();
      }
    }
    return file + fragment;
  };
  const css = async (value: string, base: string): Promise<string> => {
    if (!value.includes('(')) {
      return value;
    }
    const parsed = valueParser(value);
    const urls: valueParser.FunctionNode[] = [];
    parsed.walk((node) => {
      if (node.type === 'function' && node.value.toLowerCase() === 'url') {
        urls.push(node);
        return false;
      }
      if (node.type === 'function' && /^(?:-webkit-)?image-set$/i.test(node.value)) {
        if (node.nodes.some((child) => child.type === 'string')) {
          throw new DesignExportError({
            message: 'String URLs in CSS image-set are unsupported. Use url() instead.',
          });
        }
      }
      return undefined;
    });
    for (const node of urls) {
      const raw = node.nodes[0];
      if (!raw || !['string', 'word'].includes(raw.type) || node.nodes.length !== 1) {
        throw new DesignExportError({ message: 'Cannot read a resource URL in exported CSS.' });
      }
      const localized = await asset(decodeCSS(raw.value), base);
      node.nodes = [
        {
          type: 'string',
          quote: '"',
          value: localized.replace(
            /["\\\n\r\f]/g,
            (character) => `\\${character.codePointAt(0)!.toString(16)} `
          ),
          sourceIndex: 0,
          sourceEndIndex: 0,
        },
      ];
    }
    return parsed.toString();
  };
  const fonts = async (
    text: string,
    base: string,
    matches: FontCondition,
    seenStylesheets = new Set([base])
  ): Promise<string> => {
    const root = parse(text, { from: base });
    const select = async (container: Container): Promise<void> => {
      for (const node of [...(container.nodes ?? [])]) {
        if (node.type !== 'atrule') {
          node.remove();
          continue;
        }
        const rule = node as AtRule;
        const name = rule.name.toLowerCase();
        if (name === 'font-face') {
          for (const declaration of rule.nodes ?? []) {
            if (declaration.type === 'decl') {
              declaration.value = await css(declaration.value, base);
            }
          }
        } else if (name === 'media' || name === 'supports' || name === 'layer') {
          if (name !== 'layer' && !(await matches(name, rule.params))) {
            rule.remove();
          } else {
            await select(rule);
            if (name !== 'layer' && !rule.nodes?.length) {
              rule.remove();
            }
          }
        } else if (name === 'import') {
          const nodes = valueParser(rule.params).nodes;
          let index = 0;
          const next = () => {
            while (nodes[index]?.type === 'space' || nodes[index]?.type === 'comment') {
              index++;
            }
            return nodes[index++];
          };
          const first = next();
          const source = first?.type === 'function' ? first.nodes[0]?.value : first?.value;
          if (!source) {
            throw new DesignExportError({ message: 'Cannot read an imported stylesheet URL.' });
          }
          const wrappers: AtRule[] = [];
          let qualifier = next();
          if (qualifier?.value.toLowerCase() === 'layer') {
            wrappers.push(
              atRule({
                name: 'layer',
                params: qualifier.type === 'function' ? valueParser.stringify(qualifier.nodes) : '',
              })
            );
            qualifier = next();
          }
          if (qualifier?.type === 'function' && qualifier.value.toLowerCase() === 'supports') {
            const condition = `(${valueParser.stringify(qualifier.nodes)})`;
            wrappers.push(atRule({ name: 'supports', params: condition }));
            qualifier = next();
          }
          const media = qualifier ? valueParser.stringify(nodes.slice(index - 1)).trim() : '';
          if (media) {
            wrappers.push(atRule({ name: 'media', params: media }));
          }
          let active = true;
          for (const wrapper of wrappers) {
            if (
              wrapper.name !== 'layer' &&
              !(await matches(wrapper.name as 'media' | 'supports', wrapper.params))
            ) {
              active = false;
            }
          }
          const url = new URL(decodeCSS(source), base).href;
          if (!active || seenStylesheets.has(url)) {
            rule.remove();
            continue;
          }
          if (!['http:', 'https:'].includes(new URL(url).protocol)) {
            throw new DesignExportError({
              message: 'Imported stylesheets must use HTTP or HTTPS.',
            });
          }
          const response = await request.get(url, { timeout });
          try {
            if (!response.ok()) {
              throw new DesignExportError({
                message: `Stylesheet returned HTTP ${response.status()}`,
              });
            }
            let imported = await fonts(
              await response.text(),
              response.url(),
              matches,
              new Set([...seenStylesheets, url, response.url()])
            );
            for (const wrapper of wrappers.reverse()) {
              imported = wrapper.append(parse(imported)).toString();
            }
            rule.replaceWith(parse(imported));
          } finally {
            await response.dispose();
          }
        } else {
          rule.remove();
        }
      }
    };
    await select(root);
    return root.toString();
  };
  return { assets, asset, css, fonts };
}

export type Resources = ReturnType<typeof createResources>;
