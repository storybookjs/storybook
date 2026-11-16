export const filters: Record<string, { label: string; filter: string; description?: string }> = {
  blurred: {
    label: 'Blurred vision',
    filter: 'blur(2px)',
    description: '22.9% of users',
  },
  reducedContrast: {
    label: 'Reduced contrast',
    filter: 'url("#storybook-a11y-vision-reduced-contrast")',
    description: '10% of users',
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
  tritanopiaMachado: {
    label: 'Tritanopia (inaccurate)',
    filter: 'url("#storybook-a11y-vision-tritanopia-machado")',
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
// Protanopia, deuteranopia and the inaccurate tritanopia use the Machado et al. (2009) severity 1.0
// matrices:
// https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
// Tritanopia projects onto the two half-planes of Brettel, Viénot & Mollon (1997). Its first matrix
// puts each side of the dividing plane in its own channel, relying on filter results clamping
// negative values to 0, and its second matrix maps each side onto its half-plane.
// Achromatopsia uses the sRGB relative luminance weights, which apply to linear light.
// Reduced contrast adds half of the linear range to every channel, as Chrome DevTools does.
export const filterDefs = `<svg id="storybook-a11y-vision-filters" aria-hidden="true" color-interpolation-filters="linearRGB" style="position:absolute;width:0;height:0;overflow:hidden">
  <defs>
    <filter id="storybook-a11y-vision-reduced-contrast">
      <feComponentTransfer in="SourceGraphic">
        <feFuncR type="linear" intercept="0.5" />
        <feFuncG type="linear" intercept="0.5" />
        <feFuncB type="linear" intercept="0.5" />
      </feComponentTransfer>
    </filter>
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
    <filter id="storybook-a11y-vision-tritanopia-machado">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1.255528, -0.076749, -0.178779, 0, 0 -0.078411, 0.930809, 0.147602, 0, 0 0.004733, 0.691367, 0.303900, 0, 0 0, 0, 0, 1, 0"
      />
    </filter>
    <filter id="storybook-a11y-vision-tritanopia">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1, -0.714810, -0.285190, 0, 0 -1, 0.714810, 0.285190, 0, 0 0.185545, 0.734543, 0.079911, 0, 0 0, 0, 0, 1, 0"
      />
      <feColorMatrix
        type="matrix"
        values="0.827996, -0.747824, 1, 0, 0 -0.197351, 0.127458, 1, 0, 0 -0.108473, 0.564773, 1, 0, 0 0, 0, 0, 1, 0"
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
