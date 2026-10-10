// What Google Fonts answers for the fonts of the app, so that Storybook needs no network and
// Chromatic sees the same font every time: `next/font/google` reads the answers here, with
// NEXT_FONT_GOOGLE_MOCKED_RESPONSES set to this file, from the files of Fontsource.
const { createRequire } = require("node:module");
const path = require("node:path");

const project = createRequire(path.join(__dirname, "..", "package.json"));
const fontsource = (name) =>
  path.join(
    path.dirname(project.resolve(`@fontsource-variable/${name}/package.json`)),
    `files/${name}-latin-wght-normal.woff2`,
  );

const stylesheet = (family, file) => `/* latin */
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(${file}) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
`;
const url = (family) =>
  `https://fonts.googleapis.com/css2?family=${family.replaceAll(" ", "+")}:wght@100..900&display=swap`;

module.exports = {
  [url("Geist")]: stylesheet("Geist", fontsource("geist")),
  [url("Geist Mono")]: stylesheet("Geist Mono", fontsource("geist-mono")),
};
