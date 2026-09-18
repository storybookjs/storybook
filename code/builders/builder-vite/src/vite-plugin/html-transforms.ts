import { join } from 'pathe';
import type {
  DevEnvironment,
  HtmlTagDescriptor,
  IndexHtmlTransformContext,
  IndexHtmlTransformHook,
  Plugin,
  ViteDevServer,
} from 'vite';

const HEAD_INJECT_RE = /([ \t]*)<\/head>/i;
const HEAD_PREPEND_INJECT_RE = /([ \t]*)<head[^>]*>/i;
const HTML_INJECT_RE = /<\/html>/i;
const HTML_PREPEND_INJECT_RE = /([ \t]*)<html[^>]*>/i;
const BODY_INJECT_RE = /([ \t]*)<\/body>/i;
const BODY_PREPEND_INJECT_RE = /([ \t]*)<body[^>]*>/i;
const DOCTYPE_PREPEND_INJECT_RE = /<!doctype html>/i;
const UNARY_TAGS = new Set(['link', 'meta', 'base']);

export async function applyStorybookEnvironmentHtmlTransforms(
  environment: DevEnvironment,
  server: ViteDevServer,
  path: string,
  html: string
): Promise<string> {
  const plugins = environment.plugins.filter((plugin) => !plugin.name.startsWith('storybook:'));
  const [preHooks, normalHooks, postHooks] = resolveHtmlTransforms(plugins);
  const hooks = [...preHooks, ...normalHooks, ...postHooks];
  if (hooks.length === 0) {
    return html;
  }

  const ctx: IndexHtmlTransformContext = {
    path,
    filename: join(environment.config.root, path.replace(/^\//, '')),
    server,
    originalUrl: path,
  };
  const pluginContext = environment.pluginContainer.minimalContext;

  let result = html;
  for (const hook of hooks) {
    const res = await hook.call(pluginContext, result, ctx);
    if (!res) {
      continue;
    }
    if (typeof res === 'string') {
      result = res;
      continue;
    }
    let tags: HtmlTagDescriptor[];
    if (Array.isArray(res)) {
      tags = res;
    } else {
      result = res.html || result;
      tags = res.tags;
    }
    const headTags: HtmlTagDescriptor[] = [];
    const headPrependTags: HtmlTagDescriptor[] = [];
    const bodyTags: HtmlTagDescriptor[] = [];
    const bodyPrependTags: HtmlTagDescriptor[] = [];
    for (const tag of tags) {
      switch (tag.injectTo) {
        case 'body':
          bodyTags.push(tag);
          break;
        case 'body-prepend':
          bodyPrependTags.push(tag);
          break;
        case 'head':
          headTags.push(tag);
          break;
        default:
          headPrependTags.push(tag);
      }
    }
    result = injectToHead(result, headPrependTags, true);
    result = injectToHead(result, headTags);
    result = injectToBody(result, bodyPrependTags, true);
    result = injectToBody(result, bodyTags);
  }
  return result;
}

function resolveHtmlTransforms(
  plugins: readonly Plugin[]
): [IndexHtmlTransformHook[], IndexHtmlTransformHook[], IndexHtmlTransformHook[]] {
  const preHooks: IndexHtmlTransformHook[] = [];
  const normalHooks: IndexHtmlTransformHook[] = [];
  const postHooks: IndexHtmlTransformHook[] = [];
  for (const plugin of plugins) {
    const hook = plugin.transformIndexHtml;
    if (!hook) {
      continue;
    }
    if (typeof hook === 'function') {
      normalHooks.push(hook);
    } else if (hook.order === 'pre') {
      preHooks.push(hook.handler);
    } else if (hook.order === 'post') {
      postHooks.push(hook.handler);
    } else {
      normalHooks.push(hook.handler);
    }
  }
  return [preHooks, normalHooks, postHooks];
}

function injectToHead(html: string, tags: HtmlTagDescriptor[], prepend = false): string {
  if (tags.length === 0) {
    return html;
  }
  if (prepend) {
    if (HEAD_PREPEND_INJECT_RE.test(html)) {
      return html.replace(
        HEAD_PREPEND_INJECT_RE,
        (match, p1) => `${match}\n${serializeTags(tags, incrementIndent(p1))}`
      );
    }
  } else {
    if (HEAD_INJECT_RE.test(html)) {
      return html.replace(
        HEAD_INJECT_RE,
        (match, p1) => `${serializeTags(tags, incrementIndent(p1))}${match}`
      );
    }
    if (BODY_PREPEND_INJECT_RE.test(html)) {
      return html.replace(
        BODY_PREPEND_INJECT_RE,
        (match, p1) => `${serializeTags(tags, p1)}\n${match}`
      );
    }
  }
  return prependInjectFallback(html, tags);
}

function injectToBody(html: string, tags: HtmlTagDescriptor[], prepend = false): string {
  if (tags.length === 0) {
    return html;
  }
  if (prepend) {
    if (BODY_PREPEND_INJECT_RE.test(html)) {
      return html.replace(
        BODY_PREPEND_INJECT_RE,
        (match, p1) => `${match}\n${serializeTags(tags, incrementIndent(p1))}`
      );
    }
    if (HEAD_INJECT_RE.test(html)) {
      return html.replace(HEAD_INJECT_RE, (match, p1) => `${match}\n${serializeTags(tags, p1)}`);
    }
    return prependInjectFallback(html, tags);
  }
  if (BODY_INJECT_RE.test(html)) {
    return html.replace(
      BODY_INJECT_RE,
      (match, p1) => `${serializeTags(tags, incrementIndent(p1))}${match}`
    );
  }
  if (HTML_INJECT_RE.test(html)) {
    return html.replace(HTML_INJECT_RE, `${serializeTags(tags)}\n$&`);
  }
  return `${html}\n${serializeTags(tags)}`;
}

function prependInjectFallback(html: string, tags: HtmlTagDescriptor[]): string {
  if (HTML_PREPEND_INJECT_RE.test(html)) {
    return html.replace(HTML_PREPEND_INJECT_RE, `$&\n${serializeTags(tags)}`);
  }
  if (DOCTYPE_PREPEND_INJECT_RE.test(html)) {
    return html.replace(DOCTYPE_PREPEND_INJECT_RE, `$&\n${serializeTags(tags)}`);
  }
  return serializeTags(tags) + html;
}

function serializeTag({ tag, attrs, children }: HtmlTagDescriptor, indent = ''): string {
  if (UNARY_TAGS.has(tag)) {
    return `<${tag}${serializeAttrs(attrs)}>`;
  }
  return `<${tag}${serializeAttrs(attrs)}>${serializeTags(children, incrementIndent(indent))}</${tag}>`;
}

function serializeTags(tags: HtmlTagDescriptor['children'], indent = ''): string {
  if (typeof tags === 'string') {
    return tags;
  }
  if (tags && tags.length) {
    return tags.map((tag) => `${indent}${serializeTag(tag, indent)}\n`).join('');
  }
  return '';
}

function serializeAttrs(attrs: HtmlTagDescriptor['attrs']): string {
  let res = '';
  for (const key in attrs) {
    const value = attrs[key];
    if (typeof value === 'boolean') {
      res += value ? ` ${key}` : '';
    } else if (value !== undefined) {
      res += ` ${key}="${escapeHtml(String(value))}"`;
    }
  }
  return res;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function incrementIndent(indent = ''): string {
  return `${indent}${indent[0] === '\t' ? '\t' : '  '}`;
}
