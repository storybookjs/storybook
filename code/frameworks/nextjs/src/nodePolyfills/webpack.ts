import { createRequire } from 'node:module';
import type { Configuration } from 'webpack';
import webpack from 'webpack';

const NODE_PROTOCOL_REGEX = /^node:/;
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));

const resolveFromNext = (...ids: string[]) => {
  for (const id of ids) {
    try {
      return nextRequire.resolve(id);
    } catch {
      // Try the next candidate until we find a polyfill that exists in this install.
    }
  }

  return undefined;
};

const pickResolvedEntries = <T extends Record<string, string | [string, string] | undefined>>(
  entries: T
) => {
  return Object.fromEntries(
    Object.entries(entries).filter((entry): entry is [string, Exclude<T[string], undefined>] =>
      Boolean(entry[1])
    )
  );
};

const providePluginAliases = pickResolvedEntries({
  Buffer: resolveFromNext('buffer/') ? [resolveFromNext('buffer/')!, 'Buffer'] : undefined,
  process: resolveFromNext('process/browser'),
}) satisfies ConstructorParameters<typeof webpack.ProvidePlugin>[0];

const fallbackAliases = pickResolvedEntries({
  buffer: resolveFromNext('buffer/'),
  constants: resolveFromNext(
    'next/dist/compiled/constants-browserify',
    'constants-browserify'
  ),
  crypto: resolveFromNext('next/dist/compiled/crypto-browserify', 'crypto-browserify'),
  domain: resolveFromNext('next/dist/compiled/domain-browser', 'domain-browser'),
  events: resolveFromNext('events/'),
  http: resolveFromNext('next/dist/compiled/stream-http', 'stream-http'),
  https: resolveFromNext('next/dist/compiled/https-browserify', 'https-browserify'),
  os: resolveFromNext('next/dist/compiled/os-browserify', 'os-browserify/browser'),
  path: resolveFromNext('next/dist/compiled/path-browserify', 'path-browserify'),
  punycode: resolveFromNext('punycode/'),
  process: resolveFromNext('process/browser'),
  querystring: resolveFromNext('next/dist/compiled/querystring-es3', 'querystring-es3'),
  stream: resolveFromNext('next/dist/compiled/stream-browserify', 'stream-browserify'),
  _stream_duplex: resolveFromNext('readable-stream/lib/_stream_duplex'),
  _stream_passthrough: resolveFromNext('readable-stream/lib/_stream_passthrough'),
  _stream_readable: resolveFromNext('readable-stream/lib/_stream_readable'),
  _stream_transform: resolveFromNext('readable-stream/lib/_stream_transform'),
  _stream_writable: resolveFromNext('readable-stream/lib/_stream_writable'),
  string_decoder: resolveFromNext('string_decoder/'),
  sys: resolveFromNext('next/dist/compiled/util', 'util/'),
  timers: resolveFromNext('next/dist/compiled/timers-browserify', 'timers-browserify'),
  tty: resolveFromNext('next/dist/compiled/tty-browserify', 'tty-browserify'),
  url: resolveFromNext('url/'),
  util: resolveFromNext('next/dist/compiled/util', 'util/'),
  vm: resolveFromNext('next/dist/compiled/vm-browserify', 'vm-browserify'),
  zlib: resolveFromNext('browserify-zlib'),
}) satisfies NonNullable<Configuration['resolve']>['fallback'];

export const configureNodePolyfills = (baseConfig: Configuration) => {
  // This is added as a way to avoid issues caused by Next.js 13.4.3
  // introduced by gzip-size
  // Newer Next.js releases import builtins through the node: scheme, but webpack's
  // polyfill and fallback handling only applies once the request is normalized.
  baseConfig.plugins = [
    ...(baseConfig.plugins || []),
    new webpack.NormalModuleReplacementPlugin(NODE_PROTOCOL_REGEX, (resource) => {
      resource.request = resource.request.replace(NODE_PROTOCOL_REGEX, '');
    }),
    new webpack.ProvidePlugin(providePluginAliases),
  ];

  baseConfig.resolve = {
    ...baseConfig.resolve,
    fallback: {
      ...fallbackAliases,
      assert: false,
      fs: false,
      ...baseConfig.resolve?.fallback,
    },
  };

  return baseConfig;
};
