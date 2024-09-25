import parseTs from 'prettier/plugins/typescript';

function parse(source) {
  try {
    return parseTs.parsers.typescript.parse(source);
  } catch (error1) {
    try {
      return JSON.stringify(source);
    } catch (error) {
      throw error1;
    }
  }
}
function format(source) {
  return parseTs.parsers.typescript.format(source);
}

export default {
  parse,
  format,
};
