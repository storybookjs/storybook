function formatContent(text, object) {
  return object ? JSON.stringify(object, null, 2) : text;
}

<template><pre data-testid="pre" style={{@style}}>{{(formatContent @text @object)}}</pre></template>
