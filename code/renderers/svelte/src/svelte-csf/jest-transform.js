const svelte = require('svelte/compiler');

const parser = require.resolve('./parser/collect-stories').replace(/[/\\]/g, '/');

function process(src, filename) {
  const result = svelte.compile(src, {
    format: 'cjs',
    filename,
    dev: true,
  });

  const code = result.js ? result.js.code : result.code;

  const z = {
    code: `${code}
    const { default: parser } = require('${parser}');
    const md = parser(module.exports.default, {});
    module.exports = { default: md.meta, ...md.stories };
    Object.defineProperty(exports, "__esModule", { value: true });`,
    map: result.js ? result.js.map : result.map,
  };
  return z;
}

exports.process = process;
