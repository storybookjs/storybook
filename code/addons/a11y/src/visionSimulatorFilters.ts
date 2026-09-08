export const filters: Record<string, { label: string; filter: string; percentage?: number }> = {
  blurred: {
    label: 'Blurred vision',
    filter: 'blur(2px)',
    percentage: 22.9,
  },
  deuteranomaly: {
    label: 'Deuteranomaly',
    filter: 'url("#storybook-a11y-vision-deuteranomaly")',
    percentage: 2.7,
  },
  deuteranopia: {
    label: 'Deuteranopia',
    filter: 'url("#storybook-a11y-vision-deuteranopia")',
    percentage: 0.56,
  },
  protanomaly: {
    label: 'Protanomaly',
    filter: 'url("#storybook-a11y-vision-protanomaly")',
    percentage: 0.66,
  },
  protanopia: {
    label: 'Protanopia',
    filter: 'url("#storybook-a11y-vision-protanopia")',
    percentage: 0.59,
  },
  tritanomaly: {
    label: 'Tritanomaly',
    filter: 'url("#storybook-a11y-vision-tritanomaly")',
    percentage: 0.01,
  },
  tritanopia: {
    label: 'Tritanopia',
    filter: 'url("#storybook-a11y-vision-tritanopia")',
    percentage: 0.016,
  },
  achromatopsia: {
    label: 'Achromatopsia',
    filter: 'url("#storybook-a11y-vision-achromatopsia")',
    percentage: 0.0001,
  },
  grayscale: {
    label: 'Grayscale',
    filter: 'grayscale(100%)',
  },
} as const;

// Firefox ignores CSS `filter: url(#id)` when the SVG defining `#id` is `display: none`.
// The dichromacy matrices below use Machado et al. (2009) at severity 1.0: https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
export const filterDefs = `<svg id="storybook-a11y-vision-filters" aria-hidden="true" color-interpolation-filters="linearRGB" style="position:absolute;width:0;height:0;overflow:hidden">
  <defs>
    <filter id="storybook-a11y-vision-protanopia">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0.152286, 1.052583, -0.204868, 0, 0 0.114503, 0.786281, 0.099216, 0, 0 -0.003882, -0.048116, 1.051998, 0, 0 0, 0, 0, 1, 0"
      />
    </filter>
    <filter id="storybook-a11y-vision-protanomaly">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0.817, 0.183, 0, 0, 0 0.333, 0.667, 0, 0, 0 0, 0.125, 0.875, 0, 0 0, 0, 0, 1, 0"
      />
    </filter>
    <filter id="storybook-a11y-vision-deuteranopia">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0.367322, 0.860646, -0.227968, 0, 0 0.280085, 0.672501, 0.047413, 0, 0 -0.011820, 0.042940, 0.968881, 0, 0 0, 0, 0, 1, 0"
      />
    </filter>
    <filter id="storybook-a11y-vision-deuteranomaly">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0.8, 0.2, 0, 0, 0 0.258, 0.742, 0, 0, 0 0, 0.142, 0.858, 0, 0 0, 0, 0, 1, 0"
      />
    </filter>
    <filter id="storybook-a11y-vision-tritanopia">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1.255528, -0.076749, -0.178779, 0, 0 -0.078411, 0.930809, 0.147602, 0, 0 0.004733, 0.691367, 0.303900, 0, 0 0, 0, 0, 1, 0"
      />
    </filter>
    <filter id="storybook-a11y-vision-tritanomaly">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0.967, 0.033, 0, 0, 0 0, 0.733, 0.267, 0, 0 0, 0.183, 0.817, 0, 0 0, 0, 0, 1, 0"
      />
    </filter>
    <filter id="storybook-a11y-vision-achromatopsia">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0.299, 0.587, 0.114, 0, 0 0.299, 0.587, 0.114, 0, 0 0.299, 0.587, 0.114, 0, 0 0, 0, 0, 1, 0"
      />
    </filter>
  </defs>
</svg>`;
