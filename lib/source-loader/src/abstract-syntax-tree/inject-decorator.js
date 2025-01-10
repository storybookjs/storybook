import defaultOptions from './default-options';
import {
  generateSourceWithDecorators,
  generateSourceWithoutDecorators,
  generateSourcesInExportedParameters,
  generateSourcesInStoryParameters,
  generateStoriesLocationsMap,
  generateStorySource,
} from './generate-helpers';
import getParser from './parsers';

function extendOptions(source, comments, filepath, options) {
  return {
    ...defaultOptions,
    ...options,
    source,
    comments,
    filepath,
  };
}

function inject(source, filepath, options = {}, log = (message) => {}) {
  const { injectDecorator = true, injectStoryParameters = false } = options;
  const obviouslyNotCode = ['md', 'txt', 'json'].includes(options.parser);
  let parser = null;
  try {
    parser = getParser(options.parser || filepath);
  } catch (e) {
    log(new Error(`(not fatal, only impacting storysource) Could not load a parser (${e})`));
  }

  if (obviouslyNotCode || !parser) {
    return {
      source,
      storySource: {},
      addsMap: {},
      changed: false,
    };
  }
  const ast = parser.parse(source);

  const {
    changed,
    source: cleanedSource,
    comments,
    exportTokenFound,
  } = injectDecorator === true
    ? generateSourceWithDecorators(source, ast)
    : generateSourceWithoutDecorators(source, ast);

  const storySource = generateStorySource(extendOptions(source, comments, filepath, options));
  const newAst = parser.parse(storySource);
  const addsMap = generateStoriesLocationsMap(newAst, []);

  let newSource = cleanedSource;
  if (exportTokenFound) {
    const cleanedSourceAst = parser.parse(cleanedSource);
    if (injectStoryParameters) {
      newSource = generateSourcesInStoryParameters(cleanedSource, cleanedSourceAst, {
        source: storySource,
        locationsMap: addsMap,
      });
    } else {
      newSource = generateSourcesInExportedParameters(cleanedSource, cleanedSourceAst, {
        source: storySource,
        locationsMap: addsMap,
      });
    }
  }

  if (!changed && Object.keys(addsMap || {}).length === 0) {
    return {
      source: newSource,
      storySource,
      addsMap: {},
      changed,
    };
  }

  return {
    source: newSource,
    storySource,
    addsMap,
    changed,
  };
}

export default inject;
