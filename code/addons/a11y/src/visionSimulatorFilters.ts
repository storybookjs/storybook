export const filters: Record<string, { label: string; filter: string; description?: string }> = {
  blurred: {
    label: 'Blurred vision',
    filter: 'blur(2px)',
    description: '22.9% of users',
  },
  deuteranopia: {
    label: 'Deuteranopia',
    filter: 'url("#storybook-a11y-vision-deuteranopia")',
    // Includes deuteranomaly, whose severity ranges up to deuteranopia.
    description: '3.26% of users\nMachado et al. 2009',
  },
  protanopia: {
    label: 'Protanopia',
    filter: 'url("#storybook-a11y-vision-protanopia")',
    // Includes protanomaly, whose severity ranges up to protanopia.
    description: '1.25% of users\nMachado et al. 2009',
  },
  tritanomaly: {
    label: 'Tritanomaly (inaccurate)',
    filter: 'url("#storybook-a11y-vision-tritanopia")',
    description: '0.016% of users\nMachado et al. 2009',
  },
  tritanopia: {
    label: 'Tritanopia',
    filter: 'url("#storybook-a11y-vision-tritanopia")',
    description: '0.016% of users\nBrettel et al. 1997',
  },
  achromatopsia: {
    label: 'Achromatopsia',
    filter: 'url("#storybook-a11y-vision-achromatopsia")',
    description: '0.0001% of users',
  },
  grayscale: {
    label: 'Grayscale',
    filter: 'grayscale(100%)',
  },
} as const;

// Firefox ignores CSS `filter: url(#id)` when the SVG defining `#id` is `display: none`.
// The dichromacy matrices below use Machado et al. (2009) at severity 1.0:
// https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
// The achromatopsia matrix uses the sRGB relative luminance weights, which apply to linear light.
export const filterDefs = `<svg id="storybook-a11y-vision-filters" aria-hidden="true" color-interpolation-filters="linearRGB" style="position:absolute;width:0;height:0;overflow:hidden">
  <defs>
    <filter id="storybook-a11y-vision-protanopia">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0.152286, 1.052583, -0.204868, 0, 0 0.114503, 0.786281, 0.099216, 0, 0 -0.003882, -0.048116, 1.051998, 0, 0 0, 0, 0, 1, 0"
      />
    </filter>
    <filter id="storybook-a11y-vision-deuteranopia">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0.367322, 0.860646, -0.227968, 0, 0 0.280085, 0.672501, 0.047413, 0, 0 -0.011820, 0.042940, 0.968881, 0, 0 0, 0, 0, 1, 0"
      />
    </filter>
    <filter id="storybook-a11y-vision-tritanopia">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1.255528, -0.076749, -0.178779, 0, 0 -0.078411, 0.930809, 0.147602, 0, 0 0.004733, 0.691367, 0.303900, 0, 0 0, 0, 0, 1, 0"
      />
    </filter>
    <filter id="storybook-a11y-vision-achromatopsia">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0.2126, 0.7152, 0.0722, 0, 0 0.2126, 0.7152, 0.0722, 0, 0 0.2126, 0.7152, 0.0722, 0, 0 0, 0, 0, 1, 0"
      />
    </filter>
  </defs>
</svg>`;
