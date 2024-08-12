import flowParser from './parser-flow';
import jsParser from './parser-js';
import tsParser from './parser-ts';

function getParser(type) {
  if (type === 'javascript' || /\.jsx?/.test(type) || !type) {
    return jsParser;
  }

  if (type === 'typescript' || /\.tsx?/.test(type)) {
    return tsParser;
  }

  if (type === 'flow') {
    return flowParser;
  }

  throw new Error(`Parser of type "${type}" is not supported`);
}

export default getParser;
